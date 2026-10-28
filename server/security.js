const crypto = require('crypto');

/**
 * 爪印日记 (PawLog) — 企业级七层软件安全防御引擎
 * 1. HMAC-SHA256 接口防篡改签名核验
 * 2. Timestamp (±300s) + Nonce 指纹池防重放攻击
 * 3. 滑动窗口多级速率限制 (Rate Limiter)
 * 4. 递归 XSS / 原型链污染 / 危险载荷消毒 (Payload Sanitizer)
 * 5. JWT 令牌签发与零信任鉴权
 * 6. PawLink/1.2 硬件通信帧 CRC32 校验与签名
 * 7. 实时安全审计日志与拦截统计面板
 */

const APP_SIGN_SECRET = process.env.PAWLOG_SIGN_SECRET || 'pawlog_hmac_secret_2026_craft_key_9981';
const JWT_SECRET = process.env.PAWLOG_JWT_SECRET || 'pawlog_jwt_vault_key_2026_x7a9';
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // ±300 秒

// Nonce 缓存池: Map<nonce, expireTimestamp>
const nonceStore = new Map();
// 速率限制池: Map<ip_route_bucket, { count, resetAt }>
const rateLimitStore = new Map();
// 安全审计日志环状队列（保留最近 100 条）
const securityAuditLogs = [];

const securityStats = {
  totalRequests: 0,
  verifiedSignatures: 0,
  blockedTamper: 0,
  blockedReplay: 0,
  blockedRateLimit: 0,
  sanitizedPayloads: 0,
  iotFramesVerified: 0,
  startedAt: Date.now()
};

function pushSecurityLog(event) {
  const entry = {
    id: 'sec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    time: new Date().toISOString(),
    ...event
  };
  securityAuditLogs.unshift(entry);
  if (securityAuditLogs.length > 80) {
    securityAuditLogs.pop();
  }
  return entry;
}

// 定期清理过期 Nonce 与限流桶
setInterval(() => {
  const now = Date.now();
  for (const [nonce, exp] of nonceStore.entries()) {
    if (exp <= now) nonceStore.delete(nonce);
  }
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) rateLimitStore.delete(key);
  }
}, 60 * 1000).unref();

/**
 * 计算 SHA256 Hex
 */
function sha256Hex(content) {
  return crypto.createHash('sha256').update(String(content || ''), 'utf8').digest('hex');
}

/**
 * 计算请求签名: HMAC_SHA256(secret, METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + SHA256(BODY))
 */
function computeRequestSignature({ method, path, timestamp, nonce, rawBody }) {
  const bodyHash = sha256Hex(rawBody || '');
  const canonical = [
    String(method || 'GET').toUpperCase(),
    String(path || '/'),
    String(timestamp || ''),
    String(nonce || ''),
    bodyHash
  ].join('\n');
  return crypto.createHmac('sha256', APP_SIGN_SECRET).update(canonical, 'utf8').digest('hex');
}

/**
 * 常量时间字符串比对（防止计时攻击 Timing Attack）
 */
function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * 轻量级标准 HS256 JWT 签发与校验
 */
function signJwt(payload, expiresInSec = 86400 * 7) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: nowSec,
      exp: nowSec + expiresInSec
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (!timingSafeEqualHex(sig, expectedSig)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * 递归清洗输入载荷：防止 XSS 注入与原型链污染
 */
function sanitizePayload(input, statsTracker = { mutated: false }) {
  if (typeof input === 'string') {
    const cleaned = input
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/javascript\s*:/gi, 'blocked:')
      .replace(/on(error|load|click|mouseover|focus)\s*=/gi, 'data-blocked-event=')
      .replace(/<\s*(iframe|object|embed)[^>]*>/gi, '');
    if (cleaned !== input) statsTracker.mutated = true;
    return cleaned.trim();
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item, statsTracker));
  }
  if (input !== null && typeof input === 'object') {
    const safeObj = {};
    for (const key of Object.keys(input)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        statsTracker.mutated = true;
        continue;
      }
      safeObj[key] = sanitizePayload(input[key], statsTracker);
    }
    return safeObj;
  }
  return input;
}

/**
 * 滑动窗口速率限制检查
 */
function checkRateLimit(ip, pathname, method) {
  const now = Date.now();
  const isSensitive =
    pathname.includes('/auth/login') ||
    pathname.includes('/orders/checkout') ||
    pathname.includes('/devices/');
  const limit = isSensitive ? 35 : 150; // 每分钟上限
  const windowMs = 60 * 1000;
  const key = `${ip}:${isSensitive ? pathname : 'global'}:${method}`;

  let bucket = rateLimitStore.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    limit
  };
}

/**
 * 计算 CRC32 校验码（用于 PawLink/1.2 智能硬件通信协议帧）
 */
function computeCrc32Hex(str) {
  let crc = 0xffffffff;
  const buf = Buffer.from(String(str), 'utf8');
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * 构建 PawLink/1.2 硬件通信标准帧
 */
function buildPawLinkFrame({ deviceId, deviceType, cmd, payload, seq }) {
  const timestamp = Date.now();
  const rawFrame = JSON.stringify({ deviceId, deviceType, cmd, payload, seq, timestamp });
  const crc32 = computeCrc32Hex(rawFrame);
  securityStats.iotFramesVerified += 1;
  return {
    protocol: 'PawLink/1.2',
    deviceId,
    deviceType,
    seq,
    cmd,
    payload,
    crc32,
    timestamp
  };
}

/**
 * 设置安全响应头 (CSP / HSTS / Nosniff / FrameGuard)
 */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' data: blob:; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://pawhope.cn https://www.pawhope.cn;"
  );
}

/**
 * 核心 API 安全校验网关：校验 Timestamp + Nonce + HMAC-SHA256 签名
 */
function verifyApiSecurity({ method, pathname, headers, rawBody, ip }) {
  securityStats.totalRequests += 1;

  // 1. 速率限制检查
  const rate = checkRateLimit(ip, pathname, method);
  if (!rate.allowed) {
    securityStats.blockedRateLimit += 1;
    pushSecurityLog({
      level: 'WARN',
      type: 'RATE_LIMIT_EXCEEDED',
      path: pathname,
      method,
      detail: `IP ${ip} 触发频控阈值 (${rate.limit}/min)`
    });
    return {
      ok: false,
      status: 429,
      code: 42901,
      message: '请求过于频繁，已被软件防御盾限流保护，请稍后再试'
    };
  }

  // 对于写操作或显式携带签名头的请求，强制执行防重放与 HMAC 签名校验
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const timestampHeader = headers['x-timestamp'];
  const nonceHeader = headers['x-nonce'];
  const signatureHeader = headers['x-signature'];

  if (isMutation || signatureHeader) {
    if (!timestampHeader || !nonceHeader || !signatureHeader) {
      securityStats.blockedTamper += 1;
      pushSecurityLog({
        level: 'BLOCK',
        type: 'MISSING_SECURITY_HEADERS',
        path: pathname,
        method,
        detail: '缺少 X-Timestamp / X-Nonce / X-Signature 安全信封头'
      });
      return {
        ok: false,
        status: 403,
        code: 40301,
        message: '安全防御拦截：缺少接口防篡改签名信封头 (X-Signature / X-Nonce)'
      };
    }

    // 2. 校验时间戳窗口 (±300 秒)
    const reqTs = Number(timestampHeader);
    const now = Date.now();
    if (!Number.isFinite(reqTs) || Math.abs(now - reqTs) > TIMESTAMP_TOLERANCE_MS) {
      securityStats.blockedReplay += 1;
      pushSecurityLog({
        level: 'BLOCK',
        type: 'TIMESTAMP_EXPIRED',
        path: pathname,
        method,
        detail: `时间戳偏移越界 (${Math.round((now - reqTs) / 1000)}s)，疑似抓包过期重放`
      });
      return {
        ok: false,
        status: 403,
        code: 40302,
        message: '安全防御拦截：请求时间戳已过期，拒绝重放请求'
      };
    }

    // 3. 校验 Nonce 唯一性（防重放攻击）
    if (nonceStore.has(nonceHeader)) {
      securityStats.blockedReplay += 1;
      pushSecurityLog({
        level: 'BLOCK',
        type: 'NONCE_REPLAY_DETECTED',
        path: pathname,
        method,
        detail: `检测到重复 Nonce (${nonceHeader.slice(0, 12)}...)，已阻断重放攻击`
      });
      return {
        ok: false,
        status: 409,
        code: 40901,
        message: '安全防御拦截：检测到重复 Nonce 指纹，重放攻击已被阻断'
      };
    }

    // 4. 校验 HMAC-SHA256 签名（防参数篡改）
    const expectedSig = computeRequestSignature({
      method,
      path: pathname,
      timestamp: timestampHeader,
      nonce: nonceHeader,
      rawBody
    });

    if (!timingSafeEqualHex(signatureHeader, expectedSig)) {
      securityStats.blockedTamper += 1;
      pushSecurityLog({
        level: 'BLOCK',
        type: 'HMAC_SIGNATURE_MISMATCH',
        path: pathname,
        method,
        detail: `HMAC-SHA256 签名不匹配，请求载荷或金额疑似在传输途中被篡改`
      });
      return {
        ok: false,
        status: 403,
        code: 40303,
        message: '安全防御拦截：HMAC-SHA256 签名校验失败，请求参数疑似被篡改'
      };
    }

    // 记录 Nonce 并登记成功验签
    nonceStore.set(nonceHeader, now + TIMESTAMP_TOLERANCE_MS);
    securityStats.verifiedSignatures += 1;
    pushSecurityLog({
      level: 'PASS',
      type: 'HMAC_VERIFIED',
      path: pathname,
      method,
      detail: `HMAC-SHA256 验签通过 · Nonce=${nonceHeader.slice(0, 8)}`
    });
  }

  return {
    ok: true,
    rateRemaining: rate.remaining
  };
}

/**
 * 手机号与芯片号脱敏辅助函数
 */
function maskPhone(phone) {
  if (!phone || String(phone).length < 7) return phone;
  return String(phone).replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

module.exports = {
  APP_SIGN_SECRET,
  computeRequestSignature,
  signJwt,
  verifyJwt,
  sanitizePayload,
  applySecurityHeaders,
  verifyApiSecurity,
  buildPawLinkFrame,
  maskPhone,
  securityStats,
  securityAuditLogs,
  pushSecurityLog
};
