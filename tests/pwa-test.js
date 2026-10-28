// PWA 检查：manifest 能被浏览器解析、Service Worker 生效、断网后界面仍能打开、接口不被缓存。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const BASE = process.env.E2E_BASE || 'http://localhost:3680';
const EDGE = process.env.E2E_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9337;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pawlog-pwa-'));
  const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
  let ws;
  try {
    let t;
    for (let i = 0; i < 50 && !t; i++) {
      await sleep(200);
      try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page'); } catch {}
    }
    ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pend = {};
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result.value;
    const check = async (name, fn) => {
      try { results.push(['PASS', name, (await fn()) || '']); } catch (e) { results.push(['FAIL', name, e.message]); }
    };
    const expect = (c, m) => { if (!c) throw new Error(m); };

    await send('Page.enable');
    await send('Network.enable');
    await send('Page.navigate', { url: BASE + '/' });
    await sleep(2500);

    await check('manifest 被浏览器正确解析', async () => {
      const m = (await send('Page.getAppManifest')).result;
      expect(m.url && m.url.endsWith('/manifest.webmanifest'), '没找到 manifest：' + JSON.stringify(m).slice(0, 200));
      expect(!m.errors || m.errors.length === 0, 'manifest 有错误：' + JSON.stringify(m.errors));
      const j = JSON.parse(m.data);
      expect(j.display === 'standalone' && j.icons.some((i) => i.sizes === '512x512'), '缺 standalone 或 512 图标');
      return `${j.name} · ${j.icons.length} 个图标`;
    });

    await check('安装条件（Edge 判定）', async () => {
      const r = (await send('Page.getInstallabilityErrors')).result;
      const errs = (r && r.installabilityErrors) || [];
      expect(errs.length === 0, errs.map((e) => e.errorId).join(','));
      return '可安装';
    });

    await check('图标文件可访问', async () => {
      for (const p of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon.svg', '/sw.js']) {
        const r = await fetch(BASE + p);
        expect(r.ok, p + ' 返回 ' + r.status);
      }
    });

    await check('Service Worker 已接管页面', async () => {
      await send('Page.reload');
      await sleep(2500);
      const s = await ev(`navigator.serviceWorker.ready.then(r => ({ active: !!r.active, ctrl: !!navigator.serviceWorker.controller }))`);
      expect(s.active && s.ctrl, JSON.stringify(s));
    });

    await check('接口请求不进缓存', async () => {
      const keys = await ev(`caches.keys().then(ks => Promise.all(ks.map(k => caches.open(k).then(c => c.keys()).then(rs => rs.map(r => new URL(r.url).pathname))))).then(a => a.flat())`);
      expect(!keys.some((k) => k.startsWith('/api/')), '缓存里有接口：' + keys.join(','));
      return '缓存了 ' + keys.length + ' 个界面文件';
    });

    await check('断网后界面还能打开', async () => {
      await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      await send('Page.reload');
      await sleep(2500);
      const txt = await ev(`document.getElementById('appViewport') ? document.getElementById('appViewport').innerText : ''`);
      const hasTabbar = await ev(`!!document.querySelector('#bottomTabbar .tab-btn')`);
      await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      expect(hasTabbar, '断网后底部导航没出来');
      expect(txt.includes('连不上服务器'), '断网后没有提示连不上服务器，页面内容：' + txt.slice(0, 60));
      return '显示「连不上服务器」提示';
    });
  } finally {
    try { ws && ws.close(); } catch {}
    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    await sleep(600);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
  results.forEach((r) => console.log(r.join(' ')));
  const bad = results.filter((r) => r[0] === 'FAIL').length;
  console.log(`通过 ${results.length - bad} / ${results.length}`);
  process.exitCode = bad ? 1 : 0;
})();
