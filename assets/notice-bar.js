/* 全站公告条：仅登录用户可见；不改动页面原有 padding */
(() => {
  if (window.__rxhNoticeBar) return;
  window.__rxhNoticeBar = true;
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const sid = localStorage.getItem('rxh_sid') || localStorage.getItem('rxh_session') || '';
  fetch('https://auth.rxh.asia/api/me', {
    cache: 'no-store', credentials: 'include',
    headers: sid ? { Authorization: 'Bearer ' + sid } : {}
  })
    .then(r => r.ok ? r.json() : { user: null })
    .then(d => { if (d.user) mount(); })
    .catch(() => { });

  function mount() {
    return fetch('https://auth.rxh.asia/api/notice', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const items = (d.items || []).map(i => i.text).filter(Boolean);
        if (!items.length) return;

        const css = document.createElement('style');
        css.textContent = `
          .rxh-nb{position:fixed;top:0;left:0;right:0;z-index:120;display:flex;align-items:center;gap:10px;
            padding:8px 16px;font-size:12.5px;line-height:1.5;color:#fff;
            background:linear-gradient(90deg,rgba(255,122,184,.92),rgba(180,92,255,.92));
            border-bottom:1px solid rgba(255,255,255,.18);box-shadow:0 6px 18px -12px rgba(0,0,0,.6)}
          .rxh-nb b{flex:0 0 auto;font-size:10.5px;letter-spacing:.1em;font-weight:600;padding:2px 7px;border-radius:999px;background:rgba(0,0,0,.28)}
          .rxh-nb .t{flex:1;min-width:0;white-space:nowrap;overflow-x:auto;scrollbar-width:none}
          .rxh-nb .t::-webkit-scrollbar{display:none}
          @media(min-width:768px){.rxh-nb .t{overflow:hidden;text-overflow:ellipsis}}
        `;
        document.head.appendChild(css);

        const bar = document.createElement('div');
        bar.className = 'rxh-nb';
        bar.innerHTML = `<b>公告</b><div class="t">${items.map(t => `<span style="margin-right:22px">${esc(t)}</span>`).join('')}</div>`;
        document.body.appendChild(bar);
        const h = bar.offsetHeight || 34;
        const cur = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
        if (h > 0) document.body.style.paddingTop = (cur + h) + 'px';
      });
  }
})();
