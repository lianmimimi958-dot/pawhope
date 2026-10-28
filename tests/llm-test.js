// 大模型接入测试：起一个假的 OpenAI 兼容服务，再用不同配置启动后台，检查请求内容、回复保存和失败兜底。
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { computeRequestSignature } = require('../server/security');

const DB_FILE = path.join(__dirname, '..', 'server', 'data', 'pawlog_db.json');
const MOCK_PORT = 3691;
const APP_PORT = 3692;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const captured = [];

const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    captured.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body || '{}') });
    if (req.url.startsWith('/fail')) {
      res.writeHead(500);
      return res.end('boom');
    }
    if (req.url.startsWith('/slow')) await sleep(3000);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: '哼，碗里还有粮，别想糊弄我。' } }] }));
  });
});

async function startApp(env) {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
    env: { ...process.env, PORT: String(APP_PORT), ...env },
    stdio: 'ignore'
  });
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    try {
      await fetch(`http://localhost:${APP_PORT}/api/v1/security/status`);
      return p;
    } catch {}
  }
  p.kill();
  throw new Error('后台没有启动');
}

async function chat(message) {
  const boot = await (await fetch(`http://localhost:${APP_PORT}/api/v1/bootstrap`)).json();
  const raw = JSON.stringify({ petId: boot.data.state.currentPetId, personality: '傲娇主子', message });
  const ts = String(Date.now());
  const nonce = crypto.randomBytes(12).toString('hex');
  const sig = computeRequestSignature({ method: 'POST', path: '/api/v1/ai/chat', timestamp: ts, nonce, rawBody: raw });
  const r = await fetch(`http://localhost:${APP_PORT}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Signature': sig, Authorization: 'Bearer ' + boot.data.authToken },
    body: raw
  });
  return { status: r.status, json: await r.json(), pet: boot.data.state.pets.find((p) => p.id === boot.data.state.currentPetId) };
}

async function check(name, env, fn) {
  const app = await startApp(env);
  try {
    const t0 = Date.now();
    const detail = await fn();
    results.push(['PASS', name, detail + `（${Date.now() - t0} ms）`]);
  } catch (e) {
    results.push(['FAIL', name, e.message]);
  } finally {
    app.kill();
    await sleep(300);
  }
}
const expect = (c, m) => {
  if (!c) throw new Error(m);
};

(async () => {
  const backup = fs.readFileSync(DB_FILE);
  await new Promise((r) => mock.listen(MOCK_PORT, r));
  const base = `http://localhost:${MOCK_PORT}`;
  try {
    await check('没配 Key：用本地回复', { PAWLOG_LLM_BASE_URL: '', PAWLOG_LLM_API_KEY: '', PAWLOG_LLM_MODEL: '' }, async () => {
      const n = captured.length;
      const r = await chat('你饿不饿');
      expect(r.json.code === 0, '接口报错 ' + JSON.stringify(r.json));
      expect(r.json.data.source === 'local', 'source=' + r.json.data.source);
      expect(captured.length === n, '没配 Key 却请求了上游');
      return 'source=local';
    });

    await check('配了 Key：调用大模型并保存回复', { PAWLOG_LLM_BASE_URL: base + '/v1', PAWLOG_LLM_API_KEY: 'sk-test-123', PAWLOG_LLM_MODEL: 'qwen-plus' }, async () => {
      const n = captured.length;
      const r = await chat('你饿不饿');
      expect(r.json.code === 0, '接口报错 ' + JSON.stringify(r.json));
      expect(r.json.data.source === 'llm', 'source=' + r.json.data.source);
      const req = captured[n];
      expect(req && req.url === '/v1/chat/completions', '请求地址不对：' + (req && req.url));
      expect(req.auth === 'Bearer sk-test-123', 'Authorization 头不对');
      expect(req.body.model === 'qwen-plus', 'model 不对');
      const sys = req.body.messages[0];
      expect(sys.role === 'system' && sys.content.includes(r.pet.name) && sys.content.includes(String(r.pet.weightKg)), '系统提示里没有宠物资料');
      expect(sys.content.includes('傲娇主子'), '系统提示里没有性格');
      const last = req.body.messages[req.body.messages.length - 1];
      expect(last.role === 'user' && last.content === '你饿不饿', '最后一条不是用户消息');
      expect(req.body.messages.length > 2, '没有带上历史对话');
      const h = r.json.data.history;
      const reply = h[h.length - 1];
      expect(reply.text === '哼，碗里还有粮，别想糊弄我。' && reply.source === 'llm', '回复没保存');
      expect(h[h.length - 2].text === '你饿不饿', '用户消息没保存');
      return `带了 ${req.body.messages.length - 2} 条历史`;
    });

    await check('上游 500：退回本地回复', { PAWLOG_LLM_BASE_URL: base + '/fail', PAWLOG_LLM_API_KEY: 'sk', PAWLOG_LLM_MODEL: 'm' }, async () => {
      const r = await chat('你多重');
      expect(r.json.code === 0, '接口报错');
      expect(r.json.data.source === 'local', 'source=' + r.json.data.source);
      return '回复：' + r.json.data.history.slice(-1)[0].text.slice(0, 20);
    });

    await check('上游超时：按时退回本地回复', { PAWLOG_LLM_BASE_URL: base + '/slow', PAWLOG_LLM_API_KEY: 'sk', PAWLOG_LLM_MODEL: 'm', PAWLOG_LLM_TIMEOUT_MS: '1000' }, async () => {
      const t0 = Date.now();
      const r = await chat('你好');
      const ms = Date.now() - t0;
      expect(r.json.data.source === 'local', 'source=' + r.json.data.source);
      expect(ms < 2500, '超时没生效，等了 ' + ms + ' ms');
      return '用时 ' + ms + ' ms';
    });

    await check('等大模型时别的写入不会被覆盖', { PAWLOG_LLM_BASE_URL: base + '/slow', PAWLOG_LLM_API_KEY: 'sk', PAWLOG_LLM_MODEL: 'm', PAWLOG_LLM_TIMEOUT_MS: '5000' }, async () => {
      const pending = chat('慢一点回答');
      await sleep(800);
      const boot = await (await fetch(`http://localhost:${APP_PORT}/api/v1/bootstrap`)).json();
      const raw = JSON.stringify({ type: '支出', amount: 3.3, category: '饮食口粮', title: '并发测试账目', date: '2026-10-26' });
      const ts = String(Date.now());
      const nonce = crypto.randomBytes(12).toString('hex');
      const sig = computeRequestSignature({ method: 'POST', path: '/api/v1/ledger/entries', timestamp: ts, nonce, rawBody: raw });
      const lr = await fetch(`http://localhost:${APP_PORT}/api/v1/ledger/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Signature': sig, Authorization: 'Bearer ' + boot.data.authToken },
        body: raw
      });
      expect((await lr.json()).code === 0, '记账失败');
      const r = await pending;
      expect(r.json.data.source === 'llm', 'source=' + r.json.data.source);
      const after = await (await fetch(`http://localhost:${APP_PORT}/api/v1/bootstrap`)).json();
      expect(after.data.state.ledgerEntries.some((e) => e.title === '并发测试账目'), '聊天写库时把并发的记账覆盖掉了');
      return '记账保留';
    });
  } finally {
    fs.writeFileSync(DB_FILE, backup);
    mock.close();
  }
  results.forEach((r) => console.log(r.join(' ')));
  const bad = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`通过 ${results.length - bad} / ${results.length}`);
  process.exitCode = bad ? 1 : 0;
})();
