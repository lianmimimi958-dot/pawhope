(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  const money = (n) => '¥' + Number(n || 0).toFixed(2);
  const fmtMB = (b) => Number(b || 0) / 1048576;
  const pad = (n) => String(n).padStart(2, '0');

  let S = null;
  let lastView = '';
  const UI = {
    tab: 'home',
    homeSub: 'main',
    healthFilter: '全部',
    serviceTab: '医院',
    socialTab: '推荐',
    socialSearch: '',
    foodFilter: '全部',
    foodSearch: '',
    mallCat: '全部',
    mallSearch: '',
    orderFilter: '全部',
    aiPersonality: ''
  };

  const PERSONAS = ['傲娇主子', '粘人小狗', '哲学老干部', '贪吃憨憨', '毒舌管家'];
  const QUICK = ['你上次打疫苗是什么时候？', '你现在多重？', '你对什么过敏？', '最近在你身上花了多少钱？', '你饿不饿？'];
  const SOFT = ['#e5f5ef', '#fdece6', '#f7eedc', '#e6f0fa', '#ecebf7'];
  const SOFT_INK = ['#1f7a68', '#d4664a', '#b07d2b', '#3f72a8', '#6c66a8'];

  /* ---------- 线条图标 ---------- */
  const ICON = {
    plus: 'M12 5v14 M5 12h14',
    close: 'M6 6l12 12 M18 6L6 18',
    back: 'M15 5l-7 7 7 7',
    right: 'M9 6l6 6-6 6',
    down: 'M6 9l6 6 6-6',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4',
    health: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z M8 12.5h2.2l1.3-2 2 3.6 1.3-1.6h1.4',
    ledger: 'M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6 M9 16h3',
    bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0',
    chat: 'M4 5h16v11H9.5L4 20z M8.5 10.5h.01 M12 10.5h.01 M15.5 10.5h.01',
    hospital: 'M4 20V8.5L12 4l8 4.5V20z M12 9.5v6 M9 12.5h6',
    shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z M9 12l2.2 2.2L15.5 10',
    camera: 'M4 8h3.2l2-3h5.6l2 3H20v11H4z M12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M8 17h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
    scale: 'M5 20h14l-1.6-12H6.6z M9 8a3 3 0 0 1 6 0 M12 11v3',
    temp: 'M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z M12 9v7',
    bowl: 'M3 12h18a9 6 0 0 1-18 0z M9 9c0-1.6.8-2.8 2-3.8 M13.5 9c0-1.6.8-2.8 2-3.8',
    drop: 'M12 3.5s6 6.8 6 10.8a6 6 0 0 1-12 0c0-4 6-10.8 6-10.8z',
    syringe: 'M15 3l6 6 M18 6l-9.5 9.5-4 1 1-4L15 3 M7.5 13.5l3 3 M3 21l3-3',
    pill: 'M8.5 15.5l7-7a3.5 3.5 0 0 1 5 5l-7 7a3.5 3.5 0 0 1-5-5z M12 12l5 5 M3.5 9.5h6 M6.5 6.5v6',
    pin: 'M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    cart: 'M3 4h2.2l2.3 11h10.8L20.5 7.5H6.4 M8.8 20.5a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0 M16 20.5a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0',
    heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
    comment: 'M4 5h16v11H9.5L4 20z',
    wallet: 'M4 7h15v12H4z M4 7l11-3v3 M15.5 13h2',
    ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z M10 7v10',
    check: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12l3 3 5-5.5',
    refund: 'M4.5 12a7.5 7.5 0 1 0 2.4-5.5 M4 4v4h4',
    people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 19.5c.6-3 3-5 6-5s5.4 2 6 5 M15.5 11a2.5 2.5 0 1 0 0-5 M17 14.2c2 .4 3.4 2.2 4 5',
    sliders: 'M4 7h10 M18 7h2 M16 5v4 M4 17h4 M12 17h8 M10 15v4',
    lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3 M12 14.5v2.5',
    doc: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5',
    phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
    megaphone: 'M4 10v4h3l7 4V6L7 10z M18 9a4 4 0 0 1 0 6',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 7.8h.01',
    edit: 'M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4',
    store: 'M4 9l1.5-5h13L20 9 M4 9v11h16V9 M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3',
    gift: 'M4 10h16v4H4z M5 14h14v6H5z M12 10v10 M12 10c-1.5-3-5-3.5-5-1.3S10 10 12 10c2 0 5-.3 5-1.3S13.5 7 12 10z',
    flame: 'M12 21c3.8 0 6-2.6 6-6 0-4-3-5.5-4-9-2 1.5-3 3.6-2.6 6-1.4-.6-2.2-1.8-2.4-3C7.4 10.6 6 12.6 6 15c0 3.4 2.2 6 6 6z',
    sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 2.5v2 M12 19.5v2 M4.6 4.6l1.4 1.4 M18 18l1.4 1.4 M2.5 12h2 M19.5 12h2 M4.6 19.4L6 18 M18 6l1.4-1.4'
  };
  const icon = (name, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[name] || ''}"/></svg>`;

  /* ---------- 扁平宠物插画 ---------- */
  const OUT = 'stroke="#6b4a33" stroke-width="2.2" stroke-linejoin="round"';
  function dogArt() {
    return `<svg class="pet-art" viewBox="0 0 160 160" aria-hidden="true">
      <path d="M118 128c18 2 26-12 20-26" fill="none" stroke="#e8b46a" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="80" cy="124" rx="38" ry="30" fill="#f1c27d" ${OUT}/>
      <ellipse cx="80" cy="130" rx="19" ry="17" fill="#fbe5bd"/>
      <ellipse cx="62" cy="151" rx="11" ry="6" fill="#f1c27d" ${OUT}/>
      <ellipse cx="98" cy="151" rx="11" ry="6" fill="#f1c27d" ${OUT}/>
      <path d="M54 98c16 10 36 10 52 0" fill="none" stroke="#ef8466" stroke-width="7" stroke-linecap="round"/>
      <circle cx="80" cy="106" r="5" fill="#3fb59d" stroke="#1f7a68" stroke-width="1.5"/>
      <circle cx="80" cy="66" r="36" fill="#f1c27d" ${OUT}/>
      <path d="M50 44c-15 2-21 22-15 40 4 10 14 8 18-2 4-12 4-28-3-38z" fill="#d9984f" ${OUT}/>
      <path d="M110 44c15 2 21 22 15 40-4 10-14 8-18-2-4-12-4-28 3-38z" fill="#d9984f" ${OUT}/>
      <ellipse cx="80" cy="82" rx="16" ry="12" fill="#fbe5bd"/>
      <ellipse cx="80" cy="76" rx="6" ry="4.4" fill="#3a2a22"/>
      <path d="M74 85c3 4 9 4 12 0" fill="none" stroke="#3a2a22" stroke-width="2" stroke-linecap="round"/>
      <circle cx="66" cy="64" r="4.2" fill="#3a2a22"/><circle cx="94" cy="64" r="4.2" fill="#3a2a22"/>
      <circle cx="67.4" cy="62.6" r="1.3" fill="#fff"/><circle cx="95.4" cy="62.6" r="1.3" fill="#fff"/>
      <circle cx="58" cy="76" r="5" fill="#f3a48f" opacity=".55"/><circle cx="102" cy="76" r="5" fill="#f3a48f" opacity=".55"/>
    </svg>`;
  }
  function catArt() {
    return `<svg class="pet-art" viewBox="0 0 160 160" aria-hidden="true">
      <path d="M110 136c24 0 28-24 14-32" fill="none" stroke="#e3b57a" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="80" cy="126" rx="34" ry="28" fill="#efcb95" ${OUT}/>
      <ellipse cx="80" cy="132" rx="17" ry="15" fill="#faead0"/>
      <ellipse cx="64" cy="152" rx="10" ry="5.5" fill="#efcb95" ${OUT}/>
      <ellipse cx="96" cy="152" rx="10" ry="5.5" fill="#efcb95" ${OUT}/>
      <path d="M48 54 44 20l26 18z" fill="#efcb95" ${OUT}/>
      <path d="M112 54l4-34-26 18z" fill="#efcb95" ${OUT}/>
      <path d="M51 46 49 30l12 9z" fill="#f3a48f"/><path d="M109 46l2-16-12 9z" fill="#f3a48f"/>
      <ellipse cx="80" cy="70" rx="38" ry="32" fill="#efcb95" ${OUT}/>
      <path d="M70 42c3 5 7 7 10 7s7-2 10-7" fill="none" stroke="#d9a15a" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="80" cy="83" rx="13" ry="9" fill="#faead0"/>
      <ellipse cx="65" cy="68" rx="4" ry="5" fill="#3a2a22"/><ellipse cx="95" cy="68" rx="4" ry="5" fill="#3a2a22"/>
      <circle cx="66.2" cy="66.4" r="1.3" fill="#fff"/><circle cx="96.2" cy="66.4" r="1.3" fill="#fff"/>
      <path d="M76 78h8l-4 4z" fill="#e2826b"/>
      <path d="M80 82v3 M80 85c-2 3-6 3-7 0 M80 85c2 3 6 3 7 0" fill="none" stroke="#3a2a22" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M40 76l14 2 M40 84l14-1 M120 76l-14 2 M120 84l-14-1" stroke="#a07a55" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="56" cy="80" r="4.5" fill="#f3a48f" opacity=".5"/><circle cx="104" cy="80" r="4.5" fill="#f3a48f" opacity=".5"/>
    </svg>`;
  }
  function gliderArt() {
    return `<svg class="pet-art" viewBox="0 0 160 160" aria-hidden="true">
      <path d="M104 140c28 4 36-14 26-30" fill="none" stroke="#a9a3bd" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="80" cy="124" rx="31" ry="28" fill="#c3bdd3" ${OUT}/>
      <ellipse cx="80" cy="130" rx="17" ry="17" fill="#f6efe2"/>
      <circle cx="46" cy="48" r="18" fill="#c3bdd3" ${OUT}/><circle cx="114" cy="48" r="18" fill="#c3bdd3" ${OUT}/>
      <circle cx="46" cy="48" r="10" fill="#f3b3a3"/><circle cx="114" cy="48" r="10" fill="#f3b3a3"/>
      <circle cx="80" cy="76" r="33" fill="#c3bdd3" ${OUT}/>
      <path d="M80 44v26" stroke="#5e5873" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="80" cy="90" rx="15" ry="11" fill="#f6efe2"/>
      <circle cx="65" cy="74" r="7" fill="#2f2a3a"/><circle cx="95" cy="74" r="7" fill="#2f2a3a"/>
      <circle cx="67" cy="71.5" r="2.2" fill="#fff"/><circle cx="97" cy="71.5" r="2.2" fill="#fff"/>
      <ellipse cx="80" cy="86" rx="3.5" ry="2.6" fill="#e2826b"/>
      <path d="M76 91c2 2 6 2 8 0" fill="none" stroke="#2f2a3a" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }
  function petArt(species) {
    if (species === '狗') return dogArt();
    if (species === '异宠') return gliderArt();
    return catArt();
  }
  function speciesFromText(t) {
    const s = String(t || '');
    if (/蜜袋鼯|异宠|兔|爬宠/.test(s)) return '异宠';
    if (/狗|犬|金毛|柴|柯基|泰迪/.test(s)) return '狗';
    if (/猫|布偶|橘|英短|德文/.test(s)) return '猫';
    return '';
  }

  /* ---------- 商品插画 ---------- */
  function goodsArt(p) {
    const t = String((p && (p.title || '')) || '');
    if (/冻干|钙粉|蜜粮|营养膏/.test(t)) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="28" y="22" width="44" height="12" rx="4" fill="#1f7a68"/><rect x="24" y="32" width="52" height="54" rx="10" fill="#fff" stroke="#1f7a68" stroke-width="2.5"/><rect x="32" y="48" width="36" height="20" rx="5" fill="#fdece6"/><circle cx="50" cy="58" r="5" fill="#ef8466"/></svg>`;
    }
    if (/驱|心保|药/.test(t)) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="18" y="30" width="64" height="44" rx="8" fill="#fff" stroke="#3f72a8" stroke-width="2.5"/><path d="M18 44h64" stroke="#3f72a8" stroke-width="2.5"/><rect x="40" y="52" width="20" height="14" rx="7" fill="#ef8466"/><path d="M50 52v14" stroke="#fff" stroke-width="2"/></svg>`;
    }
    if (/睡袋|站架|窝|木/.test(t)) {
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M18 50 50 24l32 26v32H18z" fill="#fff" stroke="#b07d2b" stroke-width="2.5" stroke-linejoin="round"/><path d="M40 82V62a10 10 0 0 1 20 0v20" fill="#f7eedc" stroke="#b07d2b" stroke-width="2.5"/></svg>`;
    }
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M30 24h40l6 62H24z" fill="#fff" stroke="#1f7a68" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 24c0-6 4-9 8-9h24c4 0 8 3 8 9" fill="none" stroke="#1f7a68" stroke-width="2.5"/><circle cx="50" cy="52" r="10" fill="#e5f5ef" stroke="#3fb59d" stroke-width="2"/><path d="M44 52h12 M50 46v12" stroke="#3fb59d" stroke-width="2"/><path d="M36 72h28" stroke="#ef8466" stroke-width="3" stroke-linecap="round"/></svg>`;
  }

  /* ---------- 小工具 ---------- */
  function pet() {
    const list = (S && S.pets) || [];
    return list.find((p) => p.id === S.currentPetId) || list[0] || {};
  }
  function daysUntil(s) {
    const t = Date.parse(s);
    if (!Number.isFinite(t)) return null;
    return Math.ceil((t - Date.now()) / 86400000);
  }
  function hash(str) {
    let h = 2166136261;
    for (const ch of String(str)) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function softOf(key) {
    const i = hash(key) % SOFT.length;
    return { bg: SOFT[i], fg: SOFT_INK[i] };
  }
  function avatar(name) {
    const c = softOf(name);
    return `<span class="avatar" style="background:${c.bg};color:${c.fg}">${esc(String(name || '?').slice(0, 1))}</span>`;
  }
  function splitBreed(b) {
    const parts = String(b || '').split(/\s*·\s*/);
    return { main: parts[0] || '', sub: parts.slice(1).join(' · ') };
  }
  function shortDate(s) {
    return String(s || '').slice(5, 10).replace('-', '.');
  }
  function subTop(title, right = '') {
    return `<header class="sub-top"><button class="back" onclick="App.go('home','main')" aria-label="返回">${icon('back', 'ic-sm')}</button><h2>${esc(title)}</h2><div class="right">${right}</div></header>`;
  }

  function trackSvg(track, cls, W, H) {
    const pts = (track || []).filter((p) => Array.isArray(p) && Number.isFinite(+p[0]) && Number.isFinite(+p[1]));
    if (pts.length < 2) return '';
    const k = Math.cos((+pts[0][0] * Math.PI) / 180);
    const xy = pts.map((p) => [+p[1] * k, -p[0]]);
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const dx = Math.max(...xs) - minX;
    const dy = Math.max(...ys) - minY;
    const padPx = 8;
    const s = Math.min((W - padPx * 2) / (dx || 1e-9), (H - padPx * 2) / (dy || 1e-9));
    const ox = (W - dx * s) / 2;
    const oy = (H - dy * s) / 2;
    const proj = xy.map((p) => [((p[0] - minX) * s + ox).toFixed(1), ((p[1] - minY) * s + oy).toFixed(1)]);
    const line = proj.map((p) => p.join(',')).join(' ');
    const a = proj[0];
    const b = proj[proj.length - 1];
    return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline class="trk-halo" points="${line}"/><polyline class="trk-line" points="${line}"/><circle class="trk-start" cx="${a[0]}" cy="${a[1]}" r="3.6"/><circle class="trk-end" cx="${b[0]}" cy="${b[1]}" r="4.2"/></svg>`;
  }

  /* ---------- 遛弯：真实定位轨迹 ---------- */
  const WALK_KEY = 'pawlog_walk_v1';
  let WALK = null;
  let walkTimer = null;

  function geoMeters(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b[0] - a[0]) * rad;
    const dLng = (b[1] - a[1]) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function walkMeters(points) {
    const good = points.filter((p) => p[3] <= 50);
    if (good.length < 2) return 0;
    let m = 0;
    let anchor = good[0];
    for (const p of good) {
      const d = geoMeters(anchor, p);
      if (d >= 3) {
        m += d;
        anchor = p;
      }
    }
    return m;
  }
  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    return (h ? h + ':' : '') + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  }
  function saveWalk() {
    try {
      if (WALK) {
        const { startedAt, points, paused, pausedAt } = WALK;
        localStorage.setItem(WALK_KEY, JSON.stringify({ startedAt, points, paused, pausedAt }));
      } else {
        localStorage.removeItem(WALK_KEY);
      }
    } catch (e) {}
  }
  const WAIT_TEXT = '正在等第一个定位点，到室外并保持页面打开会更快';
  function walkPanelHTML() {
    if (!WALK) return '';
    const last = WALK.points[WALK.points.length - 1];
    const live = trackSvg(WALK.points, 'wl-track', 320, 150);
    return `
      <div class="walk-live">
        <div class="wl-head"><span>${WALK.paused ? '已暂停，等你出票' : '正在记录轨迹'}</span><b id="wlClock">${clock((WALK.pausedAt || Date.now()) - WALK.startedAt)}</b></div>
        <div class="wl-map" id="wlMap">${live || `<p class="wl-wait">${esc(WALK.error || WAIT_TEXT)}</p>`}</div>
        <div class="wl-stats">
          <div><b id="wlKm">${(walkMeters(WALK.points) / 1000).toFixed(2)}</b><span>公里</span></div>
          <div><b id="wlPts">${WALK.points.length}</b><span>定位点</span></div>
          <div><b id="wlAcc">${last ? Math.round(last[3]) : '—'}</b><span>精度(米)</span></div>
        </div>
        <div class="wl-btns">
          <button class="btn btn-ghost" onclick="App.cancelWalk()">放弃</button>
          <button class="btn btn-solid" onclick="App.stopWalk()">结束并保存</button>
        </div>
      </div>`;
  }
  function refreshWalkPanel() {
    if (!WALK) return;
    const clockEl = document.getElementById('wlClock');
    if (!clockEl) return;
    clockEl.textContent = clock((WALK.pausedAt || Date.now()) - WALK.startedAt);
    const last = WALK.points[WALK.points.length - 1];
    document.getElementById('wlKm').textContent = (walkMeters(WALK.points) / 1000).toFixed(2);
    document.getElementById('wlPts').textContent = WALK.points.length;
    document.getElementById('wlAcc').textContent = last ? Math.round(last[3]) : '—';
    const live = trackSvg(WALK.points, 'wl-track', 320, 150);
    document.getElementById('wlMap').innerHTML = live || `<p class="wl-wait">${esc(WALK.error || WAIT_TEXT)}</p>`;
  }
  function onWalkPosition(pos) {
    if (!WALK) return;
    const c = pos.coords;
    const t = Math.round(pos.timestamp || Date.now());
    const last = WALK.points[WALK.points.length - 1];
    if (last && t <= last[2]) return;
    if (!(c.accuracy <= 100)) return;
    WALK.error = '';
    WALK.points.push([+c.latitude.toFixed(7), +c.longitude.toFixed(7), t, Math.round(c.accuracy)]);
    if (WALK.points.length > 3900) WALK.points.splice(1, 1);
    if (WALK.points.length % 5 === 0 || WALK.points.length < 5) saveWalk();
    refreshWalkPanel();
  }
  function onWalkError(err) {
    if (!WALK) return;
    const msg = {
      1: '没有定位权限：请在浏览器地址栏允许获取位置',
      2: '暂时拿不到位置，还在继续尝试',
      3: '定位超时，还在继续尝试'
    }[err && err.code] || '定位出错，还在继续尝试';
    WALK.error = msg;
    refreshWalkPanel();
    if (err && err.code === 1) toast(msg);
  }
  function beginWatch() {
    WALK.paused = false;
    WALK.pausedAt = 0;
    WALK.watchId = navigator.geolocation.watchPosition(onWalkPosition, onWalkError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    });
    clearInterval(walkTimer);
    walkTimer = setInterval(refreshWalkPanel, 1000);
  }
  function endWatch() {
    if (WALK && WALK.watchId != null) {
      navigator.geolocation.clearWatch(WALK.watchId);
      WALK.watchId = null;
    }
    clearInterval(walkTimer);
    walkTimer = null;
  }
  function restoreWalk() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(WALK_KEY) || 'null');
    } catch (e) {}
    if (!saved || !Array.isArray(saved.points) || !Number.isFinite(saved.startedAt)) return;
    if (Date.now() - saved.startedAt > 12 * 3600000) {
      saveWalk();
      return;
    }
    WALK = { startedAt: saved.startedAt, points: saved.points, watchId: null, error: '' };
    if (saved.paused || geoAvailable()) {
      WALK.paused = true;
      WALK.pausedAt = saved.pausedAt || Date.now();
      toast('上次的遛弯还没保存');
    } else {
      beginWatch();
      toast('继续记录上次没结束的遛弯');
    }
  }
  function geoAvailable() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return '这个浏览器不支持定位';
    if (typeof isSecureContext !== 'undefined' && !isSecureContext) return '定位只能在 HTTPS 或 localhost 下使用';
    return '';
  }

  /* ---------- 基础交互 ---------- */
  function toast(msg) {
    const t = $('#craftToast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.add('hidden'), 2600);
  }
  function openDrawer(html) {
    $('#drawerSheet').innerHTML = html;
    $('#drawerBackdrop').classList.remove('hidden');
  }
  function closeDrawer() {
    $('#drawerBackdrop').classList.add('hidden');
  }
  function sheetHead(title) {
    return `<div class="sheet-head"><h3>${esc(title)}</h3><button class="sheet-close" onclick="App.closeDrawer()" aria-label="关闭">${icon('close', 'ic-sm')}</button></div>`;
  }
  async function api(method, path, payload) {
    try {
      const r = await PawSecuritySDK.request(method, path, payload);
      if (r.code !== 0) {
        toast(r.message || '没有成功，请稍后再试');
        return null;
      }
      return r;
    } catch (e) {
      toast('网络连接失败，请稍后再试');
      return null;
    }
  }
  async function reloadState() {
    const res = await fetch(PawSecuritySDK.url('/api/v1/bootstrap'));
    const j = await res.json();
    PawSecuritySDK.configure({ signSecret: j.data.signSecret, authToken: j.data.authToken });
    S = j.data.state;
  }
  function tomorrowAt(hh) {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hh}`;
  }

  /* ==================== 首页 ==================== */
  function heroHTML(p, small) {
    const b = splitBreed(p.breed);
    const rem = (S.reminders || []).filter((r) => r.petId === p.id);
    const done = rem.filter((r) => r.done).length;
    const pct = rem.length ? Math.round((done / rem.length) * 100) : 0;
    const meta = small
      ? `<li>${icon('scale', 'ic-sm')}${esc(p.weightKg)} kg</li><li>${icon('syringe', 'ic-sm')}下次疫苗 ${esc(/\d{4}-\d{2}-\d{2}/.test(p.nextVaccineDate) ? shortDate(p.nextVaccineDate) : p.nextVaccineDate || '未定')}</li>`
      : `<li>${icon('heart', 'ic-sm')}${esc(p.gender || '')}</li><li>${icon('scale', 'ic-sm')}${esc(p.weightKg)} kg</li>`;
    return `
      <section class="hero ${small ? 'hero-sm' : ''}">
        <div class="hero-text">
          <div class="hero-pills"><span>${esc(p.name)}</span><span>${esc(p.ageText || '')}</span></div>
          <h1>${esc(b.main)}</h1>
          ${b.sub ? `<p class="sub">${esc(b.sub)}</p>` : ''}
          <ul class="hero-meta">${meta}</ul>
        </div>
        <div class="hero-art">${petArt(p.species)}</div>
        ${
          small
            ? ''
            : `<div class="hero-foot"><span>待办 ${done}/${rem.length}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`
        }
      </section>`;
  }

  function planAlert(p) {
    const dw = daysUntil(p.nextDewormDate);
    if (dw !== null && dw <= 20) {
      return {
        kind: 'deworm',
        title: dw >= 0 ? `离下次驱虫还有 ${dw} 天` : `驱虫已经晚了 ${-dw} 天`,
        sub: `计划日期 ${p.nextDewormDate}`,
        key: '驱虫',
        date: p.nextDewormDate
      };
    }
    const vc = daysUntil(p.nextVaccineDate);
    if (vc !== null && vc <= 30) {
      return {
        kind: 'vaccine',
        title: vc >= 0 ? `离加强针还有 ${vc} 天` : `疫苗已经晚了 ${-vc} 天`,
        sub: `计划日期 ${p.nextVaccineDate}`,
        key: '疫苗',
        date: p.nextVaccineDate
      };
    }
    return null;
  }

  function homeMain(p) {
    const dev = S.devicesState || {};
    const f = dev.feeder || {};
    const w = dev.fountain || {};
    const rem = (S.reminders || []).filter((r) => r.petId === p.id);
    const pending = rem.filter((r) => !r.done).slice(0, 3);
    const bills = (S.ledgerEntries || []).filter((e) => e.petId === p.id).slice(0, 3);
    const alert = planAlert(p);
    const hasPlan = alert && rem.some((r) => !r.done && r.title.includes(alert.key));
    const tiles = [
      ['health', '健康档案', "App.go('home','health')"],
      ['ledger', '记账本', "App.go('home','ledger')"],
      ['bell', '待办提醒', "App.go('home','reminders')"],
      ['chat', '和它聊聊', "App.go('home','ai')"],
      ['hospital', '宠物服务', "App.openService('医院')"],
      ['shield', '宠物保险', "App.openService('保险')"],
      ['camera', '相册', "App.go('home','album')"],
      ['route', '遛弯记录', "App.go('device')"]
    ];
    return `
      <header class="top">
        <button class="pet-switch" onclick="App.petSwitcher()">
          <span class="av">${petArt(p.species)}</span><b>${esc(p.name)}</b>${icon('down', 'ic-sm')}
        </button>
        <button class="round-btn" onclick="App.quickAdd()" aria-label="新增">${icon('plus')}</button>
      </header>
      ${heroHTML(p, false)}
      <section class="metrics">
        <div class="metric">${icon('scale')}<b>${esc(p.weightKg)}<small>kg</small></b><span>体重</span></div>
        <div class="metric">${icon('temp')}<b>${esc(p.bodyTempC)}<small>°C</small></b><span>体温</span></div>
        <div class="metric">${icon('bowl')}<b>${f.todayEatenGrams == null ? '—' : f.todayEatenGrams}<small>g</small></b><span>今日进食</span></div>
        <div class="metric">${icon('drop')}<b>${w.todayDrinkMl == null ? '—' : w.todayDrinkMl}<small>ml</small></b><span>今日饮水</span></div>
      </section>
      ${
        alert
          ? `<div class="notice">${icon(alert.kind === 'deworm' ? 'pill' : 'syringe')}<div><b>${esc(alert.title)}</b><p>${esc(alert.sub)}</p></div>${
              hasPlan
                ? '<span class="tag tag-mint">已加提醒</span>'
                : `<button class="btn btn-coral" onclick="App.addPlanReminder('${alert.kind}')">加到提醒</button>`
            }</div>`
          : ''
      }
      <section class="grid">
        ${tiles.map((t) => `<button onclick="${t[2]}"><span class="gi">${icon(t[0])}</span>${t[1]}</button>`).join('')}
      </section>
      <section class="card">
        <div class="card-head"><h3>待办</h3><button class="more" onclick="App.go('home','reminders')">全部${icon('right', 'ic-sm')}</button></div>
        <div class="rows">
          ${
            pending
              .map(
                (r) => `
            <label class="row">
              <input class="chk" type="checkbox" onchange="App.toggleReminder('${esc(r.id)}')" />
              <div class="row-main"><b>${esc(r.title)}</b><p>${esc(r.time)} · ${esc(r.cycle)}</p></div>
              ${r.urgent ? '<span class="tag tag-coral">要紧</span>' : ''}
            </label>`
              )
              .join('') || '<p class="empty">今天没有要做的事</p>'
          }
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h3>最近花销</h3><button class="more" onclick="App.go('home','ledger')">账本${icon('right', 'ic-sm')}</button></div>
        <div class="rows">
          ${
            bills
              .map(
                (e) => `
            <div class="row">
              <span class="dot-ic ${e.type === '收入' ? '' : 'coral'}">${icon(e.type === '收入' ? 'gift' : 'ledger', 'ic-sm')}</span>
              <div class="row-main"><b>${esc(e.title)}</b><p>${esc(e.category)} · ${esc(shortDate(e.date))}</p></div>
              <span class="amt ${e.type === '收入' ? 'in' : ''}">${e.type === '收入' ? '+' : '-'}${Number(e.amount).toFixed(2)}</span>
            </div>`
              )
              .join('') || '<p class="empty">还没有记账</p>'
          }
        </div>
      </section>`;
  }

  const CAT_STYLE = {
    疫苗: ['syringe', '', 'tag-mint'],
    驱虫: ['pill', 'sand', 'tag-sand'],
    体重: ['scale', 'sky', 'tag-sky'],
    体温: ['temp', 'coral', 'tag-coral'],
    看病记录: ['hospital', 'lilac', 'tag-lilac']
  };
  function healthHTML(p) {
    const all = (S.healthRecords || []).filter((r) => r.petId === p.id);
    const recs = all.filter((r) => UI.healthFilter === '全部' || r.category === UI.healthFilter);
    const sorted = all.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const dv = daysUntil(p.nextVaccineDate);
    const dw = daysUntil(p.nextDewormDate);
    return `
      ${subTop('健康档案', `<button class="btn btn-solid" onclick="App.openHealthForm()">记一条</button>`)}
      ${heroHTML(p, true)}
      <div class="allergy">${icon('info', 'ic-sm')}<span>过敏与禁忌：${esc(p.allergy || '暂无记录')}</span></div>
      <section class="metrics">
        <div class="metric">${icon('scale')}<b>${esc(p.weightKg)}<small>kg</small></b><span>体重</span></div>
        <div class="metric">${icon('temp')}<b>${esc(p.bodyTempC)}<small>°C</small></b><span>体温</span></div>
        <div class="metric">${icon('syringe')}<b>${dv == null ? '—' : dv}<small>${dv == null ? '' : '天'}</small></b><span>距下次疫苗</span></div>
        <div class="metric">${icon('pill')}<b>${dw == null ? '—' : dw}<small>${dw == null ? '' : '天'}</small></b><span>距下次驱虫</span></div>
      </section>
      <div class="sec-title"><h3>时间线</h3></div>
      <div class="timeline">
        ${sorted.map((r) => `<div class="tl-node"><b>${esc(r.date)}</b><span>${esc(r.category)}</span></div>`).join('') || '<p class="empty">还没有记录</p>'}
      </div>
      <div class="pills">
        ${['全部', '疫苗', '驱虫', '体重', '体温', '看病记录']
          .map((c) => `<button class="pill pill-mint ${UI.healthFilter === c ? 'on' : ''}" onclick="App.healthFilter('${c}')">${c}</button>`)
          .join('')}
      </div>
      <section class="card" style="margin-top:12px">
        <div class="rows">
          ${
            recs
              .map((r) => {
                const st = CAT_STYLE[r.category] || ['doc', '', 'tag-gray'];
                return `
            <div class="rec">
              <span class="dot-ic ${st[1]}">${icon(st[0], 'ic-sm')}</span>
              <div class="rec-main">
                <h4>${esc(r.title)}</h4>
                <p class="meta">${esc(r.date)} · ${esc(r.hospital)}</p>
                <span class="val">${esc(r.valueText)}${r.nextDate ? ` · 下次 ${esc(r.nextDate)}` : ''}</span>
                ${r.notes ? `<p class="note">${esc(r.notes)}</p>` : ''}
              </div>
            </div>`;
              })
              .join('') || '<p class="empty">这个分类还没有记录</p>'
          }
        </div>
      </section>`;
  }

  function ledgerHTML(p) {
    const list = (S.ledgerEntries || []).filter((e) => e.petId === p.id);
    const exp = list.filter((e) => e.type === '支出').reduce((a, c) => a + Number(c.amount || 0), 0);
    const inc = list.filter((e) => e.type === '收入').reduce((a, c) => a + Number(c.amount || 0), 0);
    const cats = {};
    list.filter((e) => e.type === '支出').forEach((e) => (cats[e.category] = (cats[e.category] || 0) + Number(e.amount || 0)));
    const max = Math.max(1, ...Object.values(cats));
    return `
      ${subTop('记账本', `<button class="btn btn-solid" onclick="App.openLedgerForm()">记一笔</button>`)}
      <section class="card">
        <div class="sum3">
          <div><span>支出</span><b class="out">${exp.toFixed(0)}</b></div>
          <div><span>收入</span><b class="in">${inc.toFixed(0)}</b></div>
          <div><span>结余</span><b>${(inc - exp).toFixed(0)}</b></div>
        </div>
      </section>
      ${
        Object.keys(cats).length
          ? `<section class="card"><div class="card-head"><h3>支出构成</h3><span class="muted" style="font-size:12px">单位：元</span></div>
            ${Object.entries(cats)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => `<div class="cat-bar"><span>${esc(k)}</span><div class="bar"><i style="width:${((v / max) * 100).toFixed(0)}%"></i></div><span class="amt">${v.toFixed(0)}</span></div>`)
              .join('')}</section>`
          : ''
      }
      <section class="card">
        <div class="card-head"><h3>明细</h3><span class="muted" style="font-size:12px">${list.length} 笔</span></div>
        <div class="rows">
          ${
            list
              .map(
                (e) => `
            <div class="row">
              <span class="dot-ic ${e.type === '收入' ? '' : 'coral'}">${icon(e.type === '收入' ? 'gift' : 'ledger', 'ic-sm')}</span>
              <div class="row-main"><b>${esc(e.title)}</b><p>${esc(e.category)} · ${esc(e.date)}${e.note ? ' · ' + esc(e.note) : ''}</p></div>
              <span class="amt ${e.type === '收入' ? 'in' : ''}">${e.type === '收入' ? '+' : '-'}${Number(e.amount).toFixed(2)}</span>
            </div>`
              )
              .join('') || '<p class="empty">还没有记账</p>'
          }
        </div>
      </section>`;
  }

  function remindersHTML(p) {
    const list = (S.reminders || []).filter((r) => r.petId === p.id);
    const todo = list.filter((r) => !r.done);
    const done = list.filter((r) => r.done);
    const row = (r) => `
      <label class="row ${r.done ? 'done' : ''}">
        <input class="chk" type="checkbox" ${r.done ? 'checked' : ''} onchange="App.toggleReminder('${esc(r.id)}')" />
        <div class="row-main"><b>${esc(r.title)}</b><p>${esc(r.time)} · ${esc(r.cycle)} · ${esc(r.category)}</p></div>
        ${r.urgent && !r.done ? '<span class="tag tag-coral">要紧</span>' : ''}
      </label>`;
    return `
      ${subTop('待办提醒', `<button class="btn btn-solid" onclick="App.openReminderForm()">新提醒</button>`)}
      <section class="card">
        <div class="card-head"><h3>未完成</h3><span class="muted" style="font-size:12px">${todo.length} 项</span></div>
        <div class="rows">${todo.map(row).join('') || '<p class="empty">都做完了</p>'}</div>
      </section>
      ${done.length ? `<section class="card"><div class="card-head"><h3>已完成</h3></div><div class="rows">${done.map(row).join('')}</div></section>` : ''}`;
  }

  function aiHTML(p) {
    const cur = UI.aiPersonality || p.personality || PERSONAS[0];
    UI.aiPersonality = cur;
    const hist = (S.aiChatHistories || {})[p.id] || [];
    return `
      ${subTop(`和${p.name}聊聊`)}
      <div class="pills">
        ${PERSONAS.map((x) => `<button class="pill pill-mint ${cur === x ? 'on' : ''}" onclick="App.setPersonality('${x}')">${x}</button>`).join('')}
      </div>
      <div class="chat" id="chatBox">
        ${
          hist
            .map((m) =>
              m.sender === 'user'
                ? `<div class="msg msg-me"><div class="bubble">${esc(m.text)}<time>${esc(m.time || '')}</time></div></div>`
                : `<div class="msg"><span class="av">${petArt(p.species)}</span><div class="bubble">${esc(m.text)}<time>${esc(m.personality || cur)} · ${esc(m.time || '')}</time></div></div>`
            )
            .join('') || '<p class="empty">问问它最近的疫苗、体重或花销</p>'
        }
      </div>
      <div class="quick">${QUICK.map((q, i) => `<button onclick="App.quickAsk(${i})">${q}</button>`).join('')}</div>
      <form class="composer" onsubmit="App.sendChat(event)">
        <input name="msg" placeholder="想问${esc(p.name)}什么？" autocomplete="off" maxlength="300" />
        <button class="btn btn-solid btn-lg">发送</button>
      </form>`;
  }

  function servicesHTML(p) {
    const d = S.servicesData || {};
    const tabs = ['医院', '美容寄养', '托运', '问诊', '保险'];
    let body = '';
    if (UI.serviceTab === '医院') {
      body = (d.hospitals || [])
        .map(
          (h, i) => `
        <section class="card svc">
          <h4>${esc(h.name)}</h4>
          <div class="tags">${h.tags.map((t, j) => `<span class="tag ${j === 0 ? 'tag-mint' : 'tag-gray'}">${esc(t)}</span>`).join('')}</div>
          <p>${esc(h.address)} · ${esc(h.distance)}</p>
          <p>${esc(h.phone)}</p>
          <div class="svc-foot"><span class="online">${esc(h.status)}</span><button class="btn btn-solid" onclick="App.bookItem('hospitals',${i})">预约挂号</button></div>
        </section>`
        )
        .join('');
    } else if (UI.serviceTab === '美容寄养') {
      body = (d.groomingBoarding || [])
        .map(
          (g, i) => `
        <section class="card svc">
          <span class="tag tag-sand">${esc(g.type)}</span>
          <h4 style="margin-top:6px">${esc(g.title)}</h4>
          <p style="margin-top:4px">${esc(g.shopName)} · ${esc(g.distance)}</p>
          <p>${esc(g.highlights)}</p>
          <div class="svc-foot"><span class="price"><small>¥</small>${esc(g.price)}<em>起</em></span><button class="btn btn-solid" onclick="App.bookItem('groomingBoarding',${i})">预约</button></div>
        </section>`
        )
        .join('');
    } else if (UI.serviceTab === '托运') {
      body = (d.transportPlans || [])
        .map(
          (t, i) => `
        <section class="card svc">
          <h4>${esc(t.mode)}</h4>
          <p style="margin-top:4px">${esc(t.route)}</p>
          <p>${esc(t.includes)}</p>
          <div class="svc-foot"><span class="price"><small>¥</small>${esc(t.priceFrom)}<em>起</em></span><button class="btn btn-solid" onclick="App.bookItem('transportPlans',${i})">咨询下单</button></div>
        </section>`
        )
        .join('');
    } else if (UI.serviceTab === '问诊') {
      body = (d.onlineDoctors || [])
        .map(
          (doc, i) => `
        <section class="card svc">
          <div class="post-head">${avatar(doc.name)}<div><b>${esc(doc.name)}</b><p>${esc(doc.title)}</p></div></div>
          <p style="margin-top:10px">${esc(doc.specialty)}</p>
          <div class="svc-foot"><span class="muted" style="font-size:12px">${esc(doc.replyTime)} · ${esc(doc.fee)}</span><button class="btn btn-solid" onclick="App.bookItem('onlineDoctors',${i})">去问诊</button></div>
        </section>`
        )
        .join('');
    } else {
      body = (d.insurancePlans || [])
        .map((x, i) => {
          const owner = (S.pets || []).find((q) => q.id === x.coveredPetId);
          const active = /生效/.test(x.policyStatus);
          return `
        <section class="card svc ins">
          <h4>${esc(x.name)}</h4>
          <p class="muted">${esc(x.company)}${owner ? ' · 保障 ' + esc(owner.name) : ''}</p>
          <div class="ins-cover">
            <div><b>¥${esc(x.monthlyPrice)}</b><span>每月</span></div>
            <div><b>¥${Number(x.annualCoverage).toLocaleString()}</b><span>年度保额</span></div>
          </div>
          <p>${esc(x.reimburseRate)}</p>
          ${(x.highlights || []).map((h) => `<p>· ${esc(h)}</p>`).join('')}
          <div class="svc-foot"><span style="font-size:12px">${esc(x.policyStatus)}</span>${
            active
              ? `<button class="btn" onclick="App.showPolicy(${i})">查看保单</button>`
              : `<button class="btn" onclick="App.bookItem('insurancePlans',${i})">申请投保</button>`
          }</div>
        </section>`;
        })
        .join('');
    }
    const booked = (d.bookings || []).slice(0, 3);
    return `
      ${subTop('宠物服务')}
      <div class="pills" style="margin-bottom:12px">
        ${tabs.map((t) => `<button class="pill ${UI.serviceTab === t ? 'on' : ''}" onclick="App.serviceTabFn('${t}')">${t}</button>`).join('')}
      </div>
      ${body || '<p class="empty">暂时没有可选的服务</p>'}
      ${
        booked.length
          ? `<section class="card"><div class="card-head"><h3>我的预约</h3></div><div class="rows">${booked
              .map((b) => `<div class="row"><span class="dot-ic">${icon('ticket', 'ic-sm')}</span><div class="row-main"><b>${esc(b.title)}</b><p>${esc(b.petName)} · ${esc(b.date)}</p></div><span class="tag tag-mint">${esc(b.status)}</span></div>`)
              .join('')}</div></section>`
          : ''
      }`;
  }

  function albumHTML(p) {
    const a = S.albumState || { photos: [], freeQuotaBytes: 0, extraQuotaBytes: 0 };
    const photos = a.photos || [];
    const used = photos.reduce((x, ph) => x + Number(ph.sizeBytes || 0), 0);
    const total = Number(a.freeQuotaBytes || 0) + Number(a.extraQuotaBytes || 0);
    const pct = total ? Math.min(100, (used / total) * 100) : 0;
    const totalText = total >= 1073741824 ? (total / 1073741824).toFixed(1) + ' GB' : fmtMB(total).toFixed(0) + ' MB';
    return `
      ${subTop('相册', `<button class="btn btn-solid" onclick="App.uploadPhoto()">上传</button>`)}
      <section class="card">
        <div class="quota-top"><span class="muted" style="font-size:12.5px">${esc(a.planName || '免费 524 MB')}</span><b>${fmtMB(used).toFixed(0)}<small> MB / ${totalText}</small></b></div>
        <div class="bar"><i style="width:${pct.toFixed(1)}%;${pct > 85 ? 'background:var(--coral)' : ''}"></i></div>
        ${
          a.extraQuotaBytes
            ? ''
            : `<div class="quota-btns"><button class="btn" onclick="App.upgradeAlbum('10GB')">扩到 10GB · ¥9.9</button><button class="btn btn-ghost" onclick="App.upgradeAlbum('50GB')">50GB · ¥29.9</button></div>`
        }
      </section>
      <div class="photos">
        ${
          photos
            .map((ph) => {
              const owner = (S.pets || []).find((q) => q.id === ph.petId) || {};
              return `
          <figure class="photo">
            <div class="photo-img" style="background:${esc(ph.palette || '#e5f5ef')}">${petArt(owner.species)}<span class="tag">${esc(ph.tag)}</span></div>
            <figcaption>${esc(ph.title)}<span>${esc(ph.date)} · ${fmtMB(ph.sizeBytes).toFixed(0)} MB</span></figcaption>
          </figure>`;
            })
            .join('') || '<p class="empty" style="grid-column:1/-1">还没有照片</p>'
        }
      </div>`;
  }

  function homeHTML() {
    const p = pet();
    if (!p.id) {
      return `<header class="top"><h1>爪印日记</h1></header><section class="card"><p class="empty">先添加一只宠物</p><button class="submit" onclick="App.petSwitcher()">添加宠物</button></section>`;
    }
    const view = {
      main: homeMain,
      health: healthHTML,
      ledger: ledgerHTML,
      reminders: remindersHTML,
      ai: aiHTML,
      services: servicesHTML,
      album: albumHTML
    }[UI.homeSub] || homeMain;
    return view(p);
  }

  /* ==================== 设备 ==================== */
  function deviceHTML() {
    const d = S.devicesState;
    if (!d || !d.feeder || !d.fountain || !d.collar) {
      return `<header class="top"><h1>设备</h1></header><section class="card"><p class="empty">还没有绑定设备</p></section>`;
    }
    const f = d.feeder;
    const w = d.fountain;
    const c = d.collar;
    const h = hash(c.locationName || c.deviceId);
    const dotX = 40 + (h % 20);
    const dotY = 36 + ((h >>> 8) % 20);
    const online = [f, w, c].filter((x) => x.online).length;
    const lvl = Math.max(0, Math.min(100, Number(w.waterLevelPercent) || 0));
    const shortName = (n) => String(n || '').replace(/^PawLink\s*/, '');
    return `
      <header class="top"><h1>设备</h1><span class="online">${online}/3 在线</span></header>

      <section class="card">
        <div class="dev-head">
          <span class="dot-ic coral">${icon('pin', 'ic-sm')}</span>
          <div><b>定位项圈</b><p>${esc(shortName(c.name))}</p></div>
          <span class="online ${c.online ? '' : 'off'}">电量 ${esc(c.batteryPercent)}%</span>
        </div>
        <div class="map">
          <svg viewBox="0 0 360 176" preserveAspectRatio="none" aria-hidden="true">
            <rect class="block" x="18" y="18" width="88" height="54" rx="8"/>
            <rect class="block" x="250" y="96" width="92" height="62" rx="8"/>
            <rect class="block" x="150" y="12" width="70" height="40" rx="8"/>
            <path class="river" d="M-10 150 C80 120 150 176 240 140 S350 70 380 90"/>
            <path class="road" d="M120 -10 L140 190"/>
            <path class="road" d="M-10 86 L380 70"/>
            <path class="road" d="M236 -10 C228 60 250 120 238 190"/>
            <circle class="fence" cx="${(dotX / 100) * 360}" cy="${(dotY / 100) * 176}" r="58"/>
          </svg>
          <span class="pet-dot ${c.buzzerActive ? 'buzz' : ''}" style="left:${dotX}%;top:${dotY}%"></span>
          <span class="map-fence">围栏 ${esc(c.fenceRadiusMeters)} 米 · ${c.inSafeFence ? '在范围内' : '已离开'}</span>
          <span class="map-chip">${esc(c.locationName)}</span>
        </div>
        <p class="cam">${esc(c.cameraSnapshotTag)}</p>
        <div class="dev-btns">
          <button class="btn ${c.buzzerActive ? 'btn-coral' : 'btn-solid'}" onclick="App.deviceCmd('LOCATE_BUZZ')">${c.buzzerActive ? '停止响铃' : '找宠：响铃闪灯'}</button>
        </div>
      </section>

      <section class="card">
        <div class="dev-head">
          <span class="dot-ic sand">${icon('bowl', 'ic-sm')}</span>
          <div><b>智能食碗</b><p>${esc(shortName(f.name))}</p></div>
          <span class="online ${f.online ? '' : 'off'}">${f.online ? '在线' : '离线'}</span>
        </div>
        <div class="stats">
          <div class="stat"><b>${esc(f.bowlRemainGrams)}<small>g</small></b><span>碗里剩余</span></div>
          <div class="stat"><b>${esc(f.hopperRemainGrams)}<small>g</small></b><span>粮仓余量</span></div>
          <div class="stat"><b>${esc(f.todayFedGrams)}<small>g</small></b><span>今日 ${esc(f.todayFedCount)} 次</span></div>
        </div>
        <p class="cam">最近一次出粮 ${esc(f.lastFeedTime)}</p>
        <div class="feed-btns">
          <button class="btn" onclick="App.deviceCmd('FEED_NOW',10)">出粮 10g</button>
          <button class="btn btn-solid" onclick="App.deviceCmd('FEED_NOW',20)">出粮 20g</button>
          <button class="btn" onclick="App.deviceCmd('FEED_NOW',50)">出粮 50g</button>
        </div>
      </section>

      <section class="card">
        <div class="dev-head">
          <span class="dot-ic sky">${icon('drop', 'ic-sm')}</span>
          <div><b>饮水机</b><p>${esc(w.mode)}</p></div>
          <span class="online ${w.online ? '' : 'off'}">${w.online ? '在线' : '离线'}</span>
        </div>
        <div class="level">
          <div class="ring" style="background:conic-gradient(#5b9bd5 ${lvl * 3.6}deg,#e6f0fa 0)"><b>${lvl}%</b></div>
          <div class="stats">
            <div class="stat"><b>${esc(w.todayDrinkMl)}<small>ml</small></b><span>今日饮水 ${esc(w.todayDrinkCount)} 次</span></div>
            <div class="stat"><b>${esc(w.filterLifePercent)}<small>%</small></b><span>滤芯寿命</span></div>
          </div>
        </div>
        <div class="dev-btns"><button class="btn" onclick="App.deviceCmd('WATER_FLUSH')">换水冲洗 3 分钟</button></div>
      </section>

      <section class="card">
        <div class="card-head"><h3>遛弯记录</h3>${WALK ? '' : '<button class="btn btn-solid" onclick="App.startWalk()">开始遛弯</button>'}</div>
        ${walkPanelHTML()}
        <div class="rows">
          ${
            (d.walkRoutes || [])
              .map(
                (r) => `
            <div class="walk">
              <div class="walk-map">${trackSvg(r.track, 'walk-svg', 96, 64) || '<span class="walk-none">没有轨迹<br/>旧记录</span>'}</div>
              <div class="walk-main"><b>${esc(r.routeSummary)}</b><p>${esc(r.petName)} · ${esc(r.date)}</p><p>${esc(r.durationMin)} 分钟 · ${esc(r.caloriesKcal)} 千卡${r.track ? ` · ${esc(r.pointsCount)} 个定位点` : ''}</p></div>
              <div class="walk-km"><b>${esc(r.distanceKm)}</b><span>公里</span></div>
            </div>`
              )
              .join('') || '<p class="empty">还没有遛弯记录</p>'
          }
        </div>
      </section>`;
  }

  /* ==================== 萌圈 ==================== */
  function socialHTML() {
    let body = '';
    if (UI.socialTab === '食谱') body = foodHTML();
    else if (UI.socialTab === '找朋友') body = friendsHTML();
    else body = postsHTML();
    const isFood = UI.socialTab === '食谱';
    const showSearch = UI.socialTab !== '找朋友';
    return `
      <header class="top"><h1>萌圈</h1></header>
      <div class="pills" style="margin-bottom:12px">
        ${['推荐', '关注', '食谱', '找朋友'].map((t) => `<button class="pill ${UI.socialTab === t ? 'on' : ''}" onclick="App.socialTabFn('${t}')">${t}</button>`).join('')}
      </div>
      ${
        showSearch
          ? `<label class="search">${icon('search', 'ic-sm')}<input placeholder="${isFood ? '查一种食物，比如：葡萄' : '搜索帖子或作者'}" value="${esc(isFood ? UI.foodSearch : UI.socialSearch)}" oninput="App.socialSearchFn(this.value)" /></label>`
          : ''
      }
      ${body}
      ${UI.socialTab === '推荐' || UI.socialTab === '关注' ? `<button class="fab" onclick="App.openPostForm()">${icon('plus', 'ic-sm')}发布</button>` : ''}`;
  }

  function postsHTML() {
    const q = UI.socialSearch.trim();
    const posts = (S.socialPosts || [])
      .filter((p) => (UI.socialTab === '推荐' ? true : p.tab === '关注'))
      .filter((p) => !q || (p.title + p.content + p.author).includes(q));
    return (
      posts
        .map((p) => {
          const sp = p.type === '动态' ? speciesFromText(p.petTag + p.title) : '';
          return `
      <article class="card">
        <div class="post-head">${avatar(p.author)}<div><b>${esc(p.author)}</b><p>${esc(p.authorBadge)} · ${esc(p.time)}</p></div>${p.type === '文章' ? '<span class="tag tag-mint">文章</span>' : ''}</div>
        <div class="post-body">
          <div class="post-text"><h4>${esc(p.title)}</h4><p>${esc(p.content)}</p></div>
          ${sp ? `<div class="post-art" style="background:${softOf(p.id).bg}">${petArt(sp)}</div>` : ''}
        </div>
        <div class="post-foot">
          <span class="tag tag-gray">${esc(p.petTag)}</span>
          <span class="grow"></span>
          <button class="${p.liked ? 'liked' : ''}" onclick="App.likePost('${esc(p.id)}')">${icon('heart', 'ic-sm')}${esc(p.likes)}</button>
          <span>${icon('comment', 'ic-sm')}${esc(p.comments)}</span>
        </div>
      </article>`;
        })
        .join('') || `<p class="empty">${UI.socialTab === '关注' ? '你关注的人还没有发帖' : '没有找到相关内容'}</p>`
    );
  }

  function foodHTML() {
    const q = UI.foodSearch.trim();
    const list = (S.foodRecipes || []).filter(
      (f) => (UI.foodFilter === '全部' || f.safetyLevel === UI.foodFilter) && (!q || f.name.includes(q) || f.category.includes(q))
    );
    const cls = { 能吃: 'v-ok', 慎吃: 'v-warn', 不能吃: 'v-no' };
    const mark = { 能吃: '能吃', 慎吃: '少吃', 不能吃: '别喂' };
    return `
      <div class="notice">${icon('info')}<div><b>误食了葡萄、洋葱、巧克力或百合？</b><p>别等症状出现，2 小时内送 24 小时医院。</p></div></div>
      <div class="pills" style="margin-bottom:12px">
        ${['全部', '能吃', '慎吃', '不能吃'].map((f) => `<button class="pill pill-mint ${UI.foodFilter === f ? 'on' : ''}" onclick="App.foodFilterFn('${f}')">${f}</button>`).join('')}
      </div>
      <section class="card">
        <div class="rows">
          ${
            list
              .map(
                (f) => `
            <div class="food">
              <span class="verdict ${cls[f.safetyLevel] || ''}">${mark[f.safetyLevel] || '?'}</span>
              <div class="food-main">
                <h4>${esc(f.name)}</h4>
                <p class="for">${esc(f.category)} · ${esc(f.suitableFor)}</p>
                <p>${esc(f.summary)}</p>
                <p class="detail">${esc(f.detail)}</p>
              </div>
            </div>`
              )
              .join('') || '<p class="empty">没查到，换个叫法试试</p>'
          }
        </div>
      </section>`;
  }

  function friendsHTML() {
    return (S.petFriends || [])
      .map((f) => {
        const sp = speciesFromText(f.petName);
        return `
      <section class="card friend">
        <div class="post-art" style="background:${softOf(f.id).bg}">${petArt(sp || '猫')}</div>
        <div class="friend-main">
          <b>${esc(f.petName)}</b>
          <p class="meta">${esc(f.ownerName)} · ${esc(f.distance)}</p>
          <p>${esc(f.intro)}</p>
        </div>
        <button class="btn ${f.followed ? 'btn-ghost' : 'btn-solid'}" onclick="App.toggleFriend('${esc(f.id)}')">${f.followed ? '已关注' : '关注'}</button>
      </section>`;
      })
      .join('');
  }

  /* ==================== 商城 ==================== */
  function mallHTML() {
    const cats = ['全部', '关注', '狗', '猫', '异宠'];
    const q = UI.mallSearch.trim();
    const list = (S.mallProducts || []).filter(
      (p) =>
        (UI.mallCat === '全部' || (UI.mallCat === '关注' ? p.followedShop : p.category === UI.mallCat)) &&
        (!q || p.title.includes(q) || p.shopName.includes(q))
    );
    const count = (S.cartItems || []).reduce((a, c) => a + Number(c.qty || 0), 0);
    const vip = (S.currentUser || {}).vipLevel || '';
    return `
      <header class="top"><h1>商城</h1></header>
      <label class="search">${icon('search', 'ic-sm')}<input placeholder="搜索口粮、驱虫药、玩具" value="${esc(UI.mallSearch)}" oninput="App.mallSearchFn(this.value)" /></label>
      <div class="pills" style="margin-bottom:12px">
        ${cats.map((c) => `<button class="pill pill-mint ${UI.mallCat === c ? 'on' : ''}" onclick="App.mallCatFn('${c}')">${c === '关注' ? '关注的店' : c}</button>`).join('')}
      </div>
      <div class="banner">${icon('gift')}<div><b>结算自动打 95 折</b><p>${esc(vip)} 专属，价格以下单时服务端核算为准</p></div></div>
      <div class="goods">
        ${
          list
            .map(
              (p) => `
          <article class="good">
            <div class="good-pic" style="background:${softOf(p.id).bg}">${goodsArt(p)}<span class="tag tag-coral">${esc(p.badge)}</span></div>
            <div class="good-body">
              <span class="shop">${esc(p.shopName)}</span>
              <h4>${esc(p.title)}</h4>
              <p>${esc(p.salesText)}</p>
              <div class="good-foot">
                <span class="price"><small>¥</small>${esc(p.price)}<s>¥${esc(p.originPrice)}</s></span>
                <button class="add-btn" onclick="App.addCart('${esc(p.id)}')" aria-label="加入购物车">${icon('plus', 'ic-sm')}</button>
              </div>
            </div>
          </article>`
            )
            .join('') || '<p class="empty" style="grid-column:1/-1">没有找到商品</p>'
        }
      </div>
      <button class="cart-fab" onclick="App.openCart()" aria-label="购物车">${icon('cart')}${count ? `<b>${count}</b>` : ''}</button>`;
  }

  function cartHTML() {
    const items = S.cartItems || [];
    const shops = {};
    items.forEach((c) => (shops[c.shopName] = shops[c.shopName] || []).push(c));
    const sel = items.filter((c) => c.checked);
    const total = sel.reduce((a, c) => a + c.price * c.qty, 0);
    const allChecked = items.length > 0 && items.every((c) => c.checked);
    return `
      ${sheetHead(`购物车（${items.length}）`)}
      ${
        Object.entries(shops)
          .map(
            ([shop, list]) => `
        <div class="cart-shop">${icon('store', 'ic-sm')}${esc(shop)}</div>
        ${list
          .map((c) => {
            const prod = (S.mallProducts || []).find((p) => p.id === c.productId) || {};
            const specs = prod.specs || [c.spec];
            return `
          <div class="cart-line">
            <input class="chk" type="checkbox" ${c.checked ? 'checked' : ''} onchange="App.cartUpdate('${esc(c.id)}','TOGGLE')" />
            <div class="cart-pic" style="background:${softOf(c.productId).bg}">${goodsArt(prod.title ? prod : c)}</div>
            <div class="cart-info">
              <p>${esc(c.title)}</p>
              <select onchange="App.cartSpec('${esc(c.id)}',this.value)">${specs.map((s) => `<option ${s === c.spec ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
              ${c.promoTag ? `<span class="promo">${esc(c.promoTag)}</span>` : ''}
              <div class="cart-bottom">
                <span class="price"><small>¥</small>${esc(c.price)}</span>
                <span class="qty"><button onclick="App.cartUpdate('${esc(c.id)}','DEC')" aria-label="减少">−</button><b>${esc(c.qty)}</b><button onclick="App.cartUpdate('${esc(c.id)}','INC')" aria-label="增加">+</button></span>
              </div>
            </div>
          </div>`;
          })
          .join('')}`
          )
          .join('') || '<p class="empty">购物车是空的</p>'
      }
      <div class="cart-foot">
        <label><input class="chk" type="checkbox" ${allChecked ? 'checked' : ''} onchange="App.cartAll(this.checked)" />全选</label>
        <div class="cart-total">合计<b>${money(total)}</b>会员价下单时再算</div>
        <button class="btn btn-coral btn-lg" onclick="App.checkout()">结算${sel.length ? `(${sel.length})` : ''}</button>
      </div>`;
  }

  /* ==================== 我的 ==================== */
  function mineHTML() {
    const u = S.currentUser || {};
    const orders = S.orders || [];
    const states = [
      ['待付款', 'wallet'],
      ['待使用', 'ticket'],
      ['已完成', 'check'],
      ['退款/售后', 'refund']
    ];
    const shown = orders.filter((o) => UI.orderFilter === '全部' || o.status === UI.orderFilter);
    const pct = u.vipNextPoints ? Math.min(100, Math.round((u.vipPoints / u.vipNextPoints) * 100)) : 0;
    const statusTag = { 待付款: 'tag-coral', 待使用: 'tag-sky', 已完成: 'tag-mint', '退款/售后': 'tag-gray' };
    return `
      <header class="top"><h1>我的</h1><button class="round-btn light" onclick="App.openSettings()" aria-label="设置">${icon('sliders')}</button></header>
      <section class="card profile">
        <span class="avatar">${esc(String(u.nickname || '我').slice(0, 1))}</span>
        <div><h2>${esc(u.nickname)}</h2><p>${esc(u.signature)}</p><p class="muted">${esc(u.city)} · ${esc(u.phoneMasked || '')}</p></div>
        <button class="btn" onclick="App.openProfile()">${icon('edit', 'ic-sm')}编辑</button>
      </section>

      <section class="card vip">
        <div class="vip-top"><b>${esc(u.vipLevel)}</b><span>有效期至 ${esc(u.vipExpireDate || '')}</span></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <p class="vip-pts">成长值 ${esc(u.vipPoints)} / ${esc(u.vipNextPoints)}，再攒 ${Math.max(0, (u.vipNextPoints || 0) - (u.vipPoints || 0))} 升级</p>
        <ul class="perks">${(u.vipBenefits || []).map((b) => `<li>${esc(b.title)}<span>${esc(b.desc)}</span></li>`).join('')}</ul>
      </section>

      <section class="card">
        <div class="card-head"><h3>我的订单</h3><button class="more" onclick="App.orderFilterFn('全部')">全部${icon('right', 'ic-sm')}</button></div>
        <div class="order-tabs">
          ${states
            .map(([s, ic]) => {
              const n = orders.filter((o) => o.status === s).length;
              return `<button class="${UI.orderFilter === s ? 'on' : ''}" onclick="App.orderFilterFn('${s}')">${icon(ic)}${s}${n ? `<i>${n}</i>` : ''}</button>`;
            })
            .join('')}
        </div>
        <div class="rows">
          ${
            shown
              .map(
                (o) => `
            <div class="order">
              <div class="order-top"><b>${esc(o.shopName)}</b><span class="tag ${statusTag[o.status] || 'tag-gray'}">${esc(o.status)}</span></div>
              <p class="order-items">${o.items.map((i) => `${esc(i.title)} ×${esc(i.qty)}`).join('；')}</p>
              <p class="order-note">${esc(o.createdAt)}${o.verifyCode ? ` · 核销码 ${esc(o.verifyCode)}` : ''}${o.note ? ' · ' + esc(o.note) : ''}</p>
              <div class="order-foot">
                <span class="amt">${money(o.totalAmount)}</span>
                ${o.status === '待付款' ? `<button class="btn btn-coral" onclick="App.orderStatus('${esc(o.id)}','待使用')">去付款</button>` : ''}
                ${o.status === '待使用' ? `<button class="btn btn-solid" onclick="App.orderStatus('${esc(o.id)}','已完成')">确认使用</button>` : ''}
                ${o.status === '已完成' ? `<button class="btn btn-ghost" onclick="App.orderStatus('${esc(o.id)}','退款/售后')">申请售后</button>` : ''}
              </div>
            </div>`
              )
              .join('') || '<p class="empty">这里还没有订单</p>'
          }
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h3>共享宠物</h3><button class="btn" onclick="App.openShare()">邀请家人</button></div>
        <div class="rows">
          ${(S.sharedMembers || [])
            .map(
              (m) => `
            <div class="row">${avatar(m.name)}<div class="row-main"><b>${esc(m.name)}</b><p>${esc(m.role)} · ${esc(m.permissions)}</p></div><span class="tag tag-mint">${m.sharedPets.map(esc).join('、')}</span></div>`
            )
            .join('') || '<p class="empty">还没有和家人共享</p>'}
        </div>
      </section>

      <section class="card menu">
        <button onclick="App.openAddresses()">${icon('pin')}<span>收货地址</span>${icon('right', 'ic-sm')}</button>
        <button onclick="App.openSettings()">${icon('sliders')}<span>通用设置</span>${icon('right', 'ic-sm')}</button>
        <button onclick="App.openSettings()">${icon('lock')}<span>账号与安全</span>${icon('right', 'ic-sm')}</button>
        <button onclick="App.openDoc('announce')">${icon('megaphone')}<span>公告</span>${icon('right', 'ic-sm')}</button>
        <button onclick="App.openDoc('service')">${icon('phone')}<span>联系客服</span>${icon('right', 'ic-sm')}</button>
        <button onclick="App.openDoc('agreement')">${icon('doc')}<span>用户协议</span>${icon('right', 'ic-sm')}</button>
        <button onclick="App.openDoc('about')">${icon('info')}<span>关于我们</span>${icon('right', 'ic-sm')}</button>
      </section>
      <p class="foot-note">爪印日记 v2.4.0</p>`;
  }

  /* ==================== 渲染 ==================== */
  function render() {
    document.querySelectorAll('#bottomTabbar .tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === UI.tab));
    const v = $('#appViewport');
    const view = {
      home: homeHTML,
      device: deviceHTML,
      social: socialHTML,
      mall: mallHTML,
      mine: mineHTML
    }[UI.tab] || homeHTML;
    v.innerHTML = view();
    const key = UI.tab === 'home' ? 'home:' + UI.homeSub : UI.tab;
    if (key !== lastView) {
      v.scrollTop = 0;
      lastView = key;
    }
    if (UI.tab === 'home' && UI.homeSub === 'ai') v.scrollTop = v.scrollHeight;
  }
  function refocusSearch() {
    const inp = document.querySelector('.search input');
    if (inp) {
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    }
  }

  /* ==================== 交互 ==================== */
  window.App = {
    closeDrawer,
    go(tab, sub) {
      UI.tab = tab;
      if (sub) UI.homeSub = sub;
      render();
    },
    openService(tab) {
      UI.serviceTab = tab;
      UI.tab = 'home';
      UI.homeSub = 'services';
      render();
    },
    serviceTabFn(t) { UI.serviceTab = t; render(); },
    healthFilter(c) { UI.healthFilter = c; render(); },
    socialTabFn(t) { UI.socialTab = t; render(); },
    foodFilterFn(f) { UI.foodFilter = f; render(); },
    socialSearchFn(v) {
      if (UI.socialTab === '食谱') UI.foodSearch = v;
      else UI.socialSearch = v;
      render();
      refocusSearch();
    },
    mallSearchFn(v) { UI.mallSearch = v; render(); refocusSearch(); },
    mallCatFn(c) { UI.mallCat = c; render(); },
    orderFilterFn(f) { UI.orderFilter = f; render(); },
    setPersonality(p) { UI.aiPersonality = p; render(); },

    quickAdd() {
      const acts = [
        ['ledger', '记一笔', 'App.openLedgerForm()'],
        ['bell', '新提醒', 'App.openReminderForm()'],
        ['health', '健康记录', 'App.openHealthForm()'],
        ['camera', '上传照片', "App.closeDrawer();App.uploadPhoto()"],
        ['comment', '发动态', 'App.openPostForm()'],
        ['route', '开始遛弯', "App.closeDrawer();App.go('device');App.startWalk()"]
      ];
      openDrawer(`${sheetHead('添加')}<div class="actions">${acts.map((a) => `<button onclick="${a[2]}"><span class="gi">${icon(a[0])}</span>${a[1]}</button>`).join('')}</div>`);
    },
    async addPlanReminder(kind) {
      const p = pet();
      const a = planAlert(p);
      if (!a || a.kind !== kind) return;
      const r = await api('POST', '/api/v1/reminders', {
        petId: p.id,
        title: `${p.name}${kind === 'deworm' ? '驱虫' : '疫苗加强针'}`,
        time: `${a.date} 09:00`,
        cycle: '单次提醒',
        category: '驱虫免疫',
        urgent: daysUntil(a.date) <= 7
      });
      if (!r) return;
      S.reminders = r.data.reminders;
      render();
      toast('已加到待办');
    },

    async quickAsk(i) {
      const q = QUICK[i];
      if (!q) return;
      const r = await api('POST', '/api/v1/ai/chat', { petId: pet().id, personality: UI.aiPersonality, message: q });
      if (!r) return;
      S.aiChatHistories[pet().id] = r.data.history;
      render();
    },
    async sendChat(e) {
      e.preventDefault();
      const msg = String(new FormData(e.target).get('msg') || '').trim();
      if (!msg) return;
      const r = await api('POST', '/api/v1/ai/chat', { petId: pet().id, personality: UI.aiPersonality, message: msg });
      if (!r) return;
      S.aiChatHistories[pet().id] = r.data.history;
      render();
    },

    petSwitcher() {
      openDrawer(`
        ${sheetHead('切换宠物')}
        ${(S.pets || [])
          .map(
            (p) => `
          <button class="pick" onclick="App.selectPet('${esc(p.id)}')">
            <span class="av">${petArt(p.species)}</span>
            <div><b>${esc(p.name)}</b><p>${esc(p.breed)} · ${esc(p.ageText || '')}</p></div>
            ${p.id === S.currentPetId ? '<span class="on">当前</span>' : ''}
          </button>`
          )
          .join('')}
        <form onsubmit="App.createPet(event)">
          <p class="form-title">添加新宠物</p>
          <div class="field-row">
            <div class="field"><label>名字</label><input name="name" required maxlength="20" /></div>
            <div class="field"><label>类别</label><select name="species"><option>猫</option><option>狗</option><option>异宠</option></select></div>
          </div>
          <div class="field"><label>品种</label><input name="breed" required maxlength="30" placeholder="比如：布偶猫" /></div>
          <div class="field"><label>体重（kg）</label><input name="weightKg" type="number" step="0.01" min="0" value="4" /></div>
          <button class="submit">添加</button>
        </form>`);
    },
    async selectPet(id) {
      const r = await api('POST', '/api/v1/pets/select', { petId: id });
      if (!r) return;
      S.currentPetId = r.data.currentPetId;
      UI.aiPersonality = '';
      closeDrawer();
      render();
    },
    async createPet(e) {
      e.preventDefault();
      const r = await api('POST', '/api/v1/pets', Object.fromEntries(new FormData(e.target)));
      if (!r) return;
      await reloadState();
      closeDrawer();
      render();
      toast(r.message);
    },

    openHealthForm() {
      openDrawer(`
        ${sheetHead('记一条健康记录')}
        <form onsubmit="App.submitHealth(event)">
          <div class="field-row">
            <div class="field"><label>类别</label><select name="category"><option>疫苗</option><option>驱虫</option><option>体重</option><option>体温</option><option>看病记录</option></select></div>
            <div class="field"><label>日期</label><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
          </div>
          <div class="field"><label>项目</label><input name="title" required placeholder="比如：猫三联加强针" /></div>
          <div class="field"><label>结果（体重填 4.9，体温填 38.5）</label><input name="valueText" /></div>
          <div class="field-row">
            <div class="field"><label>医院 / 地点</label><input name="hospital" /></div>
            <div class="field"><label>下次日期</label><input name="nextDate" type="date" /></div>
          </div>
          <div class="field"><label>备注</label><textarea name="notes" rows="2"></textarea></div>
          <button class="submit">保存</button>
        </form>`);
    },
    async submitHealth(e) {
      e.preventDefault();
      const r = await api('POST', '/api/v1/health/records', Object.fromEntries(new FormData(e.target)));
      if (!r) return;
      S.healthRecords = r.data.healthRecords;
      S.pets = r.data.pets;
      closeDrawer();
      render();
      toast('已保存');
    },

    openLedgerForm() {
      openDrawer(`
        ${sheetHead('记一笔')}
        <form onsubmit="App.submitLedger(event)">
          <div class="field-row">
            <div class="field"><label>收支</label><select name="type"><option>支出</option><option>收入</option></select></div>
            <div class="field"><label>金额（元）</label><input name="amount" type="number" step="0.01" min="0.01" required /></div>
          </div>
          <div class="field"><label>分类</label><select name="category"><option>饮食口粮</option><option>医疗疫苗</option><option>体内外驱虫</option><option>零食营养品</option><option>玩具服饰</option><option>洗护美容</option><option>宠拍/补贴</option><option>闲置回血</option></select></div>
          <div class="field"><label>说明</label><input name="title" required maxlength="60" placeholder="比如：猫砂两袋" /></div>
          <div class="field-row">
            <div class="field"><label>日期</label><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
            <div class="field"><label>备注</label><input name="note" maxlength="60" /></div>
          </div>
          <button class="submit">保存</button>
        </form>`);
    },
    async submitLedger(e) {
      e.preventDefault();
      const o = Object.fromEntries(new FormData(e.target));
      o.amount = Number(o.amount);
      const r = await api('POST', '/api/v1/ledger/entries', o);
      if (!r) return;
      S.ledgerEntries = r.data.ledgerEntries;
      closeDrawer();
      render();
      toast('记好了');
    },

    openReminderForm() {
      openDrawer(`
        ${sheetHead('新提醒')}
        <form onsubmit="App.submitReminder(event)">
          <div class="field"><label>要做的事</label><input name="title" required maxlength="60" placeholder="比如：剪指甲" /></div>
          <div class="field-row">
            <div class="field"><label>时间</label><input name="time" value="今日 20:00" /></div>
            <div class="field"><label>重复</label><select name="cycle"><option>单次提醒</option><option>每日重复</option><option>每周重复</option><option>每月重复</option><option>每15天</option></select></div>
          </div>
          <div class="field"><label>分类</label><select name="category"><option>日常护理</option><option>驱虫免疫</option><option>设备维护</option><option>洗护卫生</option></select></div>
          <label class="check-line"><input class="chk" type="checkbox" name="urgent" value="1" />标记为要紧</label>
          <button class="submit">保存</button>
        </form>`);
    },
    async submitReminder(e) {
      e.preventDefault();
      const o = Object.fromEntries(new FormData(e.target));
      o.urgent = Boolean(o.urgent);
      const r = await api('POST', '/api/v1/reminders', o);
      if (!r) return;
      S.reminders = r.data.reminders;
      closeDrawer();
      render();
    },
    async toggleReminder(id) {
      const r = await api('PATCH', '/api/v1/reminders/toggle', { id });
      if (!r) return;
      S.reminders = r.data.reminders;
      render();
    },

    async bookItem(kind, i) {
      const d = S.servicesData || {};
      const item = (d[kind] || [])[i];
      if (!item) return;
      const map = {
        hospitals: ['医院挂号', item.name],
        groomingBoarding: [item.type, `${item.shopName} · ${item.title}`],
        transportPlans: ['宠物托运', item.mode],
        onlineDoctors: ['线上问诊', `${item.name} 图文问诊`],
        insurancePlans: ['宠物保险', `${item.name} 投保申请`]
      };
      const pair = map[kind];
      if (!pair) return;
      const r = await api('POST', '/api/v1/services/book', {
        serviceType: pair[0],
        title: pair[1],
        petName: pet().name,
        date: tomorrowAt('14:00')
      });
      if (!r) return;
      S.servicesData.bookings = r.data.bookings;
      render();
      toast(r.message);
    },
    showPolicy(i) {
      const x = ((S.servicesData || {}).insurancePlans || [])[i];
      if (x) toast(x.policyStatus);
    },

    async uploadPhoto() {
      const r = await api('POST', '/api/v1/album/upload', {
        petId: pet().id,
        title: `${pet().name || '它'}的日常`,
        tag: '日常',
        sizeMB: 24
      });
      if (!r) return;
      S.albumState = r.data.albumState;
      render();
      toast(r.message);
    },
    async upgradeAlbum(code) {
      const r = await api('POST', '/api/v1/album/upgrade', { planCode: code });
      if (!r) return;
      S.albumState = r.data.albumState;
      render();
      toast(r.message);
    },

    async deviceCmd(cmd, grams) {
      const r = await api('POST', '/api/v1/devices/command', { command: cmd, grams });
      if (!r) return;
      S.devicesState = r.data.devicesState;
      render();
      toast(r.message);
    },
    startWalk() {
      if (WALK) return;
      const why = geoAvailable();
      if (why) {
        toast(why);
        return;
      }
      WALK = { startedAt: Date.now(), points: [], watchId: null, error: '' };
      saveWalk();
      beginWatch();
      render();
    },
    stopWalk() {
      if (!WALK) return;
      if (!WALK.paused) {
        endWatch();
        WALK.paused = true;
        WALK.pausedAt = Date.now();
      }
      saveWalk();
      const pts = WALK.points;
      const km = (walkMeters(pts) / 1000).toFixed(2);
      const span = pts.length > 1 ? pts[pts.length - 1][2] - pts[0][2] : 0;
      openDrawer(`
        ${sheetHead('这次遛弯')}
        <div class="wl-map">${trackSvg(pts, 'wl-track', 320, 150) || '<p class="wl-wait">没有收到可用的定位点</p>'}</div>
        <div class="wl-stats">
          <div><b>${km}</b><span>公里（估算）</span></div>
          <div><b>${clock(span)}</b><span>时长</span></div>
          <div><b>${pts.length}</b><span>定位点</span></div>
        </div>
        <p class="muted" style="font-size:12px;margin-bottom:12px">里程以服务器按轨迹重新计算为准，飘移的点会被剔除。</p>
        <form onsubmit="App.submitWalk(event)">
          <div class="field"><label>路线名称（可不填）</label><input name="routeNote" maxlength="40" placeholder="比如：河边绕一圈" /></div>
          <button class="submit">保存这次遛弯</button>
        </form>
        <div class="wl-btns">
          <button class="btn btn-ghost" onclick="App.resumeWalk()">还没走完，继续</button>
          <button class="btn btn-ghost" onclick="App.cancelWalk()">不保存</button>
        </div>`);
      render();
    },
    resumeWalk() {
      if (!WALK) return;
      closeDrawer();
      beginWatch();
      render();
    },
    cancelWalk() {
      if (!WALK) return;
      if (typeof confirm === 'function' && !confirm('这次的轨迹会被丢掉，确定不保存？')) return;
      endWatch();
      WALK = null;
      saveWalk();
      closeDrawer();
      render();
    },
    async submitWalk(e) {
      e.preventDefault();
      if (!WALK) return;
      const note = String(new FormData(e.target).get('routeNote') || '').trim();
      const r = await api('POST', '/api/v1/devices/command', {
        command: 'LOG_WALK',
        track: WALK.points,
        routeNote: note
      });
      if (!r) return;
      WALK = null;
      saveWalk();
      S.devicesState = r.data.devicesState;
      closeDrawer();
      render();
      toast(r.message);
    },

    openPostForm() {
      openDrawer(`
        ${sheetHead('发布')}
        <form onsubmit="App.submitPost(event)">
          <div class="field-row">
            <div class="field"><label>类型</label><select name="type"><option>动态</option><option>文章</option></select></div>
            <div class="field"><label>关于谁</label><input name="petTag" value="${esc(pet().name || '')}" maxlength="30" /></div>
          </div>
          <div class="field"><label>标题</label><input name="title" required maxlength="60" /></div>
          <div class="field"><label>正文</label><textarea name="content" rows="5" required maxlength="800"></textarea></div>
          <button class="submit">发布</button>
        </form>`);
    },
    async submitPost(e) {
      e.preventDefault();
      const r = await api('POST', '/api/v1/social/posts', Object.fromEntries(new FormData(e.target)));
      if (!r) return;
      S.socialPosts = r.data.socialPosts;
      UI.tab = 'social';
      UI.socialTab = '推荐';
      closeDrawer();
      render();
      toast('已发布');
    },
    async likePost(id) {
      const r = await api('PATCH', '/api/v1/social/like', { postId: id });
      if (!r) return;
      S.socialPosts = r.data.socialPosts;
      render();
    },
    async toggleFriend(id) {
      const r = await api('PATCH', '/api/v1/social/friend', { friendId: id });
      if (!r) return;
      S.petFriends = r.data.petFriends;
      render();
      toast(r.message);
    },

    async addCart(id) {
      const p = (S.mallProducts || []).find((x) => x.id === id);
      const r = await api('POST', '/api/v1/mall/cart/add', { productId: id, spec: p ? p.specs[0] : '' });
      if (!r) return;
      S.cartItems = r.data.cartItems;
      render();
      toast('已加入购物车');
    },
    openCart() { openDrawer(cartHTML()); },
    async cartUpdate(id, action) {
      const r = await api('PATCH', '/api/v1/mall/cart/update', { cartId: id, action });
      if (!r) return;
      S.cartItems = r.data.cartItems;
      openDrawer(cartHTML());
      render();
    },
    async cartSpec(id, spec) {
      const r = await api('PATCH', '/api/v1/mall/cart/update', { cartId: id, action: 'SPEC', spec });
      if (!r) return;
      S.cartItems = r.data.cartItems;
      openDrawer(cartHTML());
    },
    async cartAll(checked) {
      const r = await api('PATCH', '/api/v1/mall/cart/update', { action: 'TOGGLE_ALL', checkedAll: checked });
      if (!r) return;
      S.cartItems = r.data.cartItems;
      openDrawer(cartHTML());
      render();
    },
    async checkout() {
      const r = await api('POST', '/api/v1/orders/checkout', {});
      if (!r) return;
      S.orders = r.data.orders;
      S.cartItems = r.data.cartItems;
      closeDrawer();
      UI.tab = 'mine';
      UI.orderFilter = '待付款';
      render();
      toast(r.message);
    },
    async orderStatus(id, next) {
      const r = await api('PATCH', '/api/v1/orders/status', { orderId: id, nextStatus: next });
      if (!r) return;
      S.orders = r.data.orders;
      render();
      toast(r.message);
    },

    openProfile() {
      const u = S.currentUser || {};
      openDrawer(`
        ${sheetHead('编辑资料')}
        <form onsubmit="App.submitProfile(event)">
          <div class="field"><label>昵称</label><input name="nickname" value="${esc(u.nickname)}" maxlength="24" /></div>
          <div class="field"><label>简介</label><textarea name="signature" rows="2" maxlength="80">${esc(u.signature)}</textarea></div>
          <div class="field"><label>所在城市</label><input name="city" value="${esc(u.city)}" maxlength="30" /></div>
          <button class="submit">保存</button>
        </form>`);
    },
    async submitProfile(e) {
      e.preventDefault();
      const r = await api('PATCH', '/api/v1/user/profile', Object.fromEntries(new FormData(e.target)));
      if (!r) return;
      S.currentUser = r.data.currentUser;
      closeDrawer();
      render();
    },

    openAddresses() {
      openDrawer(`
        ${sheetHead('收货地址')}
        ${(S.addresses || [])
          .map(
            (a) => `<div class="set-row"><div>${esc(a.name)} ${esc(a.phone)}<small>${esc(a.region)} ${esc(a.detail)}</small></div><span class="tag ${a.isDefault ? 'tag-mint' : 'tag-gray'}">${esc(a.tag)}</span></div>`
          )
          .join('') || '<p class="empty">还没有地址</p>'}
        <button class="submit" style="margin-top:16px" onclick="App.openAddress()">新增地址</button>`);
    },
    openSettings() {
      const u = S.currentUser || {};
      const st = u.settings || {};
      openDrawer(`
        ${sheetHead('设置')}
        <div class="set-block">
          <h4>账号</h4>
          <div class="set-row"><div>${esc(u.nickname)}<small>${esc(u.phoneMasked || '')} · 已登录</small></div></div>
        </div>
        <div class="set-block">
          <h4>通知</h4>
          ${[
            ['pushReminder', '待办到点提醒'],
            ['feedingAlert', '缺粮、滤芯到期提醒'],
            ['fenceAlert', '项圈离开围栏报警']
          ]
            .map((x) => `<label class="set-row"><span>${x[1]}</span><input class="switch" type="checkbox" ${st[x[0]] ? 'checked' : ''} onchange="App.toggleSetting('${x[0]}',this.checked)" /></label>`)
            .join('')}
        </div>
        <div class="set-block">
          <h4>安全</h4>
          <div class="set-row"><div>请求签名<small>每次提交都带签名、时间戳和一次性随机串，被改过或重放的请求会被拒绝</small></div></div>
          <div class="set-row"><span>自检</span><span><button class="btn btn-ghost" onclick="App.testTamper()">篡改测试</button> <button class="btn btn-ghost" onclick="App.testReplay()">重放测试</button></span></div>
        </div>`);
    },
    async toggleSetting(k, v) {
      const settings = {};
      settings[k] = v;
      const r = await api('PATCH', '/api/v1/user/profile', { settings });
      if (!r) return;
      S.currentUser = r.data.currentUser;
      toast('已保存');
    },
    async testTamper() {
      try {
        const r = await PawSecuritySDK.simulateTamperAttack();
        toast(`HTTP ${r.status}：${r.message}`);
      } catch (e) {
        toast('自检没有跑起来');
      }
    },
    async testReplay() {
      try {
        const r = await PawSecuritySDK.simulateReplayAttack();
        await reloadState();
        render();
        toast(`HTTP ${r.status}：${r.message}`);
      } catch (e) {
        toast('自检没有跑起来');
      }
    },

    openAddress() {
      openDrawer(`
        ${sheetHead('新增地址')}
        <form onsubmit="App.submitAddress(event)">
          <div class="field-row">
            <div class="field"><label>收件人</label><input name="name" required maxlength="20" /></div>
            <div class="field"><label>电话</label><input name="phone" required maxlength="20" /></div>
          </div>
          <div class="field"><label>省市区</label><input name="region" value="浙江省 杭州市 西湖区" /></div>
          <div class="field"><label>详细地址</label><input name="detail" required maxlength="80" /></div>
          <div class="field"><label>标签</label><select name="tag"><option>家</option><option>公司</option><option>父母家</option></select></div>
          <label class="check-line"><input class="chk" type="checkbox" name="isDefault" value="1" />设为默认地址</label>
          <button class="submit">保存</button>
        </form>`);
    },
    async submitAddress(e) {
      e.preventDefault();
      const o = Object.fromEntries(new FormData(e.target));
      o.isDefault = Boolean(o.isDefault);
      const r = await api('POST', '/api/v1/user/addresses', o);
      if (!r) return;
      S.addresses = r.data.addresses;
      window.App.openAddresses();
      toast('地址已保存');
    },

    openShare() {
      openDrawer(`
        ${sheetHead('邀请家人共养')}
        <form onsubmit="App.submitShare(event)">
          <div class="field"><label>称呼</label><input name="name" required maxlength="20" placeholder="比如：妈妈" /></div>
          <div class="field"><label>身份</label><select name="role"><option>协同管理员</option><option>家庭共养人</option><option>临时照护员 (限时授权)</option><option>仅查看</option></select></div>
          <div class="field"><label>权限说明</label><input name="permissions" value="可远程喂食、记账、看相册和定位" maxlength="60" /></div>
          <button class="submit">发送邀请</button>
        </form>`);
    },
    async submitShare(e) {
      e.preventDefault();
      const r = await api('POST', '/api/v1/user/share-pet', Object.fromEntries(new FormData(e.target)));
      if (!r) return;
      S.sharedMembers = r.data.sharedMembers;
      closeDrawer();
      render();
      toast(r.message);
    },

    openDoc(kind) {
      const c = S.complianceDocs || {};
      let title = '';
      let html = '';
      if (kind === 'about' && c.aboutUs) {
        title = '关于我们';
        html = `<p>${esc(c.aboutUs.content)}</p><span class="doc-meta">${esc(c.aboutUs.version)}</span>`;
      } else if (kind === 'agreement' && c.userAgreement) {
        title = '用户协议';
        html = `<p>${esc(c.userAgreement.content)}</p><span class="doc-meta">${esc(c.userAgreement.version)}</span>`;
      } else if (kind === 'service' && c.customerService) {
        title = '联系客服';
        html = `<p>电话 ${esc(c.customerService.hotline)}<br />微信 ${esc(c.customerService.wechat)}</p>${(c.customerService.faq || [])
          .map((f) => `<div class="doc-item"><p>${esc(f)}</p></div>`)
          .join('')}`;
      } else if (kind === 'announce') {
        title = '公告';
        html = (c.announcements || [])
          .map((a) => `<div class="doc-item"><span class="doc-meta">${esc(a.date)}</span><b>${esc(a.title)}</b><p>${esc(a.summary)}</p></div>`)
          .join('');
      }
      openDrawer(`${sheetHead(title || '说明')}<div class="doc">${html || '<p>暂无内容</p>'}</div>`);
    }
  };

  document.querySelectorAll('#bottomTabbar .tab-btn').forEach((b) =>
    b.addEventListener('click', () => {
      UI.tab = b.dataset.tab;
      if (UI.tab === 'home' && lastView.startsWith('home')) UI.homeSub = 'main';
      render();
    })
  );
  $('#drawerBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'drawerBackdrop') closeDrawer();
  });

  (async function init() {
    try {
      await reloadState();
      restoreWalk();
      render();
    } catch (e) {
      $('#appViewport').innerHTML = '<header class="top"><h1>爪印日记</h1></header><section class="card"><p class="empty">连不上服务器，确认后端已启动后刷新</p></section>';
    }
  })();
})();
