/**
 * 爪印日记 (PawLog) — 前端安全通信协议 SDK (public/security-sdk.js)
 * 职责：
 * 1. 纯前端原生实现 SHA-256 与 HMAC-SHA256 (兼容所有浏览器上下文)
 * 2. 自动为每一次 API 写请求封装 X-Timestamp、X-Nonce、X-Signature 与 JWT Authorization
 * 3. 提供【抓包参数篡改演练】与【Nonce 重放攻击演练】方法，直观检验服务端安全防御盾拦截能力
 */
(function (global) {
  // 纯 JS 标准 SHA-256 与 HMAC-SHA256 实现（不依赖任何外部库）
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function utf8ToBytes(str) {
    return Array.from(new TextEncoder().encode(String(str || '')));
  }

  function sha256Bytes(msgBytes) {
    const bytes = msgBytes.slice();
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while ((bytes.length * 8) % 512 !== 448) {
      bytes.push(0);
    }
    const highBits = Math.floor(bitLen / 0x100000000);
    const lowBits = bitLen >>> 0;
    for (let i = 3; i >= 0; i--) bytes.push((highBits >>> (i * 8)) & 0xff);
    for (let i = 3; i >= 0; i--) bytes.push((lowBits >>> (i * 8)) & 0xff);

    let h0 = 0x6a09e667,
      h1 = 0xbb67ae85,
      h2 = 0x3c6ef372,
      h3 = 0xa54ff53a,
      h4 = 0x510e527f,
      h5 = 0x9b05688c,
      h6 = 0x1f83d9ab,
      h7 = 0x5be0cd19;

    const w = new Array(64);
    for (let i = 0; i < bytes.length; i += 64) {
      for (let t = 0; t < 16; t++) {
        const idx = i + t * 4;
        w[t] =
          ((bytes[idx] << 24) |
            (bytes[idx + 1] << 16) |
            (bytes[idx + 2] << 8) |
            bytes[idx + 3]) >>>
          0;
      }
      for (let t = 16; t < 64; t++) {
        const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }

      let a = h0,
        b = h1,
        c = h2,
        d = h3,
        e = h4,
        f = h5,
        g = h6,
        h = h7;

      for (let t = 0; t < 64; t++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    const out = [];
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((word) => {
      out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
    });
    return out;
  }

  function bytesToHex(bytes) {
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function sha256Hex(str) {
    return bytesToHex(sha256Bytes(utf8ToBytes(str)));
  }

  function hmacSha256Hex(keyStr, messageStr) {
    let keyBytes = utf8ToBytes(keyStr);
    if (keyBytes.length > 64) {
      keyBytes = sha256Bytes(keyBytes);
    }
    while (keyBytes.length < 64) {
      keyBytes.push(0);
    }
    const oKeyPad = keyBytes.map((b) => b ^ 0x5c);
    const iKeyPad = keyBytes.map((b) => b ^ 0x36);
    const innerHash = sha256Bytes(iKeyPad.concat(utf8ToBytes(messageStr)));
    const outerHash = sha256Bytes(oKeyPad.concat(innerHash));
    return bytesToHex(outerHash);
  }

  function generateNonce() {
    return (
      'n_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6)
    );
  }

  const API_ORIGIN = 'https://pawhope.cn';

  const PawSecuritySDK = {
    signSecret: 'pawlog_hmac_secret_2026_craft_key_9981',
    authToken: '',
    apiOrigin: API_ORIGIN,
    lastEnvelope: null,

    url(path) {
      if (!path) return this.apiOrigin;
      if (/^https?:\/\//i.test(path)) return path;
      return this.apiOrigin + (path.charAt(0) === '/' ? path : '/' + path);
    },

    configure({ signSecret, authToken }) {
      if (signSecret) this.signSecret = signSecret;
      if (authToken) this.authToken = authToken;
    },

    buildSignedHeaders(method, path, rawBody, customNonce, customTimestamp) {
      const timestamp = String(customTimestamp || Date.now());
      const nonce = customNonce || generateNonce();
      const bodyHash = sha256Hex(rawBody || '');
      const canonical = [method.toUpperCase(), path, timestamp, nonce, bodyHash].join('\n');
      const signature = hmacSha256Hex(this.signSecret, canonical);

      this.lastEnvelope = { method, path, timestamp, nonce, signature, rawBody };

      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'X-App-Client': 'PawLog-Mobile/2.4.0',
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      return headers;
    },

    async request(method, path, payload = null) {
      const rawBody = payload ? JSON.stringify(payload) : '';
      const headers = this.buildSignedHeaders(method, path, rawBody);
      const response = await fetch(this.url(path), {
        method: method.toUpperCase(),
        headers,
        body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) ? rawBody : undefined
      });
      const data = await response.json();
      return { status: response.status, ok: response.ok, ...data };
    },

    /**
     * 模拟黑客抓包篡改参数测试（签名用的原价398元，但传输途中把金额篡改为0.01元）
     */
    async simulateTamperAttack() {
      const path = '/api/v1/ledger/entries';
      const originalBody = JSON.stringify({
        type: '支出',
        category: '饮食口粮',
        title: '原价猫粮正常订单',
        amount: 398
      });
      // 用原始合法包生成签名头
      const headers = this.buildSignedHeaders('POST', path, originalBody);
      // 模拟中间人篡改了请求体中的金额为 0.01 元，但没有服务端密钥无法重算正确签名
      const tamperedBody = JSON.stringify({
        type: '支出',
        category: '饮食口粮',
        title: '被黑客篡改价格为0.01元的恶意请求',
        amount: 0.01
      });
      const response = await fetch(this.url(path), {
        method: 'POST',
        headers,
        body: tamperedBody
      });
      const data = await response.json();
      return { status: response.status, ok: response.ok, ...data };
    },

    /**
     * 模拟黑客截获合法请求包后进行重放攻击 (Replay Attack)
     */
    async simulateReplayAttack() {
      const path = '/api/v1/reminders/toggle';
      const rawBody = JSON.stringify({ id: 'rem_1' });
      const fixedNonce = 'replay_nonce_' + Date.now();
      const fixedTs = Date.now();
      const headers = this.buildSignedHeaders('PATCH', path, rawBody, fixedNonce, fixedTs);

      // 第一次正常发送（放行并消耗该 Nonce）
      await fetch(this.url(path), { method: 'PATCH', headers, body: rawBody });
      // 第二次使用完全相同的 Nonce 与签名重放发送（应被服务端 409 拦截）
      const replayRes = await fetch(this.url(path), { method: 'PATCH', headers, body: rawBody });
      const data = await replayRes.json();
      return { status: replayRes.status, ok: replayRes.ok, ...data };
    }
  };

  global.PawSecuritySDK = PawSecuritySDK;
})(window);
