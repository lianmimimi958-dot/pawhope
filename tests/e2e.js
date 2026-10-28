// 端到端测试：无头 Edge 打开真实页面，逐个点击按钮、填写表单，再核对后台数据。
// 用法：先 `node server/index.js`，再 `node tests/e2e.js`。测试前备份数据库，结束后还原。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const BASE = process.env.E2E_BASE || 'http://localhost:3680';
const EDGE = process.env.E2E_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9335;
const DB_FILE = path.join(__dirname, '..', 'server', 'data', 'pawlog_db.json');
const SKIP_WALK = process.argv.includes('--skip-walk');

const results = [];
const pageErrors = [];
let ws;
let msgId = 0;
const pending = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function send(method, params = {}) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('CDP timeout: ' + method));
      }
    }, 20000);
  });
}

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}

async function waitFor(expr, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await ev(expr)) return true;
    } catch {}
    await sleep(100);
  }
  return false;
}

// 点击页面（或抽屉）里文字包含 text 的按钮
async function click(text, scope = '#appViewport') {
  const ok = await ev(`(() => {
    const els = [...document.querySelectorAll(${JSON.stringify(scope)} + ' button, ' + ${JSON.stringify(scope)} + ' [onclick]')];
    const el = els.find((e) => e.textContent.replace(/\\s+/g, '').includes(${JSON.stringify(text.replace(/\s+/g, ''))}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`找不到按钮「${text}」(${scope})`);
  await sleep(350);
}
async function clickSel(sel) {
  const ok = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error('找不到元素 ' + sel);
  await sleep(350);
}
async function tab(name) {
  await clickSel(`#bottomTabbar .tab-btn[data-tab="${name}"]`);
}
async function fill(values) {
  const missing = await ev(`(() => {
    const f = document.querySelector('#drawerSheet form');
    if (!f) return ['<form>'];
    const miss = [];
    const v = ${JSON.stringify(values)};
    for (const k of Object.keys(v)) {
      const el = f.elements[k];
      if (!el) { miss.push(k); continue; }
      if (el.type === 'checkbox') el.checked = !!v[k];
      else el.value = v[k];
    }
    return miss;
  })()`);
  if (missing.length) throw new Error('表单缺少字段 ' + missing.join(','));
}
async function submit() {
  await ev(`document.querySelector('#drawerSheet form').requestSubmit()`);
  await sleep(600);
}
const toastText = () => ev(`(() => { const t = document.getElementById('craftToast'); return t.classList.contains('hidden') ? '' : t.textContent; })()`);
const drawerOpen = () => ev(`!document.getElementById('drawerBackdrop').classList.contains('hidden')`);
const viewText = () => ev(`document.getElementById('appViewport').innerText`);

async function db() {
  const r = await fetch(BASE + '/api/v1/bootstrap');
  return (await r.json()).data.state;
}

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail: detail || '', ms: Date.now() - t0 });
    console.log('PASS', name, detail || '');
  } catch (e) {
    results.push({ name, ok: false, detail: e.message, ms: Date.now() - t0 });
    console.log('FAIL', name, '-', e.message);
    try { await ev(`App.closeDrawer()`); } catch {}
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function launch() {
  try {
    await fetch(`http://127.0.0.1:${PORT}/json/version`);
    throw new Error(`端口 ${PORT} 已被别的浏览器占用，先关掉它再测`);
  } catch (e) {
    if (e.message.startsWith('端口')) throw e;
  }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pawlog-e2e-'));
  const proc = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-gpu', '--window-size=390,844', 'about:blank'
  ], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error('浏览器没有启动');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      d.error ? p.reject(new Error(d.error.message)) : p.resolve(d.result);
    } else if (d.method === 'Runtime.exceptionThrown') {
      pageErrors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      pageErrors.push(d.params.args.map((a) => a.value || a.description).join(' '));
    }
  };
  await new Promise((r) => (ws.onopen = r));
  await send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation'] });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: BASE + '/' });
  if (!(await waitFor(`!!document.querySelector('#appViewport .hero')`, 10000))) throw new Error('首页没有渲染出来');
  await ev(`window.confirm = () => true`);
  return { proc, profile };
}

async function main() {
  const backup = fs.readFileSync(DB_FILE);
  let browser;
  try {
    browser = await launch();
    await run();
  } finally {
    fs.writeFileSync(DB_FILE, backup);
    try { ws && ws.close(); } catch {}
    if (browser) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(browser.proc.pid), '/T', '/F'], { stdio: 'ignore' });
      else browser.proc.kill();
      await sleep(800);
      try { fs.rmSync(browser.profile, { recursive: true, force: true }); } catch {}
    }
  }
  const failed = results.filter((r) => !r.ok);
  console.log('\n==== 结果 ====');
  console.log(`通过 ${results.length - failed.length} / ${results.length}`);
  failed.forEach((f) => console.log('  失败：' + f.name + ' - ' + f.detail));
  console.log('页面脚本错误：' + (pageErrors.length ? '\n  ' + pageErrors.join('\n  ') : '无'));
  fs.writeFileSync(path.join(__dirname, 'e2e-result.json'), JSON.stringify({ results, pageErrors }, null, 2));
  process.exitCode = failed.length || pageErrors.length ? 1 : 0;
}

async function run() {
  /* ---------- 首页 ---------- */
  await step('首页 8 个入口都能打开', async () => {
    const tiles = [['健康档案', '健康档案'], ['记账本', '支出构成'], ['待办提醒', '未完成'], ['和它聊聊', '发送'], ['宠物服务', '我的预约'], ['宠物保险', '年度保额'], ['相册', 'MB'], ['遛弯记录', '开始遛弯']];
    for (const [t, mark] of tiles) {
      await tab('home');
      await click(t);
      const txt = await viewText();
      expect(txt.includes(mark), `点「${t}」后页面里没有「${mark}」`);
    }
    return tiles.length + ' 个';
  });

  await step('健康档案：记一条体重', async () => {
    const before = await db();
    await tab('home'); await click('健康档案'); await click('记一条');
    await fill({ category: '体重', title: 'E2E 称重', valueText: '5.12', hospital: '家里' });
    await submit();
    const after = await db();
    expect(after.healthRecords.length === before.healthRecords.length + 1, '记录数没有 +1');
    const p = after.pets.find((x) => x.id === after.currentPetId);
    expect(String(p.weightKg) === '5.12', '宠物体重没有同步成 5.12，实际 ' + p.weightKg);
    expect((await viewText()).includes('E2E 称重'), '页面上没显示新记录');
    return '体重同步为 ' + p.weightKg;
  });

  await step('健康档案：分类筛选', async () => {
    await click('疫苗', '#appViewport .pills');
    const txt = await viewText();
    expect(!txt.includes('E2E 称重'), '筛选「疫苗」后仍显示体重记录');
  });

  await step('记账本：记一笔支出', async () => {
    const before = await db();
    await tab('home'); await click('记账本'); await click('记一笔');
    await fill({ type: '支出', amount: '12.5', category: '饮食口粮', title: 'E2E 猫砂' });
    await submit();
    const after = await db();
    expect(after.ledgerEntries.length === before.ledgerEntries.length + 1, '账目数没有 +1');
    expect((await viewText()).includes('E2E 猫砂'), '页面上没显示新账目');
  });

  await step('记账本：金额为 0 被拒绝', async () => {
    const before = await db();
    await click('记一笔');
    await fill({ amount: '0', title: 'E2E 零元' });
    await ev(`(() => { const f = document.querySelector('#drawerSheet form'); f.noValidate = true; f.requestSubmit(); })()`);
    await sleep(600);
    const after = await db();
    expect(after.ledgerEntries.length === before.ledgerEntries.length, '0 元账目被保存了');
    const t = await toastText();
    await ev('App.closeDrawer()');
    return '提示：' + t;
  });

  await step('待办：新建并勾选完成', async () => {
    const before = await db();
    await tab('home'); await click('待办提醒'); await click('新提醒');
    await fill({ title: 'E2E 剪指甲', time: '今日 21:00', urgent: true });
    await submit();
    let after = await db();
    expect(after.reminders.length === before.reminders.length + 1, '提醒数没有 +1');
    const r = after.reminders.find((x) => x.title === 'E2E 剪指甲');
    expect(r && !r.done, '新提醒状态不对');
    await ev(`App.toggleReminder(${JSON.stringify(r.id)})`);
    await sleep(500);
    after = await db();
    expect(after.reminders.find((x) => x.id === r.id).done, '勾选后没有变成已完成');
    expect((await viewText()).includes('已完成'), '页面没有已完成分组');
  });

  await step('和它聊聊：发消息和快捷提问', async () => {
    const before = await db();
    const pid = before.currentPetId;
    const n0 = (before.aiChatHistories[pid] || []).length;
    await tab('home'); await click('和它聊聊');
    await ev(`(() => { const f = document.querySelector('#appViewport form'); f.elements.msg.value = '今天想吃什么'; f.requestSubmit(); })()`);
    await sleep(800);
    let after = await db();
    const n1 = (after.aiChatHistories[pid] || []).length;
    expect(n1 >= n0 + 2, `消息数 ${n0} -> ${n1}，没有收到回复`);
    const reply = after.aiChatHistories[pid][n1 - 1];
    expect(reply.sender === 'pet' && reply.text, '最后一条不是宠物回复');
    await clickSel('#appViewport .quick button');
    await sleep(800);
    after = await db();
    expect((after.aiChatHistories[pid] || []).length >= n1 + 2, '快捷提问没有回复');
    return '回复：' + String(reply.text).slice(0, 30);
  });

  await step('宠物服务：预约医院、切到其它分类', async () => {
    const before = await db();
    await tab('home'); await click('宠物服务');
    await clickSel('#appViewport .svc .btn');
    await sleep(500);
    const after = await db();
    expect(after.servicesData.bookings.length === before.servicesData.bookings.length + 1, '预约数没有 +1');
    for (const t of ['美容寄养', '托运', '问诊']) {
      await click(t, '#appViewport .pills');
      expect((await ev(`document.querySelectorAll('#appViewport .svc').length`)) > 0, `「${t}」下没有服务`);
    }
  });

  await step('宠物保险：申请投保', async () => {
    const before = await db();
    await tab('home'); await click('宠物保险');
    await click('申请投保');
    const after = await db();
    expect(after.servicesData.bookings.length === before.servicesData.bookings.length + 1, '投保申请没有记录');
    await click('查看保单');
    expect(await toastText(), '查看保单没有反应');
  });

  await step('相册：上传照片', async () => {
    const before = await db();
    await tab('home'); await click('相册'); await click('上传');
    await sleep(500);
    const after = await db();
    expect(after.albumState.photos.length === before.albumState.photos.length + 1, '照片数没有 +1');
    const used = (s) => (s.albumState.photos.reduce((a, p) => a + p.sizeBytes, 0) / 1048576).toFixed(0);
    return `已用 ${used(before)} -> ${used(after)} MB`;
  });

  await step('相册：扩容', async () => {
    await tab('home'); await click('相册');
    const has = await ev(`!!document.querySelector('.quota-btns button')`);
    if (!has) return '已扩容过，按钮不显示';
    await clickSel('.quota-btns button');
    const after = await db();
    expect(after.albumState.extraQuotaBytes > 0, '扩容后空间没变化');
  });

  await step('宠物：新建、切换、切回', async () => {
    const before = await db();
    const orig = before.currentPetId;
    await tab('home'); await clickSel('#appViewport .pet-switch');
    expect(await drawerOpen(), '切换宠物抽屉没打开');
    await fill({ name: 'E2E豆豆', species: '狗', breed: '柯基', weightKg: '9' });
    await submit();
    let after = await db();
    const np = after.pets.find((p) => p.name === 'E2E豆豆');
    expect(np, '新宠物没有保存');
    await clickSel('#appViewport .pet-switch');
    await click('E2E豆豆', '#drawerSheet');
    after = await db();
    expect(after.currentPetId === np.id, '没有切换到新宠物');
    expect((await viewText()).includes('E2E豆豆'), '首页没显示新宠物');
    await clickSel('#appViewport .pet-switch');
    const origName = before.pets.find((p) => p.id === orig).name;
    await click(origName, '#drawerSheet');
    after = await db();
    expect(after.currentPetId === orig, '没有切回原宠物');
  });

  await step('首页 + 号快捷菜单', async () => {
    await tab('home');
    await ev(`App.go('home','main')`);
    await clickSel('#appViewport .top .round-btn');
    const n = await ev(`document.querySelectorAll('#drawerSheet .actions button').length`);
    expect(n === 6, '快捷菜单按钮数 ' + n);
    await click('记一笔', '#drawerSheet');
    expect(await ev(`!!document.querySelector('#drawerSheet form [name=amount]')`), '点「记一笔」没打开记账表单');
    await ev('App.closeDrawer()');
  });

  await step('首页提醒条：加到提醒', async () => {
    await tab('home');
    await ev(`App.go('home','main')`);
    const has = await ev(`[...document.querySelectorAll('#appViewport .notice button')].some(b => b.textContent.includes('加到提醒'))`);
    if (!has) return '当前没有需要提醒的计划（不显示按钮）';
    const before = await db();
    await click('加到提醒');
    const after = await db();
    expect(after.reminders.length === before.reminders.length + 1, '提醒没有加上');
    expect((await viewText()).includes('已加提醒'), '按钮没有变成已加提醒');
  });

  /* ---------- 设备 ---------- */
  await step('设备：喂食 10 克', async () => {
    const before = await db();
    await tab('device');
    await click('10', '#appViewport .feed-btns');
    const after = await db();
    const a = JSON.stringify(after.devicesState.feeder || after.devicesState);
    const b = JSON.stringify(before.devicesState.feeder || before.devicesState);
    expect(a !== b, '喂食后设备状态没变');
    return await toastText();
  });

  await step('设备：找宠蜂鸣、换水', async () => {
    await tab('device');
    await click('找宠');
    const t1 = await toastText();
    expect(t1, '找宠没有反馈');
    await click('换水');
    const t2 = await toastText();
    expect(t2, '换水没有反馈');
    return `${t1} / ${t2}`;
  });

  if (!SKIP_WALK) {
    await step('遛弯：模拟真实 GPS 走 70 秒并保存', async () => {
      const before = await db();
      const walks0 = (before.devicesState.walks || before.devicesState.walkRoutes || []).length;
      let lat = 30.2590, lng = 120.1300;
      await send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 8 });
      await tab('device');
      await click('开始遛弯');
      expect(await waitFor(`!!document.querySelector('.walk-live')`, 3000), '没有出现遛弯面板');
      for (let i = 0; i < 15; i++) {
        await sleep(5000);
        lat += 0.00012; lng += 0.00009;
        await send('Emulation.setGeolocationOverride', { latitude: lat, longitude: lng, accuracy: 8 });
      }
      await sleep(1500);
      const pts = await ev(`JSON.parse(localStorage.getItem('pawlog_walk_v1')||'{}').points?.length || 0`);
      await click('结束并保存');
      expect(await drawerOpen(), '没有弹出保存面板');
      await fill({ routeNote: 'E2E 小区一圈' });
      await submit();
      const after = await db();
      const list = after.devicesState.walks || after.devicesState.walkRoutes || [];
      const perm = await ev(`navigator.permissions.query({name:'geolocation'}).then(s => s.state)`);
      expect(list.length === walks0 + 1, `遛弯记录没有 +1（前端采到 ${pts} 个点，定位权限 ${perm}，提示：${await toastText()}）`);
      const w = list[0].routeSummary === 'E2E 小区一圈' ? list[0] : list[list.length - 1];
      expect(w.distanceKm > 0.1, '里程不对：' + w.distanceKm);
      return `前端 ${pts} 点，服务器算出 ${w.distanceKm} km / ${w.durationMin} 分钟 / ${w.pointsCount} 点`;
    });
  }

  /* ---------- 萌圈 ---------- */
  await step('萌圈：发布动态', async () => {
    const before = await db();
    await tab('social');
    await clickSel('#appViewport .fab');
    await fill({ type: '动态', title: 'E2E 第一次出门', content: '今天下楼走了一圈，很开心。' });
    await submit();
    const after = await db();
    expect(after.socialPosts.length === before.socialPosts.length + 1, '帖子数没有 +1');
    expect((await viewText()).includes('E2E 第一次出门'), '推荐流里没显示新帖');
  });

  await step('萌圈：点赞再取消', async () => {
    const before = await db();
    const p = before.socialPosts.find((x) => !x.liked) || before.socialPosts[0];
    await ev(`App.likePost(${JSON.stringify(p.id)})`); await sleep(400);
    let after = await db();
    const p1 = after.socialPosts.find((x) => x.id === p.id);
    expect(p1.liked !== p.liked && p1.likes !== p.likes, '点赞没生效');
    await ev(`App.likePost(${JSON.stringify(p.id)})`); await sleep(400);
    after = await db();
    const p2 = after.socialPosts.find((x) => x.id === p.id);
    expect(p2.liked === p.liked && p2.likes === p.likes, '取消点赞后数字没还原');
    return `${p.likes} -> ${p1.likes} -> ${p2.likes}`;
  });

  await step('萌圈：搜索、关注、食谱筛选、找朋友', async () => {
    await tab('social');
    await ev(`App.socialSearchFn('桂花')`);
    let n = await ev(`document.querySelectorAll('#appViewport .post-text, #appViewport article').length`);
    const txt = await viewText();
    expect(txt.includes('桂花'), '搜索「桂花」没有结果');
    await ev(`App.socialSearchFn('')`);
    await click('关注', '#appViewport .pills');
    await click('食谱', '#appViewport .pills');
    await click('不能吃', '#appViewport .pills');
    const t2 = await viewText();
    expect(t2.includes('葡萄') || t2.includes('巧克力'), '「别喂」筛选结果不对');
    expect(!t2.includes('鸡胸肉'), '「别喂」里出现了能吃的食物');
    await click('全部', '#appViewport .pills');
    await ev(`App.socialSearchFn('蓝莓')`);
    expect((await viewText()).includes('蓝莓'), '食谱搜索「蓝莓」没结果');
    await ev(`App.socialSearchFn('')`);
    const before = await db();
    await click('找朋友', '#appViewport .pills');
    const f = before.petFriends[0];
    await ev(`App.toggleFriend(${JSON.stringify(f.id)})`); await sleep(400);
    let after = await db();
    expect(after.petFriends[0].followed !== f.followed, '关注状态没变');
    await ev(`App.toggleFriend(${JSON.stringify(f.id)})`); await sleep(400);
    after = await db();
    expect(after.petFriends[0].followed === f.followed, '取消关注失败');
  });

  /* ---------- 商城 ---------- */
  await step('商城：分类和搜索', async () => {
    await tab('mall');
    for (const c of ['狗', '猫', '异宠', '关注的店', '全部']) {
      await click(c, '#appViewport .pills');
      const n = await ev(`document.querySelectorAll('#appViewport .good').length`);
      expect(n > 0, `「${c}」分类下没有商品`);
    }
    await ev(`App.mallSearchFn('冻干')`);
    const n = await ev(`document.querySelectorAll('#appViewport .good').length`);
    expect(n >= 1, '搜索「冻干」没结果');
    await ev(`App.mallSearchFn('')`);
  });

  let cartLine;
  await step('购物车：加购、加数量、换规格、全选', async () => {
    const before = await db();
    await tab('mall');
    await clickSel('#appViewport .good .add-btn');
    let after = await db();
    expect(after.cartItems.length >= before.cartItems.length, '加购失败');
    const totalQty = (s) => s.cartItems.reduce((a, c) => a + c.qty, 0);
    expect(totalQty(after) === totalQty(before) + 1, '购物车件数没有 +1');
    await clickSel('#appViewport .cart-fab');
    expect(await drawerOpen(), '购物车没打开');
    cartLine = after.cartItems[0];
    await ev(`App.cartUpdate(${JSON.stringify(cartLine.id)}, 'INC')`); await sleep(400);
    after = await db();
    expect(after.cartItems.find((c) => c.id === cartLine.id).qty === cartLine.qty + 1, '加数量失败');
    const prod = after.mallProducts.find((p) => p.id === cartLine.productId);
    if (prod && prod.specs.length > 1) {
      const other = prod.specs.find((s) => s !== cartLine.spec);
      await ev(`App.cartSpec(${JSON.stringify(cartLine.id)}, ${JSON.stringify(other)})`); await sleep(400);
      after = await db();
      expect(after.cartItems.find((c) => c.id === cartLine.id).spec === other, '换规格失败');
    }
    await ev(`App.cartAll(true)`); await sleep(400);
    after = await db();
    expect(after.cartItems.every((c) => c.checked), '全选失败');
    const total = await ev(`document.querySelector('#drawerSheet .cart-total b').textContent`);
    expect(!/0\.00$/.test(total), '全选后合计还是 ' + total);
    return '合计 ' + total;
  });

  let newOrderId;
  await step('结算 → 付款 → 确认使用 → 售后', async () => {
    const before = await db();
    await click('结算', '#drawerSheet');
    let after = await db();
    expect(after.orders.length > before.orders.length, '没有生成订单');
    expect(after.cartItems.filter((c) => c.checked).length === 0, '结算后购物车里还有勾选的商品');
    const fresh = after.orders.filter((o) => !before.orders.some((b) => b.id === o.id));
    newOrderId = fresh[0].id;
    expect(fresh[0].status === '待付款', '新订单状态是 ' + fresh[0].status);
    const view = await ev(`(() => { const a = document.querySelector('.tab-btn.active'); return a && a.dataset.tab; })()`);
    expect(view === 'mine', '结算后没跳到「我的」');
    for (const [btn, st] of [['去付款', '待使用'], ['确认使用', '已完成'], ['申请售后', '退款/售后']]) {
      await ev(`App.orderStatus(${JSON.stringify(newOrderId)}, ${JSON.stringify(st)})`); await sleep(500);
      after = await db();
      const o = after.orders.find((x) => x.id === newOrderId);
      expect(o.status === st, `「${btn}」后状态是 ${o.status}`);
    }
    return `${fresh.length} 个订单，金额 ${fresh.map((o) => o.totalAmount).join('+')}`;
  });

  await step('订单：不允许跳步（待付款直接改已完成）', async () => {
    const s = await db();
    const o = s.orders.find((x) => x.status === '待付款');
    if (!o) return '没有待付款订单，跳过';
    await ev(`App.orderStatus(${JSON.stringify(o.id)}, '已完成')`); await sleep(500);
    const after = await db();
    expect(after.orders.find((x) => x.id === o.id).status === '待付款', '待付款订单被直接改成了已完成');
    return '提示：' + (await toastText());
  });

  /* ---------- 我的 ---------- */
  await step('我的：订单分类筛选', async () => {
    await tab('mine');
    for (const s of ['待付款', '待使用', '已完成', '退款/售后']) {
      await click(s, '#appViewport .order-tabs');
      const tags = await ev(`[...document.querySelectorAll('#appViewport .order .tag')].map(t => t.textContent)`);
      expect(tags.every((t) => t === s), `「${s}」里出现了 ${tags.join(',')}`);
    }
    await click('全部', '#appViewport .card-head');
  });

  await step('我的：编辑资料', async () => {
    await tab('mine');
    await click('编辑');
    await fill({ nickname: 'E2E昵称', city: '杭州市 · 滨江区' });
    await submit();
    const after = await db();
    expect(after.currentUser.nickname === 'E2E昵称', '昵称没保存');
    expect((await viewText()).includes('E2E昵称'), '页面没更新昵称');
  });

  await step('我的：新增收货地址', async () => {
    const before = await db();
    await tab('mine'); await click('收货地址');
    await click('新增地址', '#drawerSheet');
    await fill({ name: 'E2E收件人', phone: '13900001111', detail: '文三路 100 号' });
    await submit();
    const after = await db();
    expect(after.addresses.length === before.addresses.length + 1, '地址数没有 +1');
    expect(await ev(`document.getElementById('drawerSheet').innerText.includes('E2E收件人')`), '地址列表没刷新');
    await ev('App.closeDrawer()');
  });

  await step('我的：邀请家人共养', async () => {
    const before = await db();
    await tab('mine'); await click('邀请家人');
    await fill({ name: 'E2E妈妈' });
    await submit();
    const after = await db();
    expect(after.sharedMembers.length === before.sharedMembers.length + 1, '共享成员没有 +1');
  });

  await step('设置：通知开关保存', async () => {
    const before = await db();
    const v0 = !!(before.currentUser.settings || {}).fenceAlert;
    await ev(`App.toggleSetting('fenceAlert', ${!v0})`); await sleep(400);
    const after = await db();
    expect(!!after.currentUser.settings.fenceAlert === !v0, '开关没有保存');
  });

  await step('设置：篡改测试、重放测试被拦截', async () => {
    await tab('mine'); await clickSel('#appViewport .top .round-btn');
    await click('篡改测试', '#drawerSheet'); await sleep(800);
    const t1 = await toastText();
    expect(/HTTP 4\d\d/.test(t1), '篡改请求没有被拒绝：' + t1);
    await tab('mine'); await clickSel('#appViewport .top .round-btn');
    await click('重放测试', '#drawerSheet'); await sleep(1200);
    const t2 = await toastText();
    expect(/HTTP 4\d\d/.test(t2), '重放请求没有被拒绝：' + t2);
    return `${t1} | ${t2}`;
  });

  await step('我的：公告、客服、协议、关于', async () => {
    for (const m of ['公告', '联系客服', '用户协议', '关于我们']) {
      await tab('mine'); await click(m, '#appViewport .menu');
      const t = await ev(`document.querySelector('#drawerSheet .doc').innerText`);
      expect(t && !t.includes('暂无内容'), `「${m}」没有内容`);
      await ev('App.closeDrawer()');
    }
  });

  await step('刷新页面后数据还在', async () => {
    await send('Page.reload');
    expect(await waitFor(`!!document.querySelector('#appViewport .hero')`, 8000), '刷新后首页没渲染');
    await tab('mine');
    expect((await viewText()).includes('E2E昵称'), '刷新后昵称丢了');
  });
}

main().catch((e) => {
  console.error('测试中断：', e);
  process.exitCode = 2;
});
