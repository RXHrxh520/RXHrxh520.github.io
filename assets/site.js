/* rxh.asia 主站脚本 v2 */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const AUTH = 'https://auth.rxh.asia';
  const STATUS = 'https://status.rxh.asia';
  const SID_KEY = 'rxh_sid';

  /* ---------- 视图路由 ---------- */
  const views = ['home', 'status', 'sites', 'me'];
  function go(v) {
    if (!views.includes(v)) v = 'home';
    const apply = () => doGo(v);
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(apply);
    } else { apply(); }
  }
  function doGo(v) {
    $$('.view').forEach(el => el.classList.toggle('on', el.id === 'v-' + v));
    $$('nav.tabs .tab').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'status') loadStatus(true);
    if (v === 'me') {
      if (me) { location.href = 'https://auth.rxh.asia/account/'; return; }
      renderMe();
    }
    history.replaceState(null, '', v === 'home' ? '/' : '/#' + v);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('[data-view]').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));

  /* ---------- 主题 & 配色 ---------- */
  const PALETTES = [
    { k: 'rose', n: '玫瑰', c1: '#ff7ab8', c2: '#b45cff' },
    { k: 'ocean', n: '海蓝', c1: '#5cb8ff', c2: '#4a6bff' },
    { k: 'mint', n: '薄荷', c1: '#4fe0b6', c2: '#2bb0a0' },
    { k: 'amber', n: '琥珀', c1: '#ffc35c', c2: '#ff8a4c' },
    { k: 'violet', n: '紫罗兰', c1: '#b98bff', c2: '#7a5cff' },
    { k: 'coral', n: '珊瑚', c1: '#ff8f7a', c2: '#ff5c8a' },
    { k: 'sky', n: '青空', c1: '#7ee7ff', c2: '#4aa8ff' },
    { k: 'gray', n: '石墨', c1: '#b9c4dc', c2: '#7d8aa6' },
  ];
  const allowPalette = k => PALETTES.some(p => p.k === k);

  function applyPalette(k) {
    const p = PALETTES.find(x => x.k === k) || PALETTES[0];
    document.documentElement.style.setProperty('--glow1', p.c1);
    document.documentElement.style.setProperty('--glow2', p.c2);
    localStorage.setItem('rxh_palette', p.k);
    $$('.sw').forEach(el => el.classList.toggle('on', el.dataset.k === p.k));
  }
  function buildPalette() {
    $('#paletteGrid').innerHTML = PALETTES.map(p =>
      `<button class="sw" data-k="${p.k}" style="background:linear-gradient(140deg,${p.c1},${p.c2})"><span>${p.n}</span></button>`).join('');
    $$('.sw').forEach(b => b.addEventListener('click', () => applyPalette(b.dataset.k)));
    applyPalette(localStorage.getItem('rxh_palette') || 'ocean');
  }

  function applyTheme(t) {
    document.body.classList.toggle('light', t === 'light');
    localStorage.setItem('rxh_theme', t);
  }
  function initTheme() {
    const saved = localStorage.getItem('rxh_theme');
    applyTheme(saved === 'light' ? 'light' : 'dark');
    $('#themeBtn').addEventListener('click', () =>
      applyTheme(document.body.classList.contains('light') ? 'dark' : 'light'));
  }

  /* ---------- 弹层 ---------- */
  function openModal(el) {
    $('#mask').classList.add('on'); el.classList.add('on');
  }
  function closeModals() {
    $('#mask').classList.remove('on');
    $$('.modal').forEach(m => m.classList.remove('on'));
  }
  $('#mask').addEventListener('click', closeModals);
  $$('[data-close]').forEach(b => b.addEventListener('click', closeModals));
  addEventListener('keydown', e => { if (e.key === 'Escape') closeModals(); });

  $('#paletteBtn').addEventListener('click', () => openModal($('#paletteModal')));

  /* ---------- 公告条 ---------- */
  async function loadNotice() {
    try {
      const r = await fetch(AUTH + '/api/notice', { cache: 'no-store' });
      const d = await r.json();
      const items = d.items || [];
      if (!items.length) return;
      $('#nbText').textContent = items.map(x => x.text).join('　·　');
      $('#noticebar').classList.add('on');
      document.documentElement.style.setProperty('--nbh', '0px');
    } catch (e) { }
  }

  /* ---------- 通知 ---------- */
  const N_META = {
    1: { label: '系统公告', icon: '<path d="M4 10v4h3l6 4V6l-6 4H4Z"/><path d="M17 9a4 4 0 0 1 0 6"/>' },
    2: { label: '管理员公告', icon: '<path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M5 11v5l7 4 7-4v-5"/>' },
    3: { label: '系统通知', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/>' },
    4: { label: '安全通知', icon: '<path d="M12 3l7 3v6c0 4-3 7-7 9-7-2-7-5-7-9V6l7-3Z"/><path d="m9 12 2 2 4-4"/>' },
    5: { label: '测试通知', icon: '<path d="M9 3h6M10 3v6L5 19h14L14 9V3"/><path d="M7.5 14h9"/>' },
  };
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function loadNotices() {
    try {
      const r = await fetch(AUTH + '/api/notifications', { cache: 'no-store' });
      const d = await r.json();
      const items = (d.items || []).slice(0, 20);
      const list = $('#noticeList');
      if (!items.length) { list.innerHTML = '<div class="n-empty">暂无通知</div>'; $('#bellDot').classList.remove('on'); return; }
      list.innerHTML = items.map(n => {
        const m = N_META[n.type] || N_META[3];
        return `<div class="n-item t${n.type}">
          <div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${m.icon}</svg></div>
          <div><div class="tt">${esc(n.title)}</div>
          ${n.body ? `<div class="bd">${esc(n.body)}</div>` : ''}
          <div class="tm">${m.label} · ${new Date(n.created_at).toLocaleString('zh-CN')}</div></div>
        </div>`;
      }).join('');
      const seen = Number(localStorage.getItem('rxh_nseen') || 0);
      const newest = Math.max(...items.map(i => i.id));
      const unread = seen ? items.filter(i => i.id > seen).length : items.length;
      const dot = $('#bellDot');
      if (unread) { dot.textContent = unread > 9 ? '9+' : unread; dot.classList.add('on'); }
      else dot.classList.remove('on');
      $('#bell').dataset.newest = newest;
    } catch (e) { }
  }
  $('#bell').addEventListener('click', async () => {
    await loadNotices();
    openModal($('#noticeModal'));
    const newest = Number($('#bell').dataset.newest || 0);
    if (newest) localStorage.setItem('rxh_nseen', newest);
    $('#bellDot').classList.remove('on');
  });

  /* ---------- 站外链接（100ms 预检） ---------- */
  const HOSTS_SELF = ['rxh.asia', 'www.rxh.asia', 'status.rxh.asia', 'open.rxh.asia', 'auth.rxh.asia', 'admin.rxh.asia', 'dev.rxh.asia'];
  function isExternal(a) {
    try {
      const u = new URL(a.href, location.href);
      if (u.origin === location.origin) return false;
      return !HOSTS_SELF.includes(u.hostname);
    } catch (e) { return false; }
  }
  function precheck(url) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => { ctrl.abort(); resolve({ ok: false, ms: 100, reason: 'timeout' }); }, 100);
      fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal })
        .then(() => { clearTimeout(timer); resolve({ ok: true, ms: Math.round(performance.now() - t0) }); })
        .catch(() => { clearTimeout(timer); resolve({ ok: false, ms: Math.round(performance.now() - t0), reason: 'blocked' }); });
    });
  }
  document.addEventListener('click', async e => {
    const a = e.target.closest('a[href]');
    if (!a || a.hasAttribute('data-close') || a.id === 'extGo') return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (!isExternal(a)) return;
    e.preventDefault();
    const url = a.href;
    const info = $('#extInfo');
    info.textContent = '正在检查目标站点可用性…';
    $('#extGo').href = url;
    $('#extGo').removeAttribute('target');
    openModal($('#extModal'));
    const chk = await precheck(url);
    info.textContent = (chk.ok ? `目标站点可访问（${chk.ms}ms）` : '未在 100ms 内确认可达，仍可继续访问') + ' · ' + url;
  });

  /* ---------- 状态 ---------- */
  let stCache = null;
  function fmtPing(ms) { return ms ? ms + ' ms' : '—'; }
  function renderMini(d) {
    const svcs = (d.services || []).slice(0, 5);
    const bad = svcs.filter(s => s.status === 'outage').length;
    const warn = svcs.filter(s => s.status === 'degraded').length;
    const pill = $('#smPill');
    pill.className = 'pill ' + (bad ? 'bad' : warn ? 'warn' : 'ok');
    pill.textContent = bad ? `${bad} 项中断` : warn ? `${warn} 项降级` : '全部正常';
    $('#smList').innerHTML = svcs.map(s => {
      const cls = s.status === 'outage' ? 'bad' : s.status === 'degraded' ? 'warn' : '';
      return `<div class="sm-row"><i class="led ${cls}"></i><span class="nm">${esc(s.name)}</span><span class="ms">${fmtPing(s.latency_ms)}</span></div>`;
    }).join('');
    $('#smUpdated').textContent = '更新 ' + new Date(d.generated_at).toLocaleTimeString('zh-CN', { hour12: false });
  }
  function renderStatus(d) {
    const svcs = d.services || [];
    $('#stSub').textContent = `${svcs.length} 个服务 · 更新于 ${new Date(d.generated_at).toLocaleString('zh-CN')}`;
    $('#stGrid').innerHTML = svcs.map(s => {
      const bad = s.status === 'outage';
      const up = s.uptime_90d == null ? null : Math.round(s.uptime_90d * 1000) / 10;
      return `<div class="sp-item">
        <div class="row1"><i class="led ${bad ? 'bad' : s.status === 'degraded' ? 'warn' : ''}" style="width:8px;height:8px;border-radius:50%;background:${bad ? 'var(--bad)' : s.status === 'degraded' ? 'var(--warn)' : 'var(--ok)'}"></i>
          <span class="name">${esc(s.name)}</span></div>
        <div class="url">${esc(String(s.url).replace(/^https?:\/\//, ''))}</div>
        <div class="metrics"><div>Ping<b>${fmtPing(s.latency_ms)}</b></div><div>可用率<b>${up == null ? '—' : up + '%'}</b></div></div>
        <div class="uptime"><i class="${bad ? 'bad' : ''}" style="width:${up == null ? 0 : up}%"></i></div>
        ${s.error ? `<div class="url" style="color:var(--bad);margin-top:8px">${esc(s.error)}</div>` : ''}
      </div>`;
    }).join('');
  }
  async function loadStatus(probe) {
    try {
      const r = await fetch(STATUS + '/api/status' + (probe ? '?probe=1' : ''), { cache: 'no-store' });
      const d = await r.json();
      stCache = d;
      renderMini(d); renderStatus(d);
    } catch (e) {
      $('#smPill').className = 'pill bad'; $('#smPill').textContent = '获取失败';
      $('#stSub').textContent = '状态数据获取失败，稍后重试';
    }
  }
  $('#stRefresh').addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = '探测中…';
    await loadStatus(true); b.disabled = false; b.textContent = '立即刷新';
  });

  /* ---------- 子站 ---------- */
  const SITES = [
    { n: '开发人员', d: '项目、仓库与更新日志，粉色主题的子站。', u: 'dev.rxh.asia', h: 'https://dev.rxh.asia/', i: 'code' },
    { n: '开放平台', d: '面向开发者的接口门户，账号与主站统一。', u: 'open.rxh.asia', h: 'https://open.rxh.asia/', i: 'api' },
    { n: '站点状态', d: '边缘定时探测，Ping 与 90 天可用率。', u: 'status.rxh.asia', h: 'https://status.rxh.asia/', i: 'wave' },
    { n: '账号中心', d: '统一账号：昵称、头像、密码与 ID。', u: 'auth.rxh.asia', h: 'https://auth.rxh.asia/', i: 'user' },
  ];
  const ICONS = {
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
    api: '<path d="M4 7h16v10H4z"/><path d="M8 11h.01M12 11h.01M8 14h6"/>',
    wave: '<path d="M3 12h4l2.5 6 4-12 2.5 6H21"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/>',
  };
  function siteCard(s) {
    return `<a class="site" href="${s.h}"><div class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${ICONS[s.i]}</svg>${s.n}</div>
      <div class="d">${s.d}</div><div class="u">${s.u} ↗</div></a>`;
  }
  $('#homeSites').innerHTML = SITES.slice(0, 3).map(siteCard).join('');
  $('#siteList').innerHTML = SITES.map(siteCard).join('');

  /* ---------- 账号 ---------- */
  let me = null;
  async function fetchMe() {
    const sid = localStorage.getItem(SID_KEY) || '';
    try {
      const r = await fetch(AUTH + '/api/me', { headers: sid ? { Authorization: 'Bearer ' + sid } : {}, cache: 'no-store', credentials: 'include' });
      const d = await r.json();
      if (d.banned) { localStorage.removeItem(SID_KEY); showBan(d.ban); return null; }
      if (d.user) { me = d.user; localStorage.setItem('rxh_uid', me.uid); }
      return d.user || null;
    } catch (e) { return null; }
  }
  function showBan(ban) {
    const m = $('#extModal');
    $('#extInfo').textContent = '';
    $('#extInfo').innerHTML = `<b style="color:var(--bad)">账号已被封禁</b><br>原因：${esc(ban.reason || '未填写')}<br>时间：${esc(ban.start_at)} → ${esc(ban.end_at)}`;
    $('#extGo').textContent = '知道了'; $('#extGo').href = 'javascript:void(0)';
    openModal(m);
  }
  function setAuthBtn() {
    $('#authBtn').textContent = me ? (me.name || '我的账号') : '登录 / 注册';
  }
  $('#authBtn').addEventListener('click', () => {
    if (me) return go('me');
    window.RXHAuth.open({ onSuccess: afterAuth });
  });
  async function afterAuth(user) {
    me = user; setAuthBtn(); loadNotices();
    location.href = 'https://auth.rxh.asia/account/';
  }
  function renderMe() {
    const card = $('#meCard');
    if (!me) {
      $('#meAva').textContent = '未'; $('#meAva').style.background = '';
      $('#meName').textContent = '未登录';
      $('#meUid').textContent = '登录后可查看账号信息';
      $('#meActions').innerHTML = `<button class="big-btn primary" id="meLogin">登录 / 注册</button>`;
      $('#meLogin').addEventListener('click', () => window.RXHAuth.open({ onSuccess: afterAuth }));
      return;
    }
    if (me.avatar) {
      $('#meAva').outerHTML = `<img class="me-ava" id="meAva" src="${esc(me.avatar)}" alt="">`;
    } else { $('#meAva').textContent = (me.name || 'U').slice(0, 1); }
    $('#meName').textContent = me.name;
    $('#meUid').textContent = me.uid + (me.is_admin ? ' · 管理员' : '');
    $('#meActions').innerHTML = `
      <a class="big-btn primary" href="https://auth.rxh.asia/account/" style="padding:9px 16px;font-size:13px">账号中心</a>
      ${me.is_admin ? '<a class="big-btn" href="https://admin.rxh.asia/" style="padding:9px 16px;font-size:13px">管理后台</a>' : ''}
      <button class="big-btn" id="logoutBtn" style="padding:9px 16px;font-size:13px">退出登录</button>`;
    $('#logoutBtn').addEventListener('click', async () => {
      const sid = localStorage.getItem(SID_KEY) || '';
      await fetch(AUTH + '/api/logout', { method: 'POST', headers: sid ? { Authorization: 'Bearer ' + sid } : {}, credentials: 'include' }).catch(() => { });
      localStorage.removeItem(SID_KEY); localStorage.removeItem('rxh_uid');
      me = null; setAuthBtn(); renderMe();
    });
  }

  /* ---------- 音乐播放器 ---------- */
  $('#mToggle').addEventListener('click', e => {
    e.stopPropagation();
    $('#music').classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#music')) $('#music').classList.remove('open');
  });

  /* ---------- 启动 ---------- */
  initTheme();
  buildPalette();
  loadNotice();
  loadStatus(false);
  loadNotices();
  fetchMe().then(() => { setAuthBtn(); renderMe(); });

  const hash = location.hash.replace('#', '');
  if (hash && views.includes(hash)) go(hash);
  setInterval(loadNotices, 60000);
  setInterval(() => loadStatus(false), 300000);
})();
