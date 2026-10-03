// FIGHT STATS page (/stats). Reads /api/stats once (all four periods; the server recomputes at most
// every 5 minutes) and draws it. Vanilla, one module, no inline script, no library, no tracker.
// Words are the game's bitmap fonts (fnt_main, fnt_mainbig) at whole-number scales, each canvas
// aria-hidden beside a visually hidden copy of its words; every chart has a text table.
// The story, top to bottom: how much is played -> when -> what -> how hard -> how.

const COL = { fg: '#ffffff', sel: '#ffff00', dim: '#808080', box: '#1a1426', rule: '#262626', hit: '#ff0000' };
const A = '/assets/', S_ = '/assets/stats/';
const PERIODS = [['24h', '24 HOURS', '24H', 'Last 24 hours'], ['7d', '7 DAYS', '7 DAYS', 'Last 7 days'], ['30d', '30 DAYS', '30 DAYS', 'Last 30 days'], ['all', 'ALL TIME', 'ALL', 'All time']];
const PNAME = { '24h': 'THE LAST 24 HOURS', '7d': 'THE LAST 7 DAYS', '30d': 'THE LAST 30 DAYS', all: 'ALL TIME' };
const PREV = { '24h': 'the 24 hours before', '7d': 'the 7 days before', '30d': 'the 30 days before' };
const CHAPTERS = [['1', 'CHAPTER 1'], ['2', 'CHAPTER 2'], ['3', 'CHAPTER 3'], ['4', 'CHAPTER 4'], ['5', 'CHAPTER 5'], ['ut', 'UNDERTALE']];
const MODS = [['NONE', 'NO MODIFIERS'], ['VANISH', 'VANISH'], ['DARK', 'DARK'], ['SPEED', 'SPEED'], ['LONGTURNS', 'LONG TURNS'], ['ONEHIT', 'ONE HIT']];
const SPEEDS = [[0, 99, 'SLOWER', 'q'], [100, 100, '1X', 'w'], [101, 200, '1.5-2X', 'y'], [201, 999, '3-4X', 'l']];
const HIT_LABELS = ['0', '1', '2', '3-5', '6-10', '11-20', '21-50', '51+'];

let period = (() => { const h = location.hash.slice(1); return PERIODS.some((p) => p[0] === h) ? h : '7d'; })();
let DATA = null, status = 'loading';

// ------------------------------------------------------------------------------ fonts & sprites
const F = {};
const load = (src) => new Promise((ok, no) => { const i = new Image(), t = setTimeout(() => no(new Error('timeout')), 20000); i.onload = () => { clearTimeout(t); ok(i); }; i.onerror = (e) => { clearTimeout(t); no(e); }; i.src = src; });
const D = () => Math.max(1, Math.round(devicePixelRatio || 1));
const tints = new Map();
function sheet(f, col) {
  const key = f.img.src + col; let cv = tints.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = f.img.width; cv.height = f.img.height;
  const x = cv.getContext('2d'); x.drawImage(f.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
  tints.set(key, cv); return cv;
}
const glyph = (f, ch) => f.glyphs[ch.charCodeAt(0)] || f.glyphs[63];
const textW = (f, s) => { let n = 0; for (const ch of s) { const g = glyph(f, ch); if (g) n += g[4]; } return n; };
const cellH = (f) => glyph(f, 'A')[3];
function drawStr(ctx, fname, s, x, y, k, col) {
  const f = F[fname], sh = sheet(f, col); let cx = 0;
  for (const ch of s) { const g = glyph(f, ch); if (!g) continue; const [sx, sy, gw, gh, adv, off] = g; if (gw > 0 && gh > 0) ctx.drawImage(sh, sx, sy, gw, gh, x + (cx + off) * k, y, gw * k, gh * k); cx += adv; }
  return cx * k;
}

// ------------------------------------------------------------------------------ DOM helpers
const el = (tag, cls, parent, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
// big window or phone, fixed for the whole of one render (canvases being sized mid-render can move a
// phone's innerWidth for a moment)
let BIG = false;
const L = () => BIG;
// type roles: [font, scale on a big window, scale on a phone]
const ROLE = { body: ['fnt_main', 2, 1], small: ['fnt_main', 1, 1], h1: ['fnt_mainbig', 2, 1], h2: ['fnt_mainbig', 1, 1], tab: ['fnt_mainbig', 1, 1], tabS: ['fnt_main', 2, 2],
  hero: ['fnt_mainbig', 5, 2], stat: ['fnt_mainbig', 2, 1], label: ['fnt_main', 2, 1], name: ['fnt_mainbig', 1, 1] };
const texts = [];
// one run of bitmap text. o: { role, col, wrap (fill the parent's width), fit (shrink to fit), sr (words for screen readers) }
function bt(parent, text, o = {}, cls = '') {
  const w = el('span', 'bt ' + cls, parent);
  const sr = el('span', 'sr', w); sr.textContent = o.sr != null ? o.sr : text.replace(/^\* /, '');
  const cv = el('canvas', '', w, { 'aria-hidden': 'true' });
  w._b = { text, role: o.role || 'body', col: o.col || COL.fg, wrap: !!o.wrap, fit: !!o.fit, cv };
  texts.push(w); return w;
}
function paint(w) {
  const b = w._b, [fn, sL, sS] = ROLE[b.role], f = F[fn], d = D();
  let s = L() ? sL : sS;
  const avail = Math.floor(w.parentElement.clientWidth);
  if (b.fit) while (s > 1 && textW(f, b.text) * s > avail) s--;
  const lh = fn === 'fnt_main' ? 20 : 34;
  let lines = [b.text];
  if (b.wrap) {   // word wrap by glyph advances; '* ' lines hang under the first word
    const star = b.text.startsWith('* '), ind = star ? textW(f, '* ') : 0, max = Math.floor(avail / s); lines = []; let cur = '';
    for (const word of b.text.split(' ')) { const t = cur ? cur + ' ' + word : word; if (cur && textW(f, t) + (lines.length ? ind : 0) > max) { lines.push(cur); cur = word; } else cur = t; }
    lines.push(cur); b.ind = ind;
  }
  const cssW = b.wrap ? Math.max(1, avail) : textW(f, b.text) * s, cssH = ((lines.length - 1) * lh + cellH(f)) * s;
  const cv = b.cv; cv.width = cssW * d; cv.height = cssH * d; cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  lines.forEach((ln, i) => drawStr(x, fn, ln, (i && b.ind ? b.ind : 0) * s * d, i * lh * s * d, s * d, b.col));
}
const say = (parent, text, col = COL.dim, role = 'body') => bt(el('div', 'say', parent), text, { role, wrap: true, col });
function heart(parent, small) { return el('img', '', parent, { alt: '', src: S_ + (small ? 'heart_small.png' : 'heart.png') }); }

// The Dark World text box as a 9-slice border image, fs CSS px per art px, built at device scale
const frames = new Map();
function frameURL(fs) {
  const P = fs * D(); if (frames.has(P)) return frames.get(P);
  const C = 16 * P, S = C * 3, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  x.fillStyle = '#000'; x.fillRect(4 * P, 4 * P, S - 8 * P, S - 8 * P);
  const put = (img, sx, sy, dx, dy) => { x.save(); x.translate(dx + (sx < 0 ? C : 0), dy + (sy < 0 ? C : 0)); x.scale(sx, sy); x.drawImage(img, 0, 0, C, C); x.restore(); };
  put(F.top, 1, 1, C, 0); put(F.top, 1, -1, C, 2 * C); put(F.left, 1, 1, 0, C); put(F.left, -1, 1, 2 * C, C);
  put(F.tl, 1, 1, 0, 0); put(F.tl, -1, 1, 2 * C, 0); put(F.tl, 1, -1, 0, 2 * C); put(F.tl, -1, -1, 2 * C, 2 * C);
  const u = cv.toDataURL(); frames.set(P, u); return u;
}
function box(parent, title, caption, o = {}) {
  const b = el('section', 'box ' + (o.cls || ''), parent, { 'aria-label': o.aria || title });
  const fs = o.x2 && L() ? 2 : 1; if (fs === 2) b.classList.add('x2');
  b.style.borderImage = `url(${frameURL(fs)}) ${16 * fs * D()} fill / ${16 * fs}px stretch`;
  const inn = el('div', 'in', b);
  if (title) { const h = el('div', 'hd', inn); const h2 = el('h2', '', h); bt(h2, title, { role: 'h2' }); if (caption) bt(h, caption, { role: 'label', col: COL.dim }); }
  return inn;
}

// ------------------------------------------------------------------------------ formatting
const int = (n) => Math.round(n).toLocaleString('en-US');
const pct = (x) => (x == null || !isFinite(x) ? '--' : x > 0 && x < 0.01 ? '<1%' : x < 1 && x > 0.99 ? '>99%' : Math.round(x * 100) + '%');
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dt = (s) => { const d = new Date(s * 1000); return { wd: WD[d.getUTCDay()], mo: MON[d.getUTCMonth()], d: d.getUTCDate(), h: String(d.getUTCHours()).padStart(2, '0') + ':00', hm: String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') }; };
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const mmss = (s) => (s == null ? '--' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'));
function hours(s) { const h = s / 3600; if (h < 1) return Math.round(s / 60) + ' MIN'; if (h < 10) return Math.floor(h) + 'H ' + String(Math.floor((h % 1) * 60)).padStart(2, '0') + 'M'; return int(h) + ' H'; }
const chTag = (ch) => (ch === 'ut' ? 'UT' : 'CH' + ch);
const upName = (s) => String(s).toUpperCase();

// ------------------------------------------------------------------------------ data
// A request that never answers is given up after 20 s (the page then shows TRY AGAIN, never "Loading" for ever).
function fetchT(url, opts = {}, ms = 20000) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ac && ac.abort(), ms);
  return fetch(url, ac ? { ...opts, signal: ac.signal } : opts).finally(() => clearTimeout(t));
}
async function getData() {
  status = 'loading'; render();
  try {
    const r = await fetchT('/api/stats', { credentials: 'same-origin', cache: 'no-cache' });
    if (!r.ok) throw new Error('status ' + r.status);
    const j = await r.json();
    if (!j || j.v !== 1 || !j.periods || !j.periods['7d']) throw new Error('shape');
    DATA = j; status = 'ok';
  } catch (e) { status = 'error'; }
  render();
}

// ------------------------------------------------------------------------------ the page
let drawnW = 0;   // the window width the page was last drawn for (a resize redraws only when it changed)
function render() {
  texts.length = 0; afterPaint.length = 0;
  const root = document.getElementById('st'); root.textContent = '';
  drawnW = innerWidth; BIG = document.documentElement.clientWidth >= 900;
  const big = L();
  const home = el('a', 'home', root, { href: '/' }); heart(home, true); bt(home, 'DELTARUNE FIGHT SIMULATOR', { role: 'small', col: COL.dim, sr: 'DELTARUNE Fight Simulator, home' }, 'inl');
  const head = el('header', 'title', root);
  const h1 = el('h1', '', head); h1.style.margin = '0'; bt(h1, 'FIGHT STATS', { role: 'h1', sr: 'Fight stats' });
  bt(el('p', 'lede', head), '* Every fight finished on the simulator, counted. Anonymous.', { role: 'body', wrap: true, col: COL.dim });
  head.lastChild.style.margin = '10px 0 0';

  // the period switch
  const bar = el('div', 'bar', root), bin = el('div', 'in', bar);
  const tabs = el('div', 'tabs', bin, { role: 'tablist', 'aria-label': 'Time period' });
  for (const [id, lab, short, aria] of PERIODS) {
    const on = id === period, b = el('button', 'tab', tabs, { type: 'button', role: 'tab', id: 'tab-' + id, 'aria-selected': String(on), 'aria-controls': 'panel', tabindex: on ? '0' : '-1' });
    el('img', 'cur', b, { alt: '', src: S_ + 'heart.png' });
    bt(b, big ? lab : short, { role: big ? 'tab' : 'tabS', col: on ? COL.sel : COL.fg, sr: aria }, 'inl');
    b.addEventListener('click', () => pick(id));
  }
  tabs.addEventListener('keydown', (e) => {
    const i = PERIODS.findIndex((t) => t[0] === period);
    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? PERIODS.length - 1 : null;
    if (j == null) return; e.preventDefault(); pick(PERIODS[(j + PERIODS.length) % PERIODS.length][0]);
  });
  if (DATA) bt(el('div', 'upd', bin), `UPDATED ${dt(DATA.now).hm} UTC`, { role: 'label', col: COL.dim, sr: `Updated ${dt(DATA.now).hm} UTC` });

  const grid = el('div', 'grid', root, { role: 'tabpanel', id: 'panel', 'aria-labelledby': 'tab-' + period });
  if (status !== 'ok') {
    const w = box(grid, '', '', { aria: status === 'loading' ? 'Loading' : 'Could not load' });
    const d = el('div', 'wait', w);
    if (status === 'loading') bt(d, '* Loading the numbers...', { role: 'body', wrap: true });
    else {
      bt(d, "* The numbers didn't load. Check your connection and try again.", { role: 'body', wrap: true });
      const r = el('button', 'btn', d, { type: 'button' }); heart(r); bt(r, 'TRY AGAIN', { role: 'name' }, 'inl'); r.addEventListener('click', getData);
    }
    foot(root); finish(); return;
  }
  const P = DATA.periods[period], MIN = DATA.min;

  hero(grid, P, MIN);
  if (!P.fights) {
    const w = box(grid, '', '', { aria: 'Nothing yet' });
    const other = PERIODS.find(([id]) => DATA.periods[id].fights > 0 && id !== period);
    bt(el('div', 'wait', w), `* No fights finished in ${PNAME[period].toLowerCase()} yet.`, { role: 'body', wrap: true });
    if (other) { const r = el('button', 'btn', w, { type: 'button' }); heart(r); bt(r, 'SEE ' + other[1], { role: 'name' }, 'inl'); r.addEventListener('click', () => pick(other[0])); }
    foot(root); finish(); return;
  }
  // WHEN
  const unit = P.step === 3600 ? 'FIGHTS PER HOUR' : P.step === 86400 ? 'FIGHTS PER DAY' : 'FIGHTS PER WEEK';
  activity(box(grid, 'ACTIVITY', unit + ', UTC'), P);
  // WHAT
  mostPlayed(box(grid, 'MOST PLAYED', 'SHARE OF ALL FIGHTS', { cls: 'half' }), P);
  chapters(box(grid, 'CHAPTERS', 'SHARE OF ALL FIGHTS', { cls: 'half' }), P);
  // HOW HARD
  const hitsOk = P.hitsPer.median != null;
  hardest(box(grid, 'HARDEST FIGHTS', 'LOWEST WIN RATE', { cls: hitsOk ? 'half' : '' }), P, MIN, hitsOk);
  if (hitsOk) hitsPanel(box(grid, 'HITS PER FIGHT', `${int(P.hitsPer.n)} FIGHTS COUNTED`, { cls: 'half' }), P);
  // HOW
  howPlayed(box(grid, "HOW IT'S PLAYED", ''), P);
  foot(root); finish();
}
function pick(id) {
  if (id === period) return;
  period = id;
  try { history.replaceState(null, '', '#' + id); } catch (e) { }
  const y = scrollY; render(); scrollTo(0, y);
  const t = document.getElementById('tab-' + id); if (t) t.focus();
}
const afterPaint = [];
function finish() { for (const w of texts) paint(w); for (const f of afterPaint.splice(0)) f(); }

// HOW MUCH: the fights, won / lost / quit, and four numbers beside it
function hero(grid, P, MIN) {
  const h = box(grid, '', '', { x2: true, aria: 'Fights played, ' + PNAME[period].toLowerCase() }); h.classList.add('hero');
  const hl = el('div', '', h);
  bt(hl, 'FIGHTS PLAYED', { role: 'h2' });
  bt(hl, PNAME[period], { role: 'label', col: COL.dim });
  bt(el('div', 'big', hl), int(P.fights), { role: 'hero', fit: true });
  if (P.fights) {
    const strip = el('div', 'strip', hl, { 'aria-hidden': 'true' });
    for (const [c, n] of [['w', P.won], ['l', P.lost], ['q', P.quit]]) if (n > 0) el('i', c, strip).style.flex = String(n);
  }
  const lg = el('div', 'legend', hl);
  for (const [c, lab, n] of [['w', 'WON', P.won], ['l', 'LOST', P.lost], ['q', 'QUIT', P.quit]]) { const k = el('span', 'k', lg); el('i', 'sw ' + c, k); bt(k, `${lab} ${int(n)}`, { role: 'label', col: c === 'q' ? COL.dim : COL.fg }, 'inl'); }
  let line = null;
  const first = DATA.first;
  if (P.prev != null) {
    const d = (P.fights - P.prev) / P.prev, r = Math.round(Math.abs(d) * 100);
    line = r === 0 ? `* About the same as ${PREV[period]} (${int(P.prev)}).` : `* ${r}% ${d > 0 ? 'more' : 'fewer'} fights than ${PREV[period]} (${int(P.prev)}).`;
  } else if (first != null && first >= P.from) { const b = dt(first); line = `* Records began ${cap(b.wd)} ${cap(b.mo)} ${b.d}, ${b.h} UTC.`; }
  else if (period === 'all' && first != null) { const b = dt(first); line = `* Since records began, ${cap(b.mo)} ${b.d}.`; }
  if (line) bt(el('div', 'note', hl), line, { role: 'body', wrap: true, col: COL.dim });

  const cells = el('div', 'cells', h);
  const cell = (label, value, sub, sr) => {
    const c = el('div', 'cell', cells, { role: 'group', 'aria-label': sr });
    bt(c, label, { role: 'label', col: COL.dim, sr: '' });
    bt(el('div', 'v', c), value, { role: 'stat', fit: true, sr: '' });
    if (sub) bt(c, sub, { role: 'label', col: COL.dim, wrap: true, sr: '' });
    const s = el('span', 'sr', c); s.textContent = sr;
  };
  if (P.winRate != null) cell('WIN RATE', pct(P.winRate), `OF ${int(P.player)} FIGHTS`, `Win rate: won ${pct(P.winRate)} of ${int(P.player)} fights played without help`);
  else cell('WIN RATE', '--', `${P.player} OF ${MIN.winRate} NEEDED`, `Win rate: not enough fights yet, ${P.player} of the ${MIN.winRate} needed`);
  const nh = P.noHitWins, pw = P.playerWins;
  cell('NO-HIT WINS', int(nh), nh ? (nh === pw ? 'EVERY WIN' : `1 IN ${Math.max(2, Math.round(pw / nh))} WINS`) : 'NONE YET', `No-hit wins: ${int(nh)}${nh ? `, about 1 in ${Math.max(1, Math.round(pw / nh))} wins` : ''}`);
  cell('HITS TAKEN', int(P.hits), P.hitsPer.median != null ? `TYPICAL FIGHT: ${Math.round(P.hitsPer.median)}` : '', `Hits taken: ${int(P.hits)}${P.hitsPer.median != null ? `, ${Math.round(P.hitsPer.median)} in a typical fight` : ''}`);
  cell('TIME PLAYED', hours(P.time), P.length != null ? `TYPICAL FIGHT: ${mmss(P.length)}` : '', `Time played: ${hours(P.time).toLowerCase()}${P.length != null ? `, a typical fight lasts ${mmss(P.length)}` : ''}`);
}

// a ranked row: rank, name (+ chapter tag), value, a bar under it
function row(list, rank, name, tag, val, frac, sr, dimName) {
  const r = el('li', 'row' + (rank ? '' : ' nr'), list);
  const s = el('span', 'sr', r); s.textContent = sr;
  if (rank) bt(el('span', 'rk', r, { 'aria-hidden': 'true' }), rank, { role: 'body', col: COL.dim, sr: '' });
  const nm = el('span', 'nm', r, { 'aria-hidden': 'true' });
  bt(nm, name, { role: 'body', col: dimName ? COL.dim : COL.fg, sr: '' }, 'inl'); if (tag) bt(nm, tag, { role: 'small', col: COL.dim, sr: '' }, 'inl');
  bt(el('span', '', r, { 'aria-hidden': 'true' }), val, { role: 'body', col: dimName ? COL.dim : COL.fg, sr: '' });
  const bar = el('span', 'bar2', r, { 'aria-hidden': 'true' }), fill = el('i', '', bar);
  afterPaint.push(() => { fill.style.width = (frac > 0 ? Math.max(2, Math.round(bar.clientWidth * Math.min(1, frac))) : 0) + 'px'; });
  return r;
}
const list = (parent) => el('ol', 'rows', parent);

// WHAT: the fights and the chapters
function mostPlayed(p, P) {
  const top = P.most.slice(0, 6), ol = list(p);
  top.forEach((e, i) => row(ol, String(i + 1), upName(e.name), chTag(e.ch), `${pct(e.n / P.fights)}  ${int(e.n)}`, e.n / top[0].n, `${i + 1}. ${e.name}, ${int(e.n)} fights, ${pct(e.n / P.fights)} of all`));
  if (top.length < 6) say(p, `* Only ${top.length === 1 ? 'one fight has' : `${top.length} different fights have`} been played in this period.`);
}
function chapters(p, P) {
  const ol = list(p), max = Math.max(1, ...CHAPTERS.map(([id]) => P.chapters[id] || 0));
  for (const [id, label] of CHAPTERS) { const n = P.chapters[id] || 0; row(ol, '', label, '', n ? `${pct(n / P.fights)}  ${int(n)}` : '--', n / max, `${cap(label)}: ${int(n)} fights, ${pct(n / P.fights)}`, !n); }
}

// HOW HARD: the lowest win rate, the top one with its portrait
function hardest(p, P, MIN, hitsOk) {
  if (!P.hardest.length) {
    say(p, `* A fight is ranked here once it has ${MIN.hardest} finished tries without help in this period. None has yet. Closest:`, COL.fg).style.marginTop = '0';
    const ol = list(p); ol.style.marginTop = '14px';
    for (const e of P.closest) {
      const r = el('li', 'row nr', ol); const s = el('span', 'sr', r); s.textContent = `${e.name}: ${e.fin} of ${MIN.hardest} tries`;
      const nm = el('span', 'nm', r, { 'aria-hidden': 'true' }); bt(nm, upName(e.name), { role: 'body', sr: '' }, 'inl'); bt(nm, chTag(e.ch), { role: 'small', col: COL.dim, sr: '' }, 'inl');
      bt(el('span', '', r, { 'aria-hidden': 'true' }), `${e.fin} / ${MIN.hardest}`, { role: 'body', col: COL.dim, sr: '' });
      const pp = el('span', 'pips', r, { 'aria-hidden': 'true' }); for (let i = 0; i < MIN.hardest; i++) el('i', i < e.fin ? 'on' : '', pp);
    }
    if (!P.closest.length) say(p, '* No fight has been won or lost without help yet.');
    if (!hitsOk) say(p, `* HITS PER FIGHT appears after ${MIN.hits} such fights (${P.hitsPer.n} so far).`);
    return;
  }
  const top = P.hardest[0], rate = top.w / top.fin;
  const spot = el('div', 'spot', p); const s = el('span', 'sr', spot); s.textContent = `Hardest: ${top.name}, won ${pct(rate)} of ${int(top.fin)} tries`;
  const pic = el('div', 'pic', spot, { 'aria-hidden': 'true' });
  const bw = L() ? 184 : 96, bh = L() ? 224 : 112; pic.style.width = bw + 'px'; pic.style.height = bh + 'px';
  if (top.pic) portrait(pic, top.pic, bw, bh);
  const t = el('div', '', spot, { 'aria-hidden': 'true' });
  bt(t, 'HARDEST RIGHT NOW', { role: 'label', col: COL.dim, sr: '' });
  el('div', '', t).style.height = '8px';
  const nl = el('div', '', t); nl.style.cssText = 'display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap'; bt(nl, upName(top.name), { role: 'name', sr: '', wrap: true }); bt(nl, chTag(top.ch), { role: 'small', col: COL.dim, sr: '' }, 'inl');
  bt(el('div', 'v', t), pct(rate), { role: 'stat', fit: true, sr: '' });
  bt(t, `WON ${int(top.w)} OF ${int(top.fin)} TRIES`, { role: 'label', col: COL.dim, wrap: true, sr: '' });
  const ol = list(p); ol.setAttribute('start', '2');
  P.hardest.slice(1, 5).forEach((e, i) => row(ol, String(i + 2), upName(e.name), chTag(e.ch), `${pct(e.w / e.fin)} OF ${int(e.fin)}`, e.w / e.fin, `${i + 2}. ${e.name}: won ${pct(e.w / e.fin)} of ${int(e.fin)} tries`));
  if (P.hardest.length < 5) say(p, `* Only ${P.hardest.length === 1 ? 'one fight has' : `${P.hardest.length} fights have`} ${MIN.hardest} or more finished tries in this period.`);
}
let porP = null;
function portrait(box, key, bw, bh) {
  if (!porP) porP = Promise.all([load(A + 'portraits.png'), fetch(A + 'portraits.json').then((r) => r.json())]).catch(() => null);
  porP.then((got) => {
    if (!got) return; const [img, j] = got, rc = j.rects && j.rects[key]; if (!rc) return;
    const [sx, sy, w, h] = rc; let k = Math.min(Math.floor(bw / w), Math.floor(bh / h), 2); if (k < 1) k = w / 2 <= bw && h / 2 <= bh ? 0.5 : Math.min(bw / w, bh / h);
    const d = D(), cv = el('canvas', '', box); const cw = Math.round(w * k), ch = Math.round(h * k);
    cv.width = cw * d; cv.height = ch * d; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, sx, sy, w, h, 0, 0, cw * d, ch * d);
  });
}

// WHEN: bars on a canvas; the selected bar yellow (the busiest to start with); an outline = still going
function activity(parent, P) {
  const s = P.series.map((b) => ({ ...b, part: b.t + P.step > DATA.now, before: DATA.first == null || b.t + P.step <= DATA.first })), big = L();
  const step = P.step, label = (b) => { const d = dt(b.t); return step === 3600 ? `${d.h} UTC` : step === 86400 ? `${d.wd} ${d.mo} ${d.d}` : `WEEK OF ${d.mo} ${d.d}`; };
  const unitWord = step === 3600 ? 'HOUR' : step === 86400 ? 'DAY' : 'WEEK';
  const wrap = el('div', '', parent);
  let sel = -1, best = -1; s.forEach((b, i) => { if (!b.before && b.n > best) { best = b.n; sel = i; } });
  const peak = sel;
  const cv = el('canvas', 'chart', wrap, { tabindex: '0', role: 'img', 'aria-label': `Fights per ${unitWord.toLowerCase()}. Busiest: ${sel >= 0 ? label(s[sel]) : 'none'}, ${best} fights. Left and right arrows step through; a table follows.` });
  const ro = el('div', 'readout', parent, { 'aria-live': 'polite' });
  const table = el('table', 'sr', parent); const tb = el('tbody', '', table);
  for (const b of s) { const tr = el('tr', '', tb); el('th', '', tr).textContent = label(b); el('td', '', tr).textContent = b.before ? 'before the records' : `${b.n} fights${b.part ? ' so far' : ''}`; }
  let geo = null;
  const draw = () => {
    const d = D(), W = wrap.clientWidth, H = big ? 260 : 168;
    cv.width = W * d; cv.height = H * d; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height);
    const ts = big ? 2 : 1, tw_ = (t) => textW(F.fnt_main, t) * ts, max = Math.max(1, ...s.map((b) => b.n)), nice = niceMax(max), fh = cellH(F.fnt_main) * ts;
    const yl = [0, nice / 2, nice].map((v) => (v >= 1000 ? (v / 1000) + 'K' : String(v)));
    const gutter = Math.max(...yl.map((t) => tw_(t))) + 12, top = fh + 6, bottom = fh * 2 + 12;
    const x0 = gutter, pw = W - gutter, ph = H - top - bottom;
    [0, 0.5, 1].forEach((f, i) => {
      const y = Math.round(top + ph - f * ph);
      x.fillStyle = COL.rule; for (let xx = x0; xx < W; xx += 6) x.fillRect(xx * d, y * d, 3 * d, d * (f === 0 ? 2 : 1));
      drawStr(x, 'fnt_main', yl[i], 0, (y - fh / 2 - 1) * d, d * ts, COL.dim);
    });
    const n = s.length, slot = pw / n, gap = Math.max(2, Math.round(slot * 0.28)), bw = Math.max(2, Math.floor(slot - gap));
    geo = { x0, slot, n };
    let beganAt = -1;
    const every = step === 3600 ? (big ? 3 : 6) : n <= 8 ? 1 : n <= 31 ? (big ? 5 : 7) : (big ? 7 : 14);
    s.forEach((b, i) => {
      const bx = Math.round(x0 + i * slot + (slot - bw) / 2), bh = b.n ? Math.max(2, Math.round((b.n / nice) * ph)) : 0, by = top + ph - bh;
      const col = i === sel ? COL.sel : COL.fg;
      if (b.before) { x.fillStyle = COL.box; x.fillRect(bx * d, (top + ph - 2) * d, bw * d, 2 * d); }
      else if (!b.n) { x.fillStyle = i === sel ? COL.sel : COL.dim; x.fillRect(bx * d, (top + ph - 2) * d, bw * d, 2 * d); }
      else if (b.part) { x.fillStyle = col; x.fillRect(bx * d, by * d, bw * d, 2 * d); x.fillRect(bx * d, by * d, 2 * d, bh * d); x.fillRect((bx + bw - 2) * d, by * d, 2 * d, bh * d); }
      else { x.fillStyle = col; x.fillRect(bx * d, by * d, bw * d, bh * d); }
      if (i === sel && b.n) { const t = int(b.n), tw = tw_(t); drawStr(x, 'fnt_main', t, Math.round(Math.min(W - tw, Math.max(0, bx + bw / 2 - tw / 2))) * d, (by - fh - 2) * d, d * ts, COL.sel); }
      if (beganAt < 0 && !b.before) beganAt = i;
      const last = i === n - 1;
      const dd0 = dt(b.t), selL = sel >= 0 ? (step === 3600 ? dt(s[sel].t).h : `${dt(s[sel].t).mo} ${dt(s[sel].t).d}`) : '';
      const clash = n > 8 && i !== sel && sel >= 0 && Math.abs(i - sel) * slot < (tw_(selL) + tw_(step === 3600 ? dd0.h : `${dd0.mo} ${dd0.d}`)) / 2 + 8;   // keep the selected label clear
      if (((i % every === 0 && !(last && n > 8)) || (last && n <= 8) || i === sel) && !clash) {
        const dd = dt(b.t), l1 = step === 3600 ? dd.h : n <= 8 ? dd.wd : `${dd.mo} ${dd.d}`, l2 = step === 3600 || n > 8 ? '' : String(dd.d);
        const lx = (t) => Math.round(Math.min(W - tw_(t), Math.max(x0, bx + bw / 2 - tw_(t) / 2)));
        drawStr(x, 'fnt_main', l1, lx(l1) * d, (top + ph + 8) * d, d * ts, i === sel ? COL.sel : COL.dim);
        if (l2) drawStr(x, 'fnt_main', l2, lx(l2) * d, (top + ph + 8 + fh + 2) * d, d * ts, i === sel ? COL.sel : COL.fg);
      }
    });
    if (beganAt > 0) {
      const bx = Math.round(x0 + beganAt * slot) - 1;
      x.fillStyle = COL.dim; for (let y = top - 2; y < top + ph; y += 6) x.fillRect(bx * d, y * d, 2 * d, 3 * d);
      const t = 'RECORDS BEGIN', tw = tw_(t); drawStr(x, 'fnt_main', t, Math.max(x0, bx - tw - 8) * d, (top + 2) * d, d * ts, COL.dim);
    }
  };
  const readout = () => {
    ro.textContent = ''; const b = s[sel]; if (!b) return;
    const parts = [[label(b), COL.sel], [b.before ? 'BEFORE THE RECORDS' : `${int(b.n)} FIGHTS${b.part ? ' SO FAR' : ''}`, COL.fg]];
    if (b.f >= 10) parts.push([`WON ${pct(b.w / b.f)}`, COL.dim]);
    if (sel === peak && best > 0 && s.filter((q) => !q.before).length > 1) parts.push([`BUSIEST ${unitWord}`, COL.dim]);
    for (const [t, c] of parts) paint(bt(ro, t, { role: 'label', col: c }, 'inl'));
  };
  const go = (i) => { i = Math.max(0, Math.min(s.length - 1, i)); if (i !== sel) { sel = i; draw(); readout(); } };
  cv.addEventListener('keydown', (e) => { const k = e.key; if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End') { e.preventDefault(); go(k === 'Home' ? 0 : k === 'End' ? s.length - 1 : sel + (k === 'ArrowRight' ? 1 : -1)); } });
  const at = (e) => { if (!geo) return; const r = cv.getBoundingClientRect(); go(Math.floor((e.clientX - r.left - geo.x0) / geo.slot)); };
  cv.addEventListener('pointermove', at); cv.addEventListener('pointerdown', at);
  afterPaint.push(() => { draw(); readout(); });
}
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return Math.max(2, m * p); return 10 * p; }

// HOW HARD, part two: the typical number of hits, then how many fights took how many
function hitsPanel(p, P) {
  const H = P.hitsPer, figs = el('div', 'figs f3', p);
  const f = (label, value, sr) => { const c = el('div', 'cell', figs, { role: 'group', 'aria-label': sr }); bt(c, label, { role: 'label', col: COL.dim, sr: '' }); bt(el('div', 'v', c), value, { role: 'stat', fit: true, sr: '' }); };
  const med = Math.round(H.median * 10) / 10;
  f('TYPICAL', String(med), `Typical fight (median): ${med} hits`);
  f('AVERAGE', H.mean.toFixed(1), `Average: ${H.mean.toFixed(1)} hits`);
  f('NO HIT', pct(H.hist[0] / H.n), `No hit: ${pct(H.hist[0] / H.n)} of fights`);
  const wrap = el('div', 'fill', p); wrap.style.marginTop = '16px'; wrap.style.minHeight = (L() ? 248 : 170) + 'px';
  const cv = el('canvas', '', wrap, { role: 'img', 'aria-label': 'Fights by hits taken: ' + H.hist.map((n, i) => `${HIT_LABELS[i]} hits: ${n} fights`).join(', ') });
  say(p, `* Half of these fights end with ${med} ${med === 1 ? 'hit' : 'hits'} or fewer. Bars: how many fights took that many hits.`);
  afterPaint.push(() => {
    const d = D(), W = wrap.clientWidth, Ht = Math.max(L() ? 248 : 170, wrap.clientHeight); cv.width = W * d; cv.height = Ht * d; cv.style.width = W + 'px'; cv.style.height = Ht + 'px';
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; const ts = L() ? 2 : 1, fh = cellH(F.fnt_main) * ts;
    const n = H.hist.length, slot = W / n, bw = Math.floor(slot * 0.66), max = Math.max(1, ...H.hist);
    // labels at the box's text size: side by side with a clear gap, else every other one a line lower
    // (never shrunk to an unreadable size unless even that cannot fit); counts go compact (1.5K) first
    const fits = (arr, sc, room) => arr.every((t) => textW(F.fnt_main, t) * sc <= room);
    const labStag = !fits(HIT_LABELS, ts, slot - 10) && fits(HIT_LABELS, ts, 2 * slot - 12);
    const labS = fits(HIT_LABELS, ts, slot - 10) || labStag ? ts : 1;
    const k = (v) => (v >= 1000 ? (v >= 1e4 ? Math.round(v / 1000) : Math.round(v / 100) / 10) + 'K' : String(v));
    let vals = H.hist.map((v) => int(v)); if (!fits(vals, ts, slot - 6)) vals = H.hist.map(k);
    const valS = fits(vals, ts, slot - 6) ? ts : 1;
    const top = cellH(F.fnt_main) * valS + 4, lh = cellH(F.fnt_main) * labS, ph = Ht - top - lh * (labStag ? 2 : 1) - fh - 22;
    x.fillStyle = COL.rule; x.fillRect(0, (top + ph) * d, W * d, 2 * d);
    H.hist.forEach((v, i) => {
      const bx = Math.round(i * slot + (slot - bw) / 2), bh = v ? Math.max(2, Math.round((v / max) * ph)) : 0, by = top + ph - bh;
      x.fillStyle = i === 0 ? COL.fg : COL.hit; if (bh) x.fillRect(bx * d, by * d, bw * d, bh * d);
      const vw = textW(F.fnt_main, vals[i]) * valS; drawStr(x, 'fnt_main', vals[i], Math.round(bx + bw / 2 - vw / 2) * d, (by - cellH(F.fnt_main) * valS - 2) * d, d * valS, v ? COL.fg : COL.dim);
      const lw = textW(F.fnt_main, HIT_LABELS[i]) * labS, ly = top + ph + 8 + (labStag && i % 2 ? lh + 2 : 0);
      drawStr(x, 'fnt_main', HIT_LABELS[i], Math.round(bx + bw / 2 - lw / 2) * d, ly * d, d * labS, COL.dim);
    });
    const capY = top + ph + 8 + lh * (labStag ? 2 : 1) + (labStag ? 2 : 0) + 6;
    drawStr(x, 'fnt_main', 'HITS TAKEN', 0, capY * d, d * ts, COL.dim);
  });
}

// HOW: length, turns, quits, help; the game speed; the run modifiers
function howPlayed(p, P) {
  const how = el('div', 'how', p), main = el('div', '', how), side = el('div', 'side', how);
  const figs = el('div', 'figs f6', main);
  const fig = (label, value, sub, sr) => { const c = el('div', 'cell', figs, { role: 'group', 'aria-label': sr }); bt(c, label, { role: 'label', col: COL.dim, sr: '' }); bt(el('div', 'v', c), value, { role: 'stat', fit: true, sr: '' }); bt(c, sub, { role: 'label', col: COL.dim, wrap: true, sr: '' }); };
  fig('LENGTH', mmss(P.length), P.length != null ? 'TYPICAL FIGHT' : 'NOT ENOUGH YET', P.length != null ? `A typical fight lasts ${mmss(P.length)}` : 'Fight length: not enough fights yet');
  fig('TURNS', P.turns == null ? '--' : String(Math.round(P.turns)), P.turns != null ? 'ENEMY TURNS' : 'NOT ENOUGH YET', P.turns != null ? `A typical fight has ${Math.round(P.turns)} enemy turns` : 'Turns: not enough fights yet');
  fig('QUIT', pct(P.quit / P.fights), 'LEFT EARLY', `${pct(P.quit / P.fights)} of fights were left before the end`);
  fig('AUTOPLAY', pct(P.auto / P.fights), 'THE BOT PLAYED', `${pct(P.auto / P.fights)} of fights were played by autoplay`);
  fig('ASSISTS', pct(P.assist / P.fights), 'HELP WAS ON', `${pct(P.assist / P.fights)} of fights used an assist such as rewind, save states or practice`);
  fig('FIGHTS TRIED', P.distinct != null ? int(P.distinct) : '--', DATA.catalog ? `OF ${int(DATA.catalog)}` : 'DIFFERENT FIGHTS', P.distinct != null ? `${int(P.distinct)} different fights played${DATA.catalog ? ` of ${int(DATA.catalog)}` : ''}` : '');
  // game speed
  const sp = el('div', 'speed', main); bt(sp, 'GAME SPEED', { role: 'label', col: COL.dim });
  const counts = SPEEDS.map(([lo, hi]) => Object.entries(P.speeds).reduce((t, [k, n]) => t + (Number(k) >= lo && Number(k) <= hi ? n : 0), 0));
  const ss = el('div', 'strip', sp, { 'aria-hidden': 'true' }); SPEEDS.forEach((q, i) => { if (counts[i]) el('i', q[3], ss).style.flex = String(counts[i]); });
  const sl = el('div', 'legend', sp);
  SPEEDS.forEach((q, i) => { const k = el('span', 'k', sl); el('i', 'sw ' + q[3], k); bt(k, `${q[2]} ${counts[i] ? pct(counts[i] / P.fights) : '--'}`, { role: 'label', col: counts[i] ? COL.fg : COL.dim, sr: `${q[2].toLowerCase()} speed: ${pct(counts[i] / P.fights)}` }, 'inl'); });
  // modifiers
  const hd = el('div', 'sub', side); bt(hd, 'RUN MODIFIERS', { role: 'label' }); bt(hd, 'A FIGHT CAN USE SEVERAL', { role: 'label', col: COL.dim });
  const used = MODS.slice(1).some(([id]) => P.mods[id]);
  if (!used) { say(side, '* No fight in this period used a run modifier.').style.marginTop = '0'; return; }
  const ol = list(side), max = Math.max(1, ...MODS.map(([id]) => P.mods[id] || 0));
  for (const [id, label] of MODS) { const n = P.mods[id] || 0; row(ol, '', label, '', n ? `${pct(n / P.fights)}  ${int(n)}` : '--', n / max, `${cap(label)}: ${int(n)} fights, ${pct(n / P.fights)}`, !n); }
}

function foot(root) {
  const f = el('footer', 'foot', root), ls = el('div', 'lines', f);
  const m = DATA ? DATA.min : { winRate: 20, hardest: 25 };
  bt(ls, '* How it counts: a fight is one battle finished on the simulator, won, lost or left early.', { role: 'body', wrap: true });
  bt(ls, `* Win rates, hits per fight and the hardest list use only fights won or lost without autoplay or assists (rewind, save states, practice). A win rate shows after ${m.winRate} such fights; a fight joins the hardest list after ${m.hardest}. "Typical" is the middle value: half of the fights are above it, half below.`, { role: 'label', wrap: true, col: COL.dim });
  bt(ls, '* Anonymous: no names, accounts, cookies or typed text. The same switch also sends bug reports only the developer sees (errors, freezes, frame rate, files that did not load, where fights end). Turn both off in the simulator: CONFIG, SYSTEM, Share anonymous stats and bug reports.', { role: 'label', wrap: true, col: COL.dim });
  if (DATA) bt(ls, `* Times are UTC. Updated every 5 minutes; last update ${dt(DATA.now).hm} UTC.`, { role: 'label', wrap: true, col: COL.dim });
  // the simulator's version, from the update notes (assets/updates/updates.json), and the way to them
  if (VER) { const v = el('a', 'ver', ls, { href: '/updates' }); bt(v, `* The simulator is at v${VER}. What changed: update notes >`, { role: 'label', col: COL.sel, sr: `The simulator is at version ${VER}. Read the update notes` }); }
  const ret = el('a', 'btn', f, { href: '/' }); heart(ret); bt(ret, 'BACK TO THE SIMULATOR', { role: 'name', sr: 'Back to the simulator' }, 'inl');
}

// ------------------------------------------------------------------------------ boot
let VER = '';
async function boot() {
  const dataP = getDataQuiet();
  const verP = fetchT('/assets/updates/updates.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => { VER = String(j.updates[0].version || ''); }, () => { });
  const tab = await (await fetchT(S_ + 'fonts.json')).json();
  await Promise.all(['fnt_main', 'fnt_mainbig'].map(async (n) => { F[n] = { ...tab[n], img: await load(A + n + '.png') }; }));
  [F.tl, F.top, F.left] = await Promise.all(['box_corner', 'box_top', 'box_left'].map((n) => load(S_ + n + '.png')));
  await verP;
  let rt = 0; const redraw = () => { clearTimeout(rt); rt = setTimeout(() => { if (innerWidth !== drawnW) render(); }, 150); };
  addEventListener('resize', redraw); addEventListener('load', redraw);
  ready = true;
  render();
  await dataP;
  redraw();
  addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h !== period && PERIODS.some((p) => p[0] === h)) { period = h; render(); } });
}
let ready = false;
async function getDataQuiet() {
  try {
    const r = await fetchT('/api/stats', { credentials: 'same-origin' });
    if (!r.ok) throw new Error('status ' + r.status);
    const j = await r.json();
    if (!j || j.v !== 1 || !j.periods || !j.periods['7d']) throw new Error('shape');
    DATA = j; status = 'ok';
  } catch (e) { status = 'error'; }
  if (ready) render();
}
boot().catch(() => {
  // the page's own files did not come (its fonts and box art): say so, with a way to try again
  const m = document.getElementById('st'); m.textContent = '';
  const p = el('p', 'plain', m); p.textContent = "The page couldn't load. Check your connection and ";
  const r = el('a', '', p, { href: location.pathname }); r.textContent = 'try again';
  p.appendChild(document.createTextNode(', or go '));
  const a = el('a', '', p, { href: '/' }); a.textContent = 'back to the simulator'; p.appendChild(document.createTextNode('.'));
});
