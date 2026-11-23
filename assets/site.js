/* ---------- 视图切换 ---------- */
const views = ['home','projects','ai','sites'];
function paint(name){
  if(!views.includes(name)) name = 'home';
  views.forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('on', v===name);
  });
  document.querySelectorAll('.nav-item').forEach(a=>{
    a.classList.toggle('active', a.dataset.view===name);
  });
  window.scrollTo(0,0);
}
/* 有 View Transitions 就用原生过渡，没有就退回 CSS 动画 */
function show(name){
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(document.startViewTransition && !reduced){
    document.startViewTransition(()=>paint(name));
  }else{
    paint(name);
  }
}
const VIEWS = ['home','projects','ai','sites'];
function fromUrl(){
  const v = new URLSearchParams(location.search).get('v') || 'home';
  show(VIEWS.includes(v) ? v : 'home');
}
function pushView(v){
  const u = v === 'home' ? location.pathname : location.pathname + '?v=' + v;
  history.pushState({v}, '', u);
}
window.addEventListener('popstate', fromUrl);
fromUrl();

document.querySelectorAll('[data-view]').forEach(el=>{
  el.addEventListener('click', e=>{
    const href = el.getAttribute('href') || '';
    if(el.tagName === 'A' && el.dataset.view){
      e.preventDefault();
      const v = el.dataset.view;
      pushView(v);
      show(v);
    }
  });
});

/* ---------- 复制 ---------- */
const toast = document.getElementById('toast');
let tt;
function flash(msg){
  toast.textContent = msg || '已复制';
  toast.classList.add('show');
  clearTimeout(tt);
  tt = setTimeout(()=>toast.classList.remove('show'), 1600);
}
document.querySelectorAll('[data-copy]').forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    const text = btn.dataset.copy;
    try{
      await navigator.clipboard.writeText(text);
      flash('已复制：' + text);
    }catch(e){
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      flash('已复制：' + text);
    }
  });
});

/* ---------- AI 对话 ---------- */
document.querySelectorAll('.toggle').forEach(t=>{
  t.addEventListener('click', ()=> t.classList.toggle('on'));
});

const form = document.getElementById('aiForm');
const input = document.getElementById('aiInput');
const chat = document.getElementById('chat');

function addMsg(who, text){
  const el = document.createElement('div');
  el.className = 'msg ' + who;
  el.innerHTML = '<div class="av">' + (who==='ai' ? 'U' : '我') + '</div><div class="bubble"></div>';
  el.querySelector('.bubble').textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

/* 本地词库：关键词命中 + 兜底句池 */
const KB = [
  {k:/你好|hi|在吗|hello|嗨/, a:['在。今天想先弄哪块？','在的，说吧。','在，我在听。']},
  {k:/今天|先做|计划|安排/, a:['先把 APIBalance 的检查更新收尾，再留半小时写文档，大的改动放周末。','今天建议只推一件事，别开三个坑。','先把手上那版发出去，再谈下一步。']},
  {k:/apibalance|余额|api 额/, a:['APIBalance 现在能查六家平台余额，下一步加余额提醒比加平台更有用。','先把自动更新补上，再考虑历史曲线。','余额接口经常改字段，建议加个容错映射表。']},
  {k:/博客|写作|文章/, a:['叫「小寒的草稿箱」？先写起来，名字以后再换。','先攒三篇再上线，别让首页空着。','写成卡片比写成日记更容易坚持。']},
  {k:/你是谁|模型|uranium|名字/, a:['我是 RXH-Uranium，帮你理流程、读代码、写文档。','名字就是个代号，能干活就行。']},
  {k:/代码|报错|bug|崩/, a:['先把报错原文贴出来，别凭印象改。','能复现的 bug 才算 bug，先写最小复现。','十有八九是空指针或者异步没等到。']},
  {k:/帮我|写个|做个|实现/, a:['给我一句话说清输入和输出，我来拆步骤。','先做能跑的最小版本，美化放后面。','这个可以拆成三步：数据结构、交互、样式。']},
  {k:/谢谢|感谢|thanks/, a:['不客气，随时找我。','客气了，有事继续说。']},
  {k:/累|困|睡|休息/, a:['先睡，代码明天还在。','关机一小时，比硬撑三小时强。']},
  {k:/域名|dns|证书|https/, a:['证书先签下来再开强制 HTTPS，顺序错了会 404。','CNAME 指到 pages 域名，A 记录只留够用的一条就行。']},
  {k:/github|仓库|pages/, a:['Pages 构建慢的时候先看 builds 状态，别急着改代码。','仓库名和站点名最好别混用，后期会乱。']},
  {k:/界面|设计|排版|颜色/, a:['先把信息层级排清楚，颜色最后调。','留白不够的时候，先删内容再加装饰。']},
  {k:/状态页|监控|可用/, a:['检测项别太多，五六个关键的够了。','只测通断不够，延迟趋势更有信息量。']},
  {k:/吃|饭|饿/, a:['先吃饭，别空腹改代码。','吃点东西再回来，脑子会清楚很多。']},
  {k:/哈哈|笑|有趣/, a:['行，你开心就好。','这个我记下了，下次接着聊。']}
];
const FALLBACK = [
  '收到，我记下了。',
  '这个可以拆成两步走，先做最小可用的版本。',
  '先别急着改，把现在的现象描述清楚。',
  '我理解你的意思，先把边界条件列出来。',
  '听起来可行，先验证一小块。',
  '这条我留着，等你决定方向再动。',
  '要不要先做一个能跑的草稿？',
  '先按最简单的方案来，跑通了再优化。',
  '时间够的话可以，不够就砍掉一半。',
  '先记录下来，别在脑子里存着。',
  '这个问题的关键在数据，不在样式。',
  '把失败的情况也想一遍，能省很多返工。',
  '先做，再想怎么讲。',
  '可以，但别一次改太多。',
  '我建议先看现有的，再决定要不要重写。',
  '这一步不用完美，能用就行。'
];
function reply(text){
  const t = text.toLowerCase();
  for(const item of KB){ if(item.k.test(t)) return item.a[Math.floor(Math.random()*item.a.length)]; }
  return FALLBACK[Math.floor(Math.random()*FALLBACK.length)];
}

input.addEventListener('input', ()=>{
  input.style.height='auto';
  input.style.height = Math.min(input.scrollHeight,120)+'px';
});
input.addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); form.requestSubmit(); }
});
const HITS = new Map();
form.addEventListener('submit', e=>{
  e.preventDefault();
  const text = input.value.trim();
  if(!text) return;
  addMsg('me', text);
  input.value=''; input.style.height='auto';
  const n = (HITS.get(text) || 0) + 1;
  HITS.set(text, n);
  if(n >= 25){
    addMsg('ai', 'RXH-2026-11 这个编号，记着就行。');
    if(!document.getElementById('eggNote')){
      const tip = document.createElement('div');
      tip.className = 'egg';
      tip.id = 'eggNote';
      tip.innerHTML = '内部流转编号<b>RXH-2026-11</b>';
      chat.parentNode.insertBefore(tip, chat);
    }
    bumpAI();
    HITS.clear();
    const toEnd = () => { chat.scrollTop = chat.scrollHeight; };
    setTimeout(toEnd, 600); setTimeout(toEnd, 1100);
    return;
  }
  setTimeout(()=>addMsg('ai', reply(text)), 520);
});

document.querySelectorAll('#sug .sug').forEach(b=>{
  b.addEventListener('click', ()=>{
    input.value = b.textContent.trim();
    form.requestSubmit();
  });
});

/* ---------- 项目页：拉取 GitHub 状态 ---------- */
(async function(){
  const grid = document.getElementById('repoGrid');
  if(!grid) return;
  try{
    const res = await fetch('https://api.github.com/users/RXHrxh520/repos?sort=updated&per_page=20', {headers:{Accept:'application/vnd.github+json'}});
    if(!res.ok) return;
    const data = await res.json();
    data.forEach(r=>{
      const card = [...grid.querySelectorAll('.repo')].find(c=>c.querySelector('h4')?.textContent.trim()===r.name);
      if(!card) return;
      const meta = card.querySelector('.meta');
      if(!meta) return;
      const upd = (r.pushed_at||r.updated_at||'').slice(0,10);
      meta.innerHTML = '<span>★ ' + r.stargazers_count + '</span><span>⑂ ' + r.forks_count + '</span>' +
        (r.language ? '<span>' + r.language + '</span>' : '') +
        (upd ? '<span>更新 ' + upd + '</span>' : '');
    });
  }catch(e){ /* 静默失败，保留静态信息 */ }
})();

document.getElementById('y').textContent = new Date().getFullYear();

/* ================= 主题 ================= */
const SUN = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6v2.4M2 12h2.4M19.6 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M19.2 4.8l-1.7 1.7M6.5 17.5l-1.7 1.7"/>';
const MOON = '<path d="M15.5 3.2a9 9 0 1 0 6.3 12.2 7 7 0 0 1-6.3-12.2z"/>';
function applyTheme(dark){
  document.body.classList.toggle('dark', dark);
  localStorage.setItem('rxh_theme', dark ? 'dark' : 'light');
  document.getElementById('themeIcon').innerHTML = dark ? MOON : SUN;
  document.getElementById('themeLabel').textContent = dark ? '白亮' : '暗夜';
}
applyTheme(localStorage.getItem('rxh_theme') === 'dark');
document.getElementById('themeBtn').addEventListener('click', ()=>{
  applyTheme(!document.body.classList.contains('dark'));
});

/* ================= 工作台 ================= */
const BENCH = [
  ['托管','GitHub Pages'],
  ['仓库','RXHrxh520.github.io'],
  ['主域','www.rxh.asia'],
  ['证书','Let’s Encrypt'],
  ['构建','main 分支根目录'],
  ['源码','单文件 index.html'],
  ['页面','/ · /gov/ · /police/ · /open/ · /status/'],
  ['更新','2026-11-23']
];
document.getElementById('benchGrid').innerHTML = BENCH.map(([k,v])=>
  `<div class="brow"><span>${k}</span><b>${v}</b></div>`).join('');

(function(){
  const start = new Date('2026-11-18T00:00:00+08:00');
  const days = Math.floor((Date.now() - start) / 86400000) + 1;
  document.getElementById('benchDays').textContent = '站点运行 ' + days + ' 天';
})();

/* ================= 更新日志 ================= */
const LOGS = [
  {d:'11-24', t:'开放平台改版', n:'RXH 开放平台改为登录页：账密登录 + 匿名只读预览，匿名入口需过人机验证。'},
  {d:'11-22', t:'系统状态页', n:'按 GitHub Status 的结构做：分组、90 格色条、可用率与故障记录。'},
  {d:'11-20', t:'路径式分站', n:'不再一个站一个域名，仓库里一个目录就是一个分站。'},
  {d:'11-18', t:'总站上线', n:'玻璃拟态悬浮导航、四视图、绑定 www.rxh.asia 并开启强制 HTTPS。'}
];
document.getElementById('logList').innerHTML = LOGS.map(l=>
  `<li><span class="ldate">${l.d}</span><div><b>${l.t}</b><i>${l.n}</i></div></li>`).join('');

/* ================= AI 会话计数 ================= */
let aiCount = 0;
const aiBadge = document.getElementById('msgCount');
function bumpAI(){
  aiCount++;
  if(aiBadge) aiBadge.textContent = aiCount;
}
document.getElementById('aiForm').addEventListener('submit', bumpAI);