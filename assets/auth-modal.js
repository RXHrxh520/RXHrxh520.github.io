/* 统一账号弹层：主站与开放平台共用一个登录/注册组件 */
(() => {
  const AUTH = 'https://auth.rxh.asia';
  const SITEKEY = '0x4AAAAAAGPRu0xFiTmg5BYn';
  const SID_KEY = 'rxh_sid';
  let built = false, widgetId = null, tok = null, onOK = null, mode = 'login', forcedLight = false;

  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CSS = `
  .rxh-mask{position:fixed;inset:0;z-index:200;background:rgba(4,6,12,.62);backdrop-filter:blur(5px);display:none}
  .rxh-mask.on{display:block}
  .rxh-modal{position:fixed;z-index:210;left:50%;top:50%;transform:translate(-50%,-50%);width:min(430px,calc(100vw - 24px));
    max-height:88vh;overflow:auto;border-radius:22px;border:1px solid rgba(255,255,255,.13);
    background:linear-gradient(165deg,rgba(26,30,52,.98),rgba(14,17,30,.99));color:#eef1fb;padding:22px;
    box-shadow:0 34px 80px -30px #000;display:none;font:14px/1.6 "PingFang SC","Microsoft YaHei",system-ui,sans-serif}
  .rxh-modal.on{display:block;animation:rxhpop .22s ease both}
  @keyframes rxhpop{from{opacity:0;transform:translate(-50%,-46%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  .rxh-modal .x{position:absolute;right:14px;top:12px;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#9aa4c0;background:none;border:0;cursor:pointer}
  .rxh-modal .x:hover{background:rgba(255,255,255,.09);color:#fff}
  .rxh-modal h4{margin:0;font-size:17px;font-weight:700}
  .rxh-modal .hint{color:#9aa4c0;font-size:12.5px;margin:3px 0 0}
  .rxh-choose{display:grid;gap:10px;margin-top:18px}
  .rxh-choice{width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#eef1fb;font:inherit;font-size:14px;cursor:pointer;transition:.18s}
  .rxh-choice svg{width:18px;height:18px;fill:currentColor;flex:0 0 18px}
  .rxh-choice svg.lock{fill:none;stroke:currentColor;stroke-width:1.7}
  .rxh-choice.primary{background:linear-gradient(135deg,#ff7ab8,#b45cff);border-color:transparent;color:#140e1e;font-weight:700}
  .rxh-choice.github{font-weight:600}
  .rxh-tabs{display:flex;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:4px;margin:10px 0 4px}
  .rxh-tabs button{flex:1;padding:8px;border-radius:9px;border:0;background:none;color:#9aa4c0;font:inherit;font-size:13.5px;cursor:pointer;transition:.18s}
  .rxh-tabs button.on{background:linear-gradient(135deg,#ff7ab8,#b45cff);color:#140e1e;font-weight:600}
  .rxh-field{margin-top:12px}
  .rxh-field label{display:block;font-size:12px;color:#9aa4c0;margin-bottom:5px}
  .rxh-field input,.rxh-field select{width:100%;padding:11px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.12);
    background:rgba(255,255,255,.05);color:#eef1fb;font:inherit;font-size:13.5px;outline:none;transition:.16s}
  .rxh-field input::placeholder{color:#6f7899}
  .rxh-field input:focus,.rxh-field select:focus{border-color:rgba(255,122,184,.6);background:rgba(255,255,255,.08)}
  .rxh-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .rxh-ts{margin-top:14px;min-height:64px;display:flex;justify-content:center}
  .rxh-agree{display:flex;gap:8px;align-items:flex-start;margin-top:14px;font-size:12px;color:#9aa4c0;line-height:1.55}
  .rxh-agree input{width:15px;height:15px;margin-top:2px;accent-color:#ff7ab8}
  .rxh-agree b{color:#eef1fb;cursor:pointer;border-bottom:1px dashed rgba(255,255,255,.25);font-weight:400}
  .rxh-submit{width:100%;margin-top:16px;padding:12px;border-radius:12px;border:0;cursor:pointer;font:inherit;font-weight:700;font-size:14px;
    background:linear-gradient(135deg,#ff7ab8,#b45cff);color:#140e1e;transition:.18s}
  .rxh-submit:hover{filter:brightness(1.07)}
  .rxh-submit:disabled{opacity:.6;cursor:default}
  .rxh-msg{margin-top:10px;font-size:12.5px;min-height:18px;color:#ff6470}
  .rxh-msg.ok{color:#37e0a0}
  .rxh-foot{margin-top:12px;text-align:center;font-size:11.5px;color:#6f7899}
  .rxh-doc{position:fixed;z-index:220;left:50%;top:50%;transform:translate(-50%,-50%);width:min(470px,calc(100vw - 30px));max-height:74vh;overflow:auto;
    background:#141829;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:20px;display:none;color:#dfe4f5;font-size:12.5px;line-height:1.75}
  .rxh-doc.on{display:block}
  .rxh-doc h5{margin:0 0 8px;font-size:15px;color:#fff}
  .rxh-doc p{margin:0 0 9px;color:#9aa4c0}
  .rxh-doc button{margin-top:8px;padding:8px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;font:inherit}
  
  body.light .rxh-mask{background:rgba(238,241,250,.6)}
  body.light .rxh-modal{background:linear-gradient(165deg,#fff,#f5f7fd);border-color:rgba(20,26,48,.13);color:#171d33;box-shadow:0 34px 80px -34px rgba(40,50,90,.35)}
  body.light .rxh-modal .x{color:#7b8599}
  body.light .rxh-modal .x:hover{background:rgba(20,26,48,.06);color:#171d33}
  body.light .rxh-modal .hint{color:#68738a}
  body.light .rxh-choice{border-color:rgba(20,26,48,.13);background:#fff;color:#171d33}
  body.light .rxh-choice.primary{background:linear-gradient(135deg,#ff7ab8,#b45cff);color:#fff;border-color:transparent}
  body.light .rxh-tabs{background:rgba(20,26,48,.045);border-color:rgba(20,26,48,.1)}
  body.light .rxh-tabs button{color:#68738a}
  body.light .rxh-tabs button.on{background:linear-gradient(135deg,#ff7ab8,#b45cff);color:#fff}
  body.light .rxh-field label{color:#68738a}
  body.light .rxh-field input,body.light .rxh-field select{background:#fff;border-color:rgba(20,26,48,.13);color:#171d33}
  body.light .rxh-field input::placeholder{color:#98a1b3}
  body.light .rxh-field input:focus,body.light .rxh-field select:focus{border-color:rgba(255,122,184,.65);background:#fff}
  body.light .rxh-agree{color:#68738a}
  body.light .rxh-agree b{color:#171d33;border-bottom-color:rgba(20,26,48,.18)}
  body.light .rxh-foot{color:#8a94a8}
  body.light .rxh-doc{background:#fff;border-color:rgba(20,26,48,.13);color:#2a3144;box-shadow:0 34px 80px -40px rgba(40,50,90,.35)}
  body.light .rxh-doc button{color:#171d33;background:rgba(20,26,48,.06)}
`;

  const TERMS = `<h5>用户协议（摘要）</h5>
    <p>1. 本站为个人技术站点群，提供账号、状态查询、开放平台演示等服务，不承诺商业级可用性。</p>
    <p>2. 注册需邀请码与人机验证；账号仅限本人使用，不得转让、出租或用于自动化恶意请求。</p>
    <p>3. 禁止利用本站服务从事违法活动、攻击他人系统、批量抓取数据或绕过访问限制。</p>
    <p>4. 管理员可在违规时封禁账号并终止会话，封禁期间账号无法访问关联服务。</p>
    <p>5. 服务可能因维护、上游故障而中断，本站不承担由此产生的间接损失。</p>
    <p>6. 协议变更会在站内公告，继续使用视为接受更新。</p>
    <p>联系方式：{联系邮箱} · 地址：{通信地址} · 电话：{联系电话}</p>`;
  const PRIVACY = `<h5>隐私协议（摘要）</h5>
    <p>1. 我们仅收集注册所必需的邮箱、昵称、性别标识及登录会话信息，用于账号识别与安全校验。</p>
    <p>2. 密码以 PBKDF2 加盐哈希存储，服务端不保存明文密码。</p>
    <p>3. 访问日志可能记录 IP、User-Agent 与时间，用于风控、封禁与故障排查，保留期不超过 90 天。</p>
    <p>4. 人机验证由 Cloudflare Turnstile 提供，会采集浏览器指纹类信息用于判定自动化流量。</p>
    <p>5. 我们不会向第三方出售你的个人信息，除依法配合监管要求外不主动披露。</p>
    <p>6. 你可以联系管理员申请更正或删除账号数据。</p>
    <p>联系方式：{联系邮箱} · 地址：{通信地址} · 电话：{联系电话}</p>`;

  function build() {
    if (built) return;
    built = true;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const mask = document.createElement('div'); mask.className = 'rxh-mask'; mask.id = 'rxhMask';
    const modal = document.createElement('div'); modal.className = 'rxh-modal'; modal.id = 'rxhModal';
    modal.innerHTML = `
      <button class="x" data-x>✕</button>
      <h4>账号登录</h4>
      <div class="rxh-choose" id="rxhChoose">
        <button class="rxh-choice primary" type="button" data-choice="pwd"><svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/></svg>账密登录</button>
        <button class="rxh-choice github" type="button" data-choice="github"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>GitHub 登录</button>
      </div>
      <div id="rxhBody" style="display:none">
      <p class="hint">统一账号，登录后可在主站、开放平台与账号中心通用</p>
      <div class="rxh-tabs"><button class="on" data-tab="login">登录</button><button data-tab="reg">注册</button></div>
      <form id="rxhForm" autocomplete="off">
        <div id="rxhLogin">
          <div class="rxh-field"><label>账号</label><input id="rxhAcc" placeholder="请输入账号、邮箱或用户 ID" autocomplete="username"></div>
          <div class="rxh-field"><label>密码</label><input id="rxhPwd" type="password" placeholder="请输入您的密码" autocomplete="current-password"></div>
        </div>
        <div id="rxhReg" style="display:none">
          <div class="rxh-field"><label>邮箱</label><input id="rxhEmail" placeholder="请输入您的邮箱" autocomplete="email"></div>
          <div class="rxh-row2">
            <div class="rxh-field"><label>昵称（可选）</label><input id="rxhName" placeholder="请输入昵称"></div>
            <div class="rxh-field"><label>性别</label><select id="rxhGender"><option value="0">男</option><option value="1">女</option></select></div>
          </div>
          <div class="rxh-field"><label>密码</label><input id="rxhPwd2" type="password" placeholder="请设置至少 8 位密码" autocomplete="new-password"></div>
          <div class="rxh-field"><label>邀请码</label><input id="rxhInvite" placeholder="请输入管理员提供的邀请码"></div>
        </div>
        <div class="rxh-ts" id="rxhTs"></div>
        <label class="rxh-agree"><input type="checkbox" id="rxhAgree">
          <span>我已阅读并同意 <b data-doc="terms">《用户协议》</b> 与 <b data-doc="privacy">《隐私协议》</b></span></label>
        <button class="rxh-submit" id="rxhGo" type="submit">登录</button>
        <div class="rxh-msg" id="rxhMsg"></div>
      </form>
      <div class="rxh-foot">注册需要邀请码 · 人机验证有效期 30 分钟</div>
      </div>`;
    const doc = document.createElement('div'); doc.className = 'rxh-doc'; doc.id = 'rxhDoc';
    doc.innerHTML = `<div id="rxhDocBody"></div><button data-x-doc>关闭</button>`;
    document.body.append(mask, modal, doc);

    mask.addEventListener('click', close);
    modal.querySelector('[data-x]').addEventListener('click', close);
    doc.querySelector('[data-x-doc]').addEventListener('click', () => doc.classList.remove('on'));
    modal.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.tab)));
    modal.querySelector('[data-choice="pwd"]').addEventListener('click', () => {
      document.querySelector('#rxhChoose').style.display = 'none';
      document.querySelector('#rxhBody').style.display = '';
      setMode('login');
      setTimeout(() => modal.querySelector('#rxhAcc').focus(), 120);
    });
    modal.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => {
      doc.querySelector('#rxhDocBody').innerHTML = b.dataset.doc === 'terms' ? TERMS : PRIVACY;
      doc.classList.add('on');
    }));
    modal.querySelector('#rxhForm').addEventListener('submit', submit);
  }

  function resetTurnstile() {
    tok = null;
    const box = document.querySelector('#rxhTs');
    if (!box) return;
    if (window.turnstile) {
      if (widgetId !== null) { try { turnstile.reset(widgetId); } catch (e) { } }
      else widgetId = turnstile.render('#rxhTs', {
        sitekey: SITEKEY, theme: document.body.classList.contains('light') ? 'light' : 'dark', size: 'flexible',
        callback: t => { tok = t; msg('', ''); },
        'error-callback': () => { tok = null; msg('人机验证加载失败，请刷新重试', 'bad'); },
        'expired-callback': () => { tok = null; },
      });
    }
  }

  function loadTs(cb) {
    if (window.turnstile) return cb();
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.onload = cb; s.onerror = () => msg('人机验证组件加载失败', 'bad');
    document.head.appendChild(s);
  }

  function msg(t, kind) {
    const el = document.querySelector('#rxhMsg');
    if (!el) return;
    el.textContent = t || '';
    el.className = 'rxh-msg' + (kind === 'ok' ? ' ok' : '');
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('#rxhModal [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === m));
    document.querySelector('#rxhLogin').style.display = m === 'login' ? '' : 'none';
    document.querySelector('#rxhReg').style.display = m === 'reg' ? '' : 'none';
    document.querySelector('#rxhGo').textContent = m === 'login' ? '登录' : '注册';
    const tsBox = document.querySelector('#rxhTs');
    if (tsBox) tsBox.style.display = m === 'login' ? 'none' : 'flex';
    msg('');
    tok = null;
    if (m === 'reg') {
      const box = document.querySelector('#rxhTs');
      if (box) box.style.display = 'flex';
      loadTs(() => requestAnimationFrame(resetTurnstile));
    }
  }

  function close() {
    if (forcedLight) { document.body.classList.remove('light'); forcedLight = false; }
    document.querySelector('#rxhMask').classList.remove('on');
    document.querySelector('#rxhModal').classList.remove('on');
    document.querySelector('#rxhDoc').classList.remove('on');
    document.body.style.overflow = '';
  }

  function pageIsLight() {
    if (document.body.classList.contains('light')) return false;
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const parts = m[1].split(',').map(v => parseFloat(v.trim()));
    const [r, g, b, a = 1] = parts;
    if (a < 0.3) return false;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 150;
  }

  function open(opts = {}) {
    build();
    if (pageIsLight()) {
      document.body.classList.add('light');
      forcedLight = true;
    }

    onOK = opts.onSuccess || null;
    document.querySelector('#rxhMask').classList.add('on');
    document.querySelector('#rxhModal').classList.add('on');
    document.body.style.overflow = 'hidden';
    document.querySelector('#rxhChoose').style.display = '';
    document.querySelector('#rxhBody').style.display = 'none';
    setMode(opts.mode === 'reg' ? 'reg' : 'login');
  }

  async function submit(e) {
    e.preventDefault();
    const btn = document.querySelector('#rxhGo');
    const agree = document.querySelector('#rxhAgree').checked;
    if (!agree) return msg('请先勾选用户协议与隐私协议');
    if (mode === 'reg' && !tok) return msg('请先完成人机验证');

    const body = mode === 'login'
      ? { account: document.querySelector('#rxhAcc').value.trim(), password: document.querySelector('#rxhPwd').value, turnstile: tok }
      : {
          email: document.querySelector('#rxhEmail').value.trim(),
          name: document.querySelector('#rxhName').value.trim(),
          password: document.querySelector('#rxhPwd2').value,
          invite: document.querySelector('#rxhInvite').value.trim(),
          gender: Number(document.querySelector('#rxhGender').value || 0),
          turnstile: tok,
        };
    btn.disabled = true; msg('处理中…');
    try {
      const r = await fetch(AUTH + (mode === 'login' ? '/api/login' : '/api/register'), {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (d.banned) {
        msg(`账号已被封禁：${d.ban && d.ban.reason ? d.ban.reason : '请联系管理员'}`);
        tok = null; resetTurnstile(); return;
      }
      if (!r.ok || !d.ok) { msg(d.error || '操作失败，请稍后重试'); tok = null; resetTurnstile(); return; }
      
      const user = d.user || { uid: d.uid, name: d.name };
      msg(mode === 'login' ? '登录成功' : '注册成功', 'ok');
      close();
      if (onOK) onOK(user);
      else location.reload();
    } catch (err) {
      msg('网络异常，请稍后重试'); tok = null; resetTurnstile();
    } finally { btn.disabled = false; }
  }

  async function check() {
    try {
      const r = await fetch(AUTH + '/api/me', { credentials: 'include', cache: 'no-store' });
      const d = await r.json();
      if (d.user) return d.user;
      if (d.banned) return { banned: d.ban };
      return null;
    } catch (e) { return null; }
  }

  window.RXHAuth = { open, check, close, getSid: () => '' };
  build();
})();
