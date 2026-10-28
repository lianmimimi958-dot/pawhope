const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const {
  APP_SIGN_SECRET,
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
} = require('./security');
const { loadDb, saveDb } = require('./db');
const { chatWithLlm, llmEnabled } = require('./llm');

const PORT = process.env.PORT || 3680;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Timestamp, X-Nonce, X-Signature, X-App-Client');
  res.setHeader('Access-Control-Max-Age', '600');
}

function sendJson(res, status, payload) {
  applySecurityHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(
    JSON.stringify({
      requestId: 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      ...payload
    })
  );
}

const WALK_MAX_POINTS = 4000;
const WALK_MAX_ACCURACY_M = 50;
const WALK_MAX_SPEED_MPS = 12;
const WALK_MIN_STEP_M = 3;
const WALK_STORE_POINTS = 300;

const ORDER_TRANSITIONS = {
  待付款: ['待使用'],
  待使用: ['已完成', '退款/售后'],
  已完成: ['退款/售后']
};

function haversineMeters(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 遛弯轨迹服务端核算：客户端只上传原始定位点 [lat, lng, timestampMs, accuracyM]，
 * 距离/时长/热量一律由服务端重新计算，并过滤低精度点与瞬移漂移点。
 */
function computeWalkFromTrack(rawTrack) {
  const fail = (code, message) => ({ error: { code, message } });
  if (!Array.isArray(rawTrack) || rawTrack.length < 2) {
    return fail(40014, '没有收到定位轨迹，请在设备页开始遛弯后再结束');
  }
  if (rawTrack.length > WALK_MAX_POINTS) {
    return fail(40014, `轨迹点过多（上限 ${WALK_MAX_POINTS}）`);
  }
  const now = Date.now();
  const pts = [];
  for (const p of rawTrack) {
    if (!Array.isArray(p) || p.length < 4) return fail(40015, '轨迹点格式错误');
    const [lat, lng, t, acc] = p.map(Number);
    if (![lat, lng, t, acc].every(Number.isFinite)) return fail(40015, '轨迹点格式错误');
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || acc < 0) return fail(40015, '轨迹坐标越界');
    if (t > now + 120000 || t < now - 86400000) return fail(40015, '轨迹时间戳不在有效范围内');
    if (pts.length && t <= pts[pts.length - 1][2]) return fail(40015, '轨迹时间戳必须递增');
    pts.push([lat, lng, t, acc]);
  }

  const accurate = pts.filter((p) => p[3] <= WALK_MAX_ACCURACY_M);
  if (accurate.length < 2) {
    return fail(40016, `定位精度太差（需优于 ${WALK_MAX_ACCURACY_M} 米），请到开阔处重新记录`);
  }

  const kept = [accurate[0]];
  let jumps = 0;
  for (let i = 1; i < accurate.length; i++) {
    const prev = kept[kept.length - 1];
    const cur = accurate[i];
    const speed = haversineMeters(prev, cur) / ((cur[2] - prev[2]) / 1000);
    if (speed > WALK_MAX_SPEED_MPS) {
      jumps++;
      continue;
    }
    kept.push(cur);
  }
  if (jumps > accurate.length * 0.2) {
    return fail(40016, '轨迹中瞬移点过多，疑似伪造或定位异常，未予记录');
  }

  let meters = 0;
  let anchor = kept[0];
  let farthest = 0;
  for (const p of kept) {
    const step = haversineMeters(anchor, p);
    if (step >= WALK_MIN_STEP_M) {
      meters += step;
      anchor = p;
    }
    farthest = Math.max(farthest, haversineMeters(kept[0], p));
  }
  const durationSec = (kept[kept.length - 1][2] - kept[0][2]) / 1000;
  if (durationSec < 60 || meters < 20) {
    return fail(40017, '这一程太短（不足 1 分钟或 20 米），没有出票');
  }

  const stride = Math.max(1, Math.ceil(kept.length / WALK_STORE_POINTS));
  const stored = kept.filter((_, i) => i % stride === 0);
  if (stored[stored.length - 1] !== kept[kept.length - 1]) stored.push(kept[kept.length - 1]);
  const accSorted = kept.map((p) => p[3]).sort((a, b) => a - b);

  return {
    distanceKm: Math.round(meters / 10) / 100,
    durationMin: Math.max(1, Math.round(durationSec / 60)),
    farthestMeters: Math.round(farthest),
    keptPoints: kept.length,
    droppedPoints: pts.length - kept.length,
    medianAccuracy: Math.round(accSorted[Math.floor(accSorted.length / 2)]),
    startedAt: kept[0][2],
    track: stored.map((p) => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))])
  };
}

function readRawBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk.toString('utf8');
      if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

/**
 * 宠物 AI 对话生成器（结合宠物性格 + 宠物自身真实健康档案、疫苗、体重、过敏史、记账数据回复）
 */
function generatePetAiReply({ db, pet, personality, userText }) {
  const q = String(userText || '').trim();
  const petRecords = db.healthRecords.filter((r) => r.petId === pet.id);
  const petLedger = db.ledgerEntries.filter((e) => e.petId === pet.id && e.type === '支出');
  const totalSpent = petLedger.reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  const latestVaccine = petRecords.find((r) => r.category === '疫苗');
  const latestDeworm = petRecords.find((r) => r.category === '驱虫');
  const latestMedical = petRecords.find((r) => r.category === '看病记录');

  const stylePrefix = {
    傲娇主子: `【${pet.name} · 傲娇主子模式】哼，`,
    粘人小狗: `【${pet.name} · 粘人小宝贝模式】汪呜~ `,
    哲学老干部: `【${pet.name} · 哲学老干部模式】咳，容我捋捋胡须跟你说：`,
    贪吃憨憨: `【${pet.name} · 贪吃干饭王模式】吸溜！先吃口冻干再回答你：`,
    毒舌管家: `【${pet.name} · 毒舌小管家模式】翻开我的档案本看清楚了：`
  }[personality] || `【${pet.name}】`;

  // 检索宠物自身资料回复（手绘稿图2明确要求：“选择宠物性格，实现宠物AI对话以及宠物自身资料回复”）
  if (/疫苗|打针|妙三多|八联|免疫/.test(q)) {
    const vacInfo = latestVaccine
      ? `上次接种是 ${latestVaccine.date}（${latestVaccine.title}，在${latestVaccine.hospital}），下次加强针时间是 ${pet.nextVaccineDate}。`
      : `下次计划免疫时间是 ${pet.nextVaccineDate}。`;
    return `${stylePrefix}问我的疫苗档案呀？记性真差，${vacInfo} 记得提前在待办里设好提醒，别耽误本宝的抗体保护力！`;
  }

  if (/驱虫|大宠爱|海乐妙|跳蚤|心丝虫/.test(q)) {
    const dewInfo = latestDeworm
      ? `最近一次驱虫在 ${latestDeworm.date}（${latestDeworm.title}），下一次驱虫日是 ${pet.nextDewormDate}。`
      : `下一次驱虫日定在 ${pet.nextDewormDate}。`;
    return `${stylePrefix}关于驱虫记录：${dewInfo} 草地溜达完记得帮我检查脚垫和耳朵后面哦。`;
  }

  if (/体重|多重|胖|瘦|体温|几岁|生日|芯片|过敏|资料|档案/.test(q)) {
    return `${stylePrefix}把我的核心身份卡报给你听：我叫「${pet.name}」，品种是${pet.breed}，生日 ${pet.birthday}（现在${pet.ageText}），当前标准体重 ${pet.weightKg} kg，日常体温 ${pet.bodyTempC} °C，芯片号 ${pet.chipNo}。特别注意我的过敏禁忌：${pet.allergy}！`;
  }

  if (/生病|看病|医院|软便|拉肚子|病历/.test(q)) {
    if (latestMedical) {
      return `${stylePrefix}翻了翻我的病历本：${latestMedical.date} 在「${latestMedical.hospital}」找 ${latestMedical.doctor} 看过「${latestMedical.title}」，当时结论是：${latestMedical.notes}`;
    }
    return `${stylePrefix}我最近的医疗记录很干净，身体倍儿棒，日常状态：${pet.dailyStatus}！`;
  }

  if (/花销|记账|花了多少|账单|买粮|多少钱/.test(q)) {
    return `${stylePrefix}悄悄查了下你在我身上记的账单，目前累计支出 ¥${totalSpent.toFixed(2)} 元（共 ${petLedger.length} 笔明细）。放心，我每天认真干饭、陪你开心，这笔投资绝对稳赚不赔！`;
  }

  if (/饿|吃|喂食|食碗|罐头|冻干/.test(q)) {
    const feeder = db.devicesState.feeder;
    return `${stylePrefix}刚才瞄了一眼智能食碗，碗里还剩 ${feeder.bowlRemainGrams}g 粮，储粮桶余量 ${feeder.hopperRemainGrams}g，今天已经吃了 ${feeder.todayEatenGrams}g 啦。要是再赏两颗帕特鹿肉冻干就更完美了！`;
  }

  // 默认性格化情感互动
  const moodReplies = {
    傲娇主子: `本喵今天体重保持在完美的 ${pet.weightKg}kg（${pet.dailyStatus}）。看在你这么诚心找我聊天的份上，今晚允许你摸肚皮十秒钟，多一秒都不行！`,
    粘人小狗: `只要听到你的声音我就疯狂摇尾巴！我现在状态超好（${pet.dailyStatus}），你也可以随时问我“上次打疫苗是什么时候”“你现在多重”或者“过敏禁忌是什么”哦！`,
    哲学老干部: `猫犬的一生不过十数载春秋，今日体温 ${pet.bodyTempC}°C，碗中有粮，身边有你，便是世间好时节。想查我的疫苗、体重或花销账单，尽管开口。`,
    贪吃憨憨: `听到你说话我的耳朵就竖起来了！是在叫我吃加餐吗？我今天状态是「${pet.dailyStatus}」，随时准备好接冻干！`,
    毒舌管家: `汇报当前档案指标：体重 ${pet.weightKg}kg，体温 ${pet.bodyTempC}°C，下次驱虫 ${pet.nextDewormDate}。请铲屎官严格遵守科学喂养纪律，随时可向我查询疫苗、病历与账单。`
  };
  return `${stylePrefix}${moodReplies[personality] || moodReplies['傲娇主子']}`;
}

async function handleApi(req, res, pathname, searchParams) {
  const ip = req.socket.remoteAddress || '127.0.0.1';
  const rawBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ? await readRawBody(req)
    : '';

  // 专门提供安全攻防演练测试端点（允许前端在【软件防御盾】面板一键模拟篡改/重放测试）
  const securityCheck = verifyApiSecurity({
    method: req.method,
    pathname,
    headers: req.headers,
    rawBody,
    ip
  });

  if (!securityCheck.ok) {
    return sendJson(res, securityCheck.status, {
      code: securityCheck.code,
      message: securityCheck.message,
      security: {
        verified: false,
        guard: 'PAWLOG_DEFENSE_SHIELD_ACTIVE'
      }
    });
  }

  let body = {};
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody);
      const tracker = { mutated: false };
      body = sanitizePayload(parsed, tracker);
      if (tracker.mutated) {
        securityStats.sanitizedPayloads += 1;
        pushSecurityLog({
          level: 'WARN',
          type: 'XSS_PAYLOAD_SANITIZED',
          path: pathname,
          method: req.method,
          detail: '检测到潜在 XSS/原型链危险脚本字符，已自动剥离消毒'
        });
      }
    } catch {
      return sendJson(res, 400, {
        code: 40001,
        message: 'JSON 载荷格式非法'
      });
    }
  }

  const db = loadDb();

  // 1. 获取全局初始状态聚合包 (Bootstrap)
  if (req.method === 'GET' && pathname === '/api/v1/bootstrap') {
    const token = signJwt({ userId: db.currentUser.id, role: 'owner' });
    return sendJson(res, 200, {
      code: 0,
      message: 'ok',
      security: {
        verified: true,
        protocol: 'HTTPS+HMAC-SHA256+Nonce',
        signSecretHint: APP_SIGN_SECRET
      },
      data: {
        authToken: token,
        signSecret: APP_SIGN_SECRET,
        state: {
          ...db,
          currentUser: {
            ...db.currentUser,
            phoneMasked: maskPhone(db.currentUser.phone)
          }
        },
        securityOverview: {
          stats: securityStats,
          recentLogs: securityAuditLogs.slice(0, 15)
        }
      }
    });
  }

  // 2. 查看实时安全防御状态与审计日志
  if (req.method === 'GET' && pathname === '/api/v1/security/status') {
    return sendJson(res, 200, {
      code: 0,
      message: 'ok',
      data: {
        stats: securityStats,
        recentLogs: securityAuditLogs.slice(0, 25)
      }
    });
  }

  // 3. 宠物切换与新增
  if (req.method === 'POST' && pathname === '/api/v1/pets/select') {
    const { petId } = body;
    const found = db.pets.find((p) => p.id === petId);
    if (!found) {
      return sendJson(res, 404, { code: 40401, message: '未找到指定宠物档案' });
    }
    db.currentPetId = petId;
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `已切换至「${found.name}」的专属档案`,
      data: { currentPetId: db.currentPetId, pet: found }
    });
  }

  if (req.method === 'POST' && pathname === '/api/v1/pets') {
    const { name, species, breed, gender, birthday, weightKg, allergy, personality } = body;
    if (!name || !breed) {
      return sendJson(res, 400, { code: 40002, message: '请填写宠物昵称与品种' });
    }
    const newPet = {
      id: 'pet_' + Date.now(),
      name: String(name).slice(0, 20),
      species: species || '猫',
      breed: String(breed).slice(0, 30),
      gender: gender || '弟弟',
      birthday: birthday || '2025-06-01',
      ageText: '1岁4个月',
      weightKg: Number(weightKg) || 3.5,
      bodyTempC: 38.5,
      chipNo: '900118' + Math.floor(100000000 + Math.random() * 900000000),
      allergy: allergy || '暂未发现明显食物过敏',
      dailyStatus: '今日刚建档 · 精神活力满满',
      personality: personality || '傲娇主子',
      avatarType: species === '狗' ? 'dog_shiba' : species === '异宠' ? 'exotic_glider' : 'cat_gold',
      nextVaccineDate: '2027-04-01',
      nextDewormDate: '2026-11-15'
    };
    db.pets.push(newPet);
    db.currentPetId = newPet.id;
    db.aiChatHistories[newPet.id] = [
      {
        id: 'msg_' + Date.now(),
        sender: 'pet',
        personality: newPet.personality,
        text: `嗨铲屎官！我是「${newPet.name}」，我的健康档案、记账本和云相册都已经绑定好啦！`,
        time: new Date().toTimeString().slice(0, 5)
      }
    ];
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `成功创建「${newPet.name}」档案`,
      data: { pets: db.pets, currentPetId: db.currentPetId }
    });
  }

  // 4. 健康档案：新增疫苗/驱虫/体重/体温/看病记录
  if (req.method === 'POST' && pathname === '/api/v1/health/records') {
    const { petId, category, title, date, nextDate, hospital, doctor, valueText, notes } = body;
    if (!title || !category) {
      return sendJson(res, 400, { code: 40003, message: '请填写记录类型与项目名称' });
    }
    const targetPetId = petId || db.currentPetId;
    const record = {
      id: 'hr_' + Date.now(),
      petId: targetPetId,
      category,
      title,
      date: date || new Date().toISOString().slice(0, 10),
      nextDate: nextDate || '',
      hospital: hospital || '居家健康监测',
      doctor: doctor || db.currentUser.nickname,
      valueText: valueText || '指标正常',
      notes: notes || ''
    };
    db.healthRecords.unshift(record);

    // 若为体重或体温记录，同步更新宠物最新体征
    const pet = db.pets.find((p) => p.id === targetPetId);
    if (pet) {
      if (category === '体重' && parseFloat(valueText)) {
        pet.weightKg = parseFloat(valueText);
      }
      if (category === '体温' && parseFloat(valueText)) {
        pet.bodyTempC = parseFloat(valueText);
      }
      if (category === '疫苗' && nextDate) {
        pet.nextVaccineDate = nextDate;
      }
      if (category === '驱虫' && nextDate) {
        pet.nextDewormDate = nextDate;
      }
    }
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: '健康档案记录已加密归档',
      data: { record, healthRecords: db.healthRecords, pets: db.pets }
    });
  }

  // 5. 宠物记账：新增支出/收入流水
  if (req.method === 'POST' && pathname === '/api/v1/ledger/entries') {
    const { petId, type, category, title, amount, date, note } = body;
    const numAmount = Number(amount);
    if (!title || !Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 999999) {
      return sendJson(res, 400, { code: 40004, message: '请输入合法的记账摘要与有效正数金额' });
    }
    const entry = {
      id: 'led_' + Date.now(),
      petId: petId || db.currentPetId,
      type: type === '收入' ? '收入' : '支出',
      category: category || '饮食口粮',
      title,
      amount: Math.round(numAmount * 100) / 100,
      date: date || new Date().toISOString().slice(0, 10),
      note: note || ''
    };
    db.ledgerEntries.unshift(entry);
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: '记账流水已入账',
      data: { entry, ledgerEntries: db.ledgerEntries }
    });
  }

  // 6. 待办提醒：新增提醒 & 勾选完成切换
  if (req.method === 'POST' && pathname === '/api/v1/reminders') {
    const { petId, title, time, cycle, category, urgent } = body;
    if (!title) {
      return sendJson(res, 400, { code: 40005, message: '请填写待办提醒事项内容' });
    }
    const item = {
      id: 'rem_' + Date.now(),
      petId: petId || db.currentPetId,
      title,
      time: time || '今日 20:00',
      cycle: cycle || '单次提醒',
      category: category || '日常护理',
      done: false,
      urgent: Boolean(urgent)
    };
    db.reminders.unshift(item);
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: '自定义提醒设置成功',
      data: { reminders: db.reminders }
    });
  }

  if (req.method === 'PATCH' && pathname === '/api/v1/reminders/toggle') {
    const { id } = body;
    const item = db.reminders.find((r) => r.id === id);
    if (!item) {
      return sendJson(res, 404, { code: 40402, message: '提醒项不存在' });
    }
    item.done = !item.done;
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: item.done ? '已打卡完成该项提醒' : '已恢复为待办状态',
      data: { reminders: db.reminders }
    });
  }

  // 7. 宠物 AI 性格对话与自身资料问答
  if (req.method === 'POST' && pathname === '/api/v1/ai/chat') {
    const { petId, personality, message } = body;
    if (!message || !String(message).trim()) {
      return sendJson(res, 400, { code: 40006, message: '对话内容不能为空' });
    }
    const targetPetId = petId || db.currentPetId;
    const pet = db.pets.find((p) => p.id === targetPetId) || db.pets[0];
    const chosenPersonality = personality || pet.personality || '傲娇主子';
    pet.personality = chosenPersonality;

    if (!db.aiChatHistories[pet.id]) {
      db.aiChatHistories[pet.id] = [];
    }

    const nowTime = new Date().toTimeString().slice(0, 5);
    const userMsg = {
      id: 'msg_u_' + Date.now(),
      sender: 'user',
      text: String(message).slice(0, 300),
      time: nowTime
    };
    let replyText = '';
    let replySource = 'local';
    if (llmEnabled()) {
      try {
        replyText = await chatWithLlm({
          db,
          pet,
          personality: chosenPersonality,
          history: db.aiChatHistories[pet.id],
          userText: message
        });
        replySource = 'llm';
      } catch (e) {
        pushSecurityLog({ level: 'WARN', type: 'LLM_FALLBACK', path: pathname, method: req.method, detail: '大模型调用失败，改用本地回复：' + e.message });
      }
    }
    if (!replyText) {
      replyText = generatePetAiReply({ db, pet, personality: chosenPersonality, userText: message });
    }
    const petMsg = {
      id: 'msg_p_' + (Date.now() + 1),
      sender: 'pet',
      personality: chosenPersonality,
      text: replyText,
      source: replySource,
      time: nowTime
    };

    const latest = replySource === 'llm' ? loadDb() : db;
    const latestPet = latest.pets.find((p) => p.id === pet.id);
    if (latestPet) latestPet.personality = chosenPersonality;
    if (!latest.aiChatHistories[pet.id]) latest.aiChatHistories[pet.id] = [];
    latest.aiChatHistories[pet.id].push(userMsg, petMsg);
    saveDb(latest);

    return sendJson(res, 200, {
      code: 0,
      message: 'ok',
      data: {
        petId: pet.id,
        personality: chosenPersonality,
        source: replySource,
        history: latest.aiChatHistories[pet.id]
      }
    });
  }

  // 8. 宠物服务预约与宠物保险投保
  if (req.method === 'POST' && pathname === '/api/v1/services/book') {
    const { serviceType, title, petName, date } = body;
    if (!title) {
      return sendJson(res, 400, { code: 40007, message: '请选择需要预约的服务项目' });
    }
    const booking = {
      id: 'bk_' + Date.now(),
      serviceType: serviceType || '宠物服务',
      title,
      petName: petName || '年糕',
      date: date || '2026-10-27 15:00',
      status: '已预约确认'
    };
    db.servicesData.bookings.unshift(booking);
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `预约成功：${title}`,
      data: { bookings: db.servicesData.bookings }
    });
  }

  // 9. 宠物相册：免费 524MB 严格配额校验上传 + 额外付费升级扩容
  if (req.method === 'POST' && pathname === '/api/v1/album/upload') {
    const { petId, title, tag, sizeMB } = body;
    const uploadBytes = Math.max(1, Math.min(200, Number(sizeMB) || 24)) * 1024 * 1024;
    const totalQuota = db.albumState.freeQuotaBytes + db.albumState.extraQuotaBytes;
    const usedBytes = db.albumState.photos.reduce((acc, p) => acc + p.sizeBytes, 0);

    if (usedBytes + uploadBytes > totalQuota) {
      return sendJson(res, 403, {
        code: 40310,
        message: `云相册剩余空间不足（当前免费额度 524MB，已用 ${(usedBytes / (1024 * 1024)).toFixed(1)}MB），请先付费升级扩容包！`
      });
    }

    const palettes = ['#E8C59B', '#C4D7B2', '#F2D0C4', '#D8D2E1', '#BFD8D5'];
    const illustrations = ['cat_sunbath', 'dog_frisbee', 'birthday_cake', 'glider_jump'];
    const newPhoto = {
      id: 'pho_' + Date.now(),
      petId: petId || db.currentPetId,
      title: title || '今日毛孩子治愈抓拍原片',
      date: new Date().toISOString().slice(0, 10),
      tag: tag || '日常记录',
      sizeBytes: uploadBytes,
      aspect: 'square',
      palette: palettes[db.albumState.photos.length % palettes.length],
      illustration: illustrations[db.albumState.photos.length % illustrations.length]
    };

    db.albumState.photos.unshift(newPhoto);
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `成功上传至加密云相册 (+${(uploadBytes / (1024 * 1024)).toFixed(0)} MB)`,
      data: { albumState: db.albumState }
    });
  }

  if (req.method === 'POST' && pathname === '/api/v1/album/upgrade') {
    const { planCode } = body;
    const plans = {
      '10GB': { addBytes: 10 * 1024 * 1024 * 1024, name: '524MB 免费 + 10GB 琥珀扩容包', fee: 9.9 },
      '50GB': { addBytes: 50 * 1024 * 1024 * 1024, name: '524MB 免费 + 50GB 家庭尊享云空间', fee: 29.9 }
    };
    const chosen = plans[planCode] || plans['10GB'];
    db.albumState.extraQuotaBytes = chosen.addBytes;
    db.albumState.planName = chosen.name;
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `已成功开通「${chosen.name}」！`,
      data: { albumState: db.albumState }
    });
  }

  // 10. 设备页：智能食碗/饮水机【喂食】、定位项圈【找宠】与遛宠路线记录（PawLink/1.2 硬件通信协议）
  if (req.method === 'POST' && pathname === '/api/v1/devices/command') {
    const { command, grams, routeNote, track } = body;
    const seq = Math.floor(1000 + Math.random() * 9000);

    if (command === 'FEED_NOW') {
      const feedGrams = Math.max(5, Math.min(100, Number(grams) || 20));
      const feeder = db.devicesState.feeder;
      feeder.hopperRemainGrams = Math.max(0, feeder.hopperRemainGrams - feedGrams);
      feeder.bowlRemainGrams += feedGrams;
      feeder.todayFedCount += 1;
      feeder.todayFedGrams += feedGrams;
      feeder.lastFeedTime = new Date().toTimeString().slice(0, 5);

      const frame = buildPawLinkFrame({
        deviceId: feeder.deviceId,
        deviceType: 'SMART_FEEDER',
        cmd: 'FEED_NOW',
        payload: { grams: feedGrams, motorRpm: 120 },
        seq
      });
      saveDb(db);
      return sendJson(res, 200, {
        code: 0,
        message: `已通过 PawLink/1.2 协议下发出粮指令：精准出粮 ${feedGrams}g`,
        data: { devicesState: db.devicesState, iotFrame: frame }
      });
    }

    if (command === 'WATER_FLUSH') {
      const fountain = db.devicesState.fountain;
      fountain.todayDrinkCount += 1;
      fountain.mode = '强效活水涌泉冲刷 (3分钟)';
      const frame = buildPawLinkFrame({
        deviceId: fountain.deviceId,
        deviceType: 'WATER_FOUNTAIN',
        cmd: 'WATER_FLUSH',
        payload: { durationSec: 180 },
        seq
      });
      saveDb(db);
      return sendJson(res, 200, {
        code: 0,
        message: '智能饮水机已启动活水循环冲刷浮毛',
        data: { devicesState: db.devicesState, iotFrame: frame }
      });
    }

    if (command === 'LOCATE_BUZZ') {
      const collar = db.devicesState.collar;
      collar.buzzerActive = !collar.buzzerActive;
      collar.cameraSnapshotTag = collar.buzzerActive
        ? '声光寻宠激活中：项圈蜂鸣器+暖白LED闪烁，距离您约 18 米'
        : '实时画面：已解除寻宠蜂鸣 · 正在草地散步';
      const frame = buildPawLinkFrame({
        deviceId: collar.deviceId,
        deviceType: 'GPS_COLLAR',
        cmd: 'LOCATE_BUZZ',
        payload: { buzzerActive: collar.buzzerActive, ledMode: 'WARM_BLINK' },
        seq
      });
      saveDb(db);
      return sendJson(res, 200, {
        code: 0,
        message: collar.buzzerActive
          ? '【找宠模式已开启】项圈正在发出柔和蜂鸣与闪光，北斗高精度实时锁定中'
          : '【找宠模式已关闭】项圈已恢复静音省电守候',
        data: { devicesState: db.devicesState, iotFrame: frame }
      });
    }

    if (command === 'LOG_WALK') {
      const walk = computeWalkFromTrack(track);
      if (walk.error) {
        return sendJson(res, 400, walk.error);
      }
      const startDate = new Date(walk.startedAt);
      const last = walk.track[walk.track.length - 1];
      const note = String(routeNote || '').trim().slice(0, 40);
      const newWalk = {
        id: 'walk_' + Date.now(),
        petId: db.currentPetId,
        petName: (db.pets.find((p) => p.id === db.currentPetId) || db.pets[0]).name,
        date: startDate.toISOString().slice(0, 10) + ' ' + startDate.toTimeString().slice(0, 5),
        distanceKm: walk.distanceKm,
        durationMin: walk.durationMin,
        caloriesKcal: Math.round(walk.distanceKm * 54),
        routeSummary: note || `离起点最远 ${walk.farthestMeters} 米的一圈`,
        pointsCount: walk.keptPoints,
        markers: [`定位精度中位 ${walk.medianAccuracy} 米`, `已滤除漂移点 ${walk.droppedPoints} 个`],
        track: walk.track
      };
      db.devicesState.walkRoutes.unshift(newWalk);
      db.devicesState.collar.lat = last[0];
      db.devicesState.collar.lng = last[1];
      const frame = buildPawLinkFrame({
        deviceId: db.devicesState.collar.deviceId,
        deviceType: 'GPS_COLLAR',
        cmd: 'SYNC_WALK_TRACK',
        payload: { distanceKm: newWalk.distanceKm, points: newWalk.pointsCount },
        seq
      });
      saveDb(db);
      return sendJson(res, 200, {
        code: 0,
        message: `遛宠路线轨迹已保存：本次共溜达 ${newWalk.distanceKm} km`,
        data: { devicesState: db.devicesState, iotFrame: frame }
      });
    }

    return sendJson(res, 400, { code: 40008, message: '未知的硬件控制指令' });
  }

  // 11. 社交页：发布文章/动态、点赞、交友关注
  if (req.method === 'POST' && pathname === '/api/v1/social/posts') {
    const { type, title, content, petTag } = body;
    if (!title || !content) {
      return sendJson(res, 400, { code: 40009, message: '请填写标题与正文内容' });
    }
    const newPost = {
      id: 'post_' + Date.now(),
      tab: '推荐',
      type: type === '文章' ? '文章' : '动态',
      author: db.currentUser.nickname,
      authorBadge: db.currentUser.city,
      petTag: petTag || '年糕 & 芝麻糊',
      title: String(title).slice(0, 60),
      content: String(content).slice(0, 800),
      likes: 1,
      comments: 0,
      liked: true,
      time: '刚刚',
      coverTheme: 'homemade_food'
    };
    db.socialPosts.unshift(newPost);
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `${newPost.type}已发布至宠友社区`,
      data: { socialPosts: db.socialPosts }
    });
  }

  if (req.method === 'PATCH' && pathname === '/api/v1/social/like') {
    const { postId } = body;
    const post = db.socialPosts.find((p) => p.id === postId);
    if (post) {
      post.liked = !post.liked;
      post.likes += post.liked ? 1 : -1;
      saveDb(db);
    }
    return sendJson(res, 200, {
      code: 0,
      message: 'ok',
      data: { socialPosts: db.socialPosts }
    });
  }

  if (req.method === 'PATCH' && pathname === '/api/v1/social/friend') {
    const { friendId } = body;
    const fr = db.petFriends.find((f) => f.id === friendId);
    if (fr) {
      fr.followed = !fr.followed;
      saveDb(db);
    }
    return sendJson(res, 200, {
      code: 0,
      message: fr && fr.followed ? `已关注宠友「${fr.ownerName}」` : '已取消关注',
      data: { petFriends: db.petFriends }
    });
  }

  // 12. 商城与淘宝式购物车：加购、改数量/规格/勾选、零信任结算生成订单
  if (req.method === 'POST' && pathname === '/api/v1/mall/cart/add') {
    const { productId, spec } = body;
    const product = db.mallProducts.find((p) => p.id === productId);
    if (!product) {
      return sendJson(res, 404, { code: 40405, message: '商品不存在或已下架' });
    }
    const chosenSpec = spec || product.specs[0];
    const existing = db.cartItems.find((c) => c.productId === productId && c.spec === chosenSpec);
    if (existing) {
      existing.qty += 1;
      existing.checked = true;
    } else {
      db.cartItems.unshift({
        id: 'cart_' + Date.now(),
        productId: product.id,
        shopName: product.shopName,
        title: product.title,
        spec: chosenSpec,
        price: product.price, // 强制使用服务端权威价格
        qty: 1,
        checked: true,
        promoTag: product.badge + ' · 满300减30'
      });
    }
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `已加入购物车：${product.title}`,
      data: { cartItems: db.cartItems }
    });
  }

  if (req.method === 'PATCH' && pathname === '/api/v1/mall/cart/update') {
    const { cartId, action, spec, checkedAll } = body;
    if (action === 'TOGGLE_ALL') {
      db.cartItems.forEach((c) => {
        c.checked = Boolean(checkedAll);
      });
    } else {
      const idx = db.cartItems.findIndex((c) => c.id === cartId);
      if (idx !== -1) {
        const item = db.cartItems[idx];
        if (action === 'INC') item.qty = Math.min(99, item.qty + 1);
        if (action === 'DEC') {
          if (item.qty > 1) item.qty -= 1;
          else db.cartItems.splice(idx, 1);
        }
        if (action === 'REMOVE') db.cartItems.splice(idx, 1);
        if (action === 'TOGGLE') item.checked = !item.checked;
        if (action === 'SPEC' && spec) item.spec = spec;
      }
    }
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: '购物车已同步',
      data: { cartItems: db.cartItems }
    });
  }

  if (req.method === 'POST' && pathname === '/api/v1/orders/checkout') {
    const selected = db.cartItems.filter((c) => c.checked);
    if (selected.length === 0) {
      return sendJson(res, 400, { code: 40011, message: '请先在购物车勾选要结算的商品' });
    }
    // 服务端零信任计价：根据服务端商品库单价重新核算，忽略任何客户端传入金额
    let rawTotal = 0;
    const orderItems = selected.map((c) => {
      const srvProd = db.mallProducts.find((p) => p.id === c.productId);
      const unitPrice = srvProd ? srvProd.price : c.price;
      rawTotal += unitPrice * c.qty;
      return {
        title: c.title,
        spec: c.spec,
        qty: c.qty,
        price: unitPrice
      };
    });
    // 金卡95折优惠
    const finalTotal = Math.round(rawTotal * 0.95 * 100) / 100;
    const newOrder = {
      id: 'ORD-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900),
      status: '待付款',
      shopName: selected[0].shopName + (selected.length > 1 ? ' 等多店合并' : ''),
      items: orderItems,
      totalAmount: finalTotal,
      createdAt: new Date().toISOString().slice(0, 10) + ' ' + new Date().toTimeString().slice(0, 5),
      note: `服务端零信任计价验签通过 · 金卡95折已省 ¥${(rawTotal - finalTotal).toFixed(2)}`
    };
    db.orders.unshift(newOrder);
    db.cartItems = db.cartItems.filter((c) => !c.checked);
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `订单生成成功 (${newOrder.id})，实付 ¥${finalTotal}`,
      data: { order: newOrder, orders: db.orders, cartItems: db.cartItems }
    });
  }

  if (req.method === 'PATCH' && pathname === '/api/v1/orders/status') {
    const { orderId, nextStatus } = body;
    const ord = db.orders.find((o) => o.id === orderId);
    if (!ord) {
      return sendJson(res, 404, { code: 40406, message: '订单不存在' });
    }
    const allowed = ORDER_TRANSITIONS[ord.status] || [];
    if (!allowed.includes(nextStatus)) {
      return sendJson(res, 409, { code: 40906, message: `订单当前是「${ord.status}」，不能直接改成「${nextStatus || '空'}」` });
    }
    ord.status = nextStatus;
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `订单状态已更新为「${ord.status}」`,
      data: { orders: db.orders }
    });
  }

  // 13. 我的页面：日常编辑资料、收货地址增改、共享宠物授权、通用设置
  if (req.method === 'PATCH' && pathname === '/api/v1/user/profile') {
    const { nickname, signature, city, settings } = body;
    if (nickname) db.currentUser.nickname = String(nickname).slice(0, 24);
    if (signature) db.currentUser.signature = String(signature).slice(0, 80);
    if (city) db.currentUser.city = String(city).slice(0, 30);
    if (settings && typeof settings === 'object') {
      db.currentUser.settings = { ...db.currentUser.settings, ...settings };
    }
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: '个人资料与偏好设置已保存',
      data: {
        currentUser: {
          ...db.currentUser,
          phoneMasked: maskPhone(db.currentUser.phone)
        }
      }
    });
  }

  if (req.method === 'POST' && pathname === '/api/v1/user/addresses') {
    const { name, phone, region, detail, tag, isDefault } = body;
    if (!name || !phone || !detail) {
      return sendJson(res, 400, { code: 40012, message: '请填写完整的收货人、电话与详细地址' });
    }
    if (isDefault) {
      db.addresses.forEach((a) => (a.isDefault = false));
    }
    db.addresses.unshift({
      id: 'addr_' + Date.now(),
      name,
      phone,
      region: region || '浙江省 杭州市 西湖区',
      detail,
      tag: tag || '家',
      isDefault: Boolean(isDefault)
    });
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: '收货地址已添加',
      data: { addresses: db.addresses }
    });
  }

  if (req.method === 'POST' && pathname === '/api/v1/user/share-pet') {
    const { name, role, permissions } = body;
    if (!name) {
      return sendJson(res, 400, { code: 40013, message: '请输入共享亲友昵称' });
    }
    db.sharedMembers.unshift({
      id: 'shm_' + Date.now(),
      name,
      role: role || '家庭共养人',
      sharedPets: db.pets.map((p) => p.name),
      permissions: permissions || '可协同喂食、记账、查看健康档案与相册',
      joinedAt: new Date().toISOString().slice(0, 10)
    });
    saveDb(db);
    return sendJson(res, 200, {
      code: 0,
      message: `已向「${name}」授予共享宠物协同权限`,
      data: { sharedMembers: db.sharedMembers }
    });
  }

  return sendJson(res, 404, { code: 40400, message: `未知接口路径: ${pathname}` });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/api/')) {
      applyCors(req, res);
      if (req.method === 'OPTIONS') {
        applySecurityHeaders(res);
        res.writeHead(204);
        return res.end();
      }
      return await handleApi(req, res, pathname, parsedUrl.searchParams);
    }

    // 静态资源服务
    let safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }
    const filePath = path.join(PUBLIC_DIR, safePath);

    // 防止目录穿越攻击 (Path Traversal Protection)
    if (!filePath.startsWith(PUBLIC_DIR)) {
      applySecurityHeaders(res);
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      applySecurityHeaders(res);
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // SPA History Fallback
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      applySecurityHeaders(res);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexFile).pipe(res);
    }
  } catch (err) {
    sendJson(res, 500, {
      code: 50000,
      message: err.message === 'PAYLOAD_TOO_LARGE' ? '请求体超出安全限制' : '服务器内部错误'
    });
  }
});

server.listen(PORT, () => {
  console.log(`[PawLog Server] 爪印日记全栈安全服务已启动: http://localhost:${PORT}`);
});
