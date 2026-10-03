// UPDATE NOTES - every update of the simulator and its notes, newest first, drawn the simulator's way:
// the game's bitmap fonts at whole-number scales, the Dark World text box as the frame, the red SOUL as
// the cursor and yellow for what is selected. Each update has a thumbnail card: PATCH NOTES, the version
// big, its tags as coloured chips, and the game sprites of the fight it is about.
//
// ONE VIEW, TWO HOMES: the simulator's UPDATES page (the app bundles this file) and the plain /updates
// page (it loads this file as it is). The data is updates.json next to this file. Nothing here runs
// until mount() is called; it reads no storage and sends nothing.
//
// mount(root, data, env) -> { key(e), pad(p), render(), open(i), destroy() }
//   env.F        { fnt_main, fnt_mainbig }: { img, glyphs } each (glyph = [sx, sy, w, h, advance, offset])
//   env.box      { corner, top, left }: the text box's parts (images), or null for a plain white edge
//   env.spriteURL(name, frame) -> the URL of a sprite frame's PNG (assets/updates/spr/)
//   env.home     'app' (an overlay with CLOSE) | 'page' (a page with a link back to the simulator)
//   env.seen     the newest version the player had seen before this opened ('' = none: nothing is NEW)
//   env.start    a version to open at once, or null for the list
//   env.touch    a touch screen (the hints say TAP)
//   env.sound    (name) => void, optional
//   env.close    () => void (app)
//   env.onOpen   (version|null) => void, optional (the page keeps it in the address: #v0.9.4)

export const TAG_COLORS = {
  'MAJOR UPDATE': '#ff0000', 'MINOR UPDATE': '#c0c0c0', 'BUG FIXES': '#00ff00', 'HOTFIX': '#ffa040',
  'NEW FIGHTS': '#ff00ff', 'NEW FEATURE': '#ffff00', 'PERFORMANCE': '#00ffff', 'BALANCE': '#e0c060',
};
export const THUMB_W = 192, THUMB_H = 108;
const COL = { fg: '#ffffff', sel: '#ffff00', dim: '#808080', grid: 'rgba(96,56,128,0.30)', edge: '#404040' };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HEART = 'M1 1h2v1h1V1h2v1h1v2H6v1H5v1H4v1H3V6H2V5H1V4H0V2h1z';
export const SOUL_SVG = `<svg viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true"><path fill="#ff0000" d="${HEART}"/></svg>`;

/** "OCT 1, 2026" (and the long form for screen readers) */
export function dateLabel(iso, long = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return (long ? MONTHS_LONG : MONTHS)[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1];
}
/** compare two "MAJOR.MINOR.PATCH" versions: <0, 0, >0 */
export function cmpVersion(a, b) {
  const p = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}

// ------------------------------------------------------------------------------------------ bitmap text
const tints = new WeakMap();
function tinted(f, col) {
  let m = tints.get(f); if (!m) { m = new Map(); tints.set(f, m); }
  let cv = m.get(col); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = f.img.width; cv.height = f.img.height;
  const x = cv.getContext('2d'); x.drawImage(f.img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, cv.width, cv.height);
  m.set(col, cv); return cv;
}
const gl = (f, ch) => f.glyphs[ch.charCodeAt(0)] || f.glyphs[63];
const ok = (f) => !!(f && f.img && f.img.width && f.glyphs);
export function textW(f, s) { let n = 0; for (const ch of s) { const g = gl(f, ch); if (g) n += g[4]; } return n; }
/** draw `s` at (px, py) in font px; returns its width */
export function drawText(x, f, s, px, py, col) {
  const sh = tinted(f, col); let cx = px;
  for (const ch of s) {
    const g = gl(f, ch); if (!g) continue;
    const [sx, sy, w, h, adv, off] = g;
    if (w > 0 && h > 0) x.drawImage(sh, sx, sy, w, h, cx + off, py, w, h);
    cx += adv;
  }
  return cx - px;
}
/** word-wrap to `max` font px; a '* ' line hangs its continuation under the first word */
export function wrapText(f, text, max) {
  const star = text.startsWith('* '), ind = star ? textW(f, '* ') : 0, out = [];
  let cur = '', first = true;
  for (const word of text.split(' ')) {
    const t = cur ? cur + ' ' + word : word;
    if (cur && textW(f, t) + (first ? 0 : ind) > max) { out.push({ t: cur, x: first ? 0 : ind }); cur = word; first = false; } else cur = t;
  }
  out.push({ t: cur, x: first ? 0 : ind });
  return out;
}
// the ink rows of a capital in the font's cell (for chips: the words sit in the middle)
const caps = new WeakMap();
function capOf(f) {
  let c = caps.get(f); if (c) return c;
  const g = gl(f, 'H'); c = { top: 3, base: g ? Math.min(g[3], 14) : 14 };
  try {
    const [sx, sy, w, h] = g, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d'); x.drawImage(f.img, sx, sy, w, h, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data; let t = -1, b = -1;
    for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) if (d[(y * w + i) * 4 + 3] > 127) { if (t < 0) t = y; b = y; }
    if (t >= 0) c = { top: t, base: b + 1 };
  } catch (e) { }
  caps.set(f, c); return c;
}

// ------------------------------------------------------------------------------------------ sprites
// Each frame is a small PNG cut from the game's atlas; loaded once, and every thumbnail waiting on it is
// painted again when it lands. A frame that does not load is simply left out.
const spr = new Map();
function sprite(env, name, frame, again) {
  const key = name + '_' + frame;
  let s = spr.get(key);
  if (!s) {
    s = { img: null, wait: new Set(), bad: false };
    spr.set(key, s);
    const im = new Image();
    im.onload = () => { s.img = im; for (const f of s.wait) { try { f(); } catch (e) { } } s.wait.clear(); };
    im.onerror = () => { s.bad = true; s.wait.clear(); };
    im.src = env.spriteURL(name, frame);
  }
  if (!s.img && !s.bad && again) s.wait.add(again);
  return s.img;
}

// ------------------------------------------------------------------------------------------ the thumbnail
/** paint an update's card into `cv` at k device px per card px */
export function paintThumb(cv, e, env, k) {
  const W = THUMB_W, H = THUMB_H, F = env.F;
  cv.width = W * k; cv.height = H * k;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(k, 0, 0, k, 0, 0);
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  // the Dark World's grid
  x.fillStyle = COL.grid;
  for (let gx = 5; gx < W; gx += 12) x.fillRect(gx, 0, 1, H);
  for (let gy = 5; gy < H; gy += 12) x.fillRect(0, gy, W, 1);
  const m = ok(F.fnt_main) ? F.fnt_main : null, b = ok(F.fnt_mainbig) ? F.fnt_mainbig : null;
  let right = 0;
  if (m) right = 10 + drawText(x, m, 'PATCH NOTES', 10, 6, COL.sel);
  if (b) right = Math.max(right, 8 + drawText(x, b, 'v' + e.version, 8, 20, COL.fg));
  // the tags: chips in their order, left to right, a second row when they do not fit on one; the block
  // sits on the bottom-left
  const rows = [[]];
  let chipTop = H;
  if (m) {
    const cap = capOf(m), ch = cap.base - cap.top + 6;
    let rx = 8;
    for (const t of e.tags || []) {
      const w = textW(m, t) + 8;
      if (rx > 8 && rx + w > W - 8) { rows.push([]); rx = 8; }
      rows[rows.length - 1].push({ t, w, x: rx }); rx += w + 4;
    }
    // rows[] is top-down; the last one sits 8 px above the bottom
    rows.forEach((row, i) => {
      const y = H - 8 - (rows.length - i) * (ch + 3) + 3;
      if (row.length) chipTop = Math.min(chipTop, y);
      for (const c of row) {
        x.fillStyle = TAG_COLORS[c.t] || COL.fg; x.fillRect(c.x, y, c.w, ch);
        drawText(x, m, c.t, c.x + 4, y + 3 - cap.top, '#000000');
      }
    });
    e._chipRight = Math.max(0, ...rows.flat().map((c) => c.x + c.w));
  }
  // the sprites: on the right, standing on the card's floor (above the chips if those reach under them)
  const list = (e.sprite || []).map(([n, f]) => sprite(env, n, f | 0, () => paintThumb(cv, e, env, k))).filter(Boolean);
  if (list.length && list.length === (e.sprite || []).length) {
    const x0 = Math.max(right + 6, 96), x1 = W - 8;
    const floor = (e._chipRight || 0) > x0 ? chipTop - 4 : H - 8;
    const tw = list.reduce((a, im) => a + im.width, 0) + 4 * (list.length - 1), th = Math.max(...list.map((im) => im.height));
    const s = Math.max(1, Math.min(4, Math.floor((x1 - x0) / tw), Math.floor((floor - 6) / th)));
    let sx = Math.round(x0 + ((x1 - x0) - tw * s) / 2);
    for (const im of list) { x.drawImage(im, 0, 0, im.width, im.height, sx, floor - im.height * s, im.width * s, im.height * s); sx += (im.width + 4) * s; }
  }
}

// ------------------------------------------------------------------------------------------ style
// (also the look of the site's other plain pages that use this kit: /giveaway)
export function mountStyle() {
  if (document.getElementById('dr-updates-style')) return;
  const st = document.createElement('style'); st.id = 'dr-updates-style';
  st.textContent = `
#dr-updates { color:#fff; font:16px/20px monospace; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
#dr-updates * { box-sizing:border-box; }
#dr-updates.app { position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center; -webkit-user-select:none; user-select:none;
  padding:max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); touch-action:manipulation; }
#dr-updates.page { min-height:100vh; display:flex; justify-content:center; padding:16px; }
#dr-updates canvas { display:block; image-rendering:pixelated; }
#dr-updates .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; }
#dr-updates .bt { display:block; position:relative; }
#dr-updates .bt.fb .sr { position:static; width:auto; height:auto; clip:auto; clip-path:none; white-space:normal; }
#dr-updates .bk { position:absolute; inset:0; background-color:rgba(0,0,0,.88);
  background-image:linear-gradient(rgba(96,56,128,.2) 2px, transparent 2px), linear-gradient(90deg, rgba(96,56,128,.2) 2px, transparent 2px); background-size:40px 40px; }
#dr-updates.app .box { animation:dru-open .2s cubic-bezier(.2,.8,.25,1) both; }
@keyframes dru-open { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
#dr-updates.still .box { animation:none; }
#dr-updates .box { position:relative; display:flex; flex-direction:column; width:min(1000px, 100%); max-height:100%;
  border:32px solid transparent; border-image-width:32px; border-image-repeat:stretch; image-rendering:pixelated; }
#dr-updates.page .box { max-height:none; }
#dr-updates.t-S .box, #dr-updates.t-W .box { border-width:16px; border-image-width:16px; }
#dr-updates.app.t-W .box { width:min(920px, 100%); height:100%; }
#dr-updates.app.t-L .box { height:min(860px, 100%); }
#dr-updates .in { display:flex; flex-direction:column; min-height:0; flex:1 1 auto; padding:12px 28px 12px; }
#dr-updates.t-S .in, #dr-updates.t-W .in { padding:6px 8px 6px; }
#dr-updates .head { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex:none; padding-bottom:10px; border-bottom:2px solid #262626; }
#dr-updates .body { overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; flex:1 1 auto; min-height:60px; margin-top:14px; padding:4px 6px 4px 4px;
  scrollbar-gutter:stable; scrollbar-width:thin; scrollbar-color:#808080 #000; }
#dr-updates.page .body { overflow:visible; }
#dr-updates .body::-webkit-scrollbar { width:8px; } #dr-updates .body::-webkit-scrollbar-thumb { background:#808080; } #dr-updates .body::-webkit-scrollbar-track { background:#000; }
#dr-updates.t-S .body, #dr-updates.t-W .body { margin-top:8px; }
/* the list: one row per update, newest first */
#dr-updates .list { display:flex; flex-direction:column; gap:14px; margin:0; padding:0; list-style:none; }
#dr-updates.t-S .list, #dr-updates.t-W .list { gap:10px; }
#dr-updates .card { appearance:none; position:relative; display:flex; gap:20px; align-items:flex-start; width:100%; padding:8px; margin:0; text-align:left; cursor:pointer; color:#fff;
  background:#000; border:2px solid ${COL.edge}; outline:none; font:inherit; }
#dr-updates.t-S .card, #dr-updates.t-W .card { gap:12px; padding:6px; }
#dr-updates.t-S .card { flex-direction:column; }
#dr-updates .card .th { flex:none; border:2px solid #000; }
#dr-updates .card:hover { border-color:#c0c0c0; }
#dr-updates .card.sel { border-color:${COL.sel}; box-shadow:0 0 0 2px #000, 0 0 0 4px ${COL.sel}; }
#dr-updates .card .meta { min-width:0; flex:1 1 auto; display:flex; flex-direction:column; gap:8px; padding-top:2px; }
#dr-updates.t-S .card .meta, #dr-updates.t-W .card .meta { gap:4px; }
#dr-updates .card .tl { display:flex; align-items:flex-start; gap:10px; }
#dr-updates .card .tl .tt { flex:1 1 auto; min-width:0; }
#dr-updates .card .soul { width:16px; height:16px; flex:none; visibility:hidden; margin-top:6px; }
#dr-updates.t-S .card .soul, #dr-updates.t-W .card .soul { margin-top:0; }
#dr-updates .card .soul svg { display:block; width:16px; height:16px; }
#dr-updates .card.sel .soul { visibility:visible; }
#dr-updates .y { display:none; } #dr-updates .card.sel .tl .w { display:none; } #dr-updates .card.sel .tl .y { display:block; }
#dr-updates .line { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
#dr-updates .ex { margin-top:4px; }
#dr-updates .ex .bt + .bt { margin-top:4px; }
/* one update, opened */
#dr-updates .entry { display:flex; flex-direction:column; gap:18px; }
#dr-updates .entry .top { display:flex; gap:24px; align-items:flex-end; }
#dr-updates.t-S .entry .top { flex-direction:column; align-items:flex-start; gap:10px; }
#dr-updates.t-W .entry .top { gap:14px; }
#dr-updates .entry .th { border:2px solid ${COL.edge}; flex:none; }
#dr-updates .entry .eh { display:flex; flex-direction:column; gap:10px; min-width:0; flex:1 1 auto; align-self:stretch; justify-content:flex-end; }
#dr-updates.t-S .entry .eh, #dr-updates.t-W .entry .eh { gap:6px; }
#dr-updates .notes { display:flex; flex-direction:column; gap:10px; margin:0; padding:0; list-style:none; }
#dr-updates.t-S .notes, #dr-updates.t-W .notes { gap:6px; }
#dr-updates.t-S .entry, #dr-updates.t-W .entry { gap:12px; }
/* the buttons and the key hints */
#dr-updates .foot { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:14px; flex:none; flex-wrap:wrap; }
#dr-updates.t-S .foot, #dr-updates.t-W .foot { margin-top:8px; gap:8px; }
#dr-updates .btns { display:flex; gap:12px; margin-left:auto; }
#dr-updates.t-S .btns, #dr-updates.t-W .btns { gap:8px; }
#dr-updates .btn { appearance:none; display:flex; align-items:center; gap:8px; padding:8px 14px; cursor:pointer; background:#000; color:#fff; text-decoration:none;
  border:2px solid #fff; box-shadow:0 0 0 2px #000, 0 0 0 4px ${COL.edge}; outline:none; font:inherit; }
#dr-updates.t-S .btn, #dr-updates.t-W .btn { padding:5px 10px; }
#dr-updates .btn .y { display:none; }
#dr-updates .btn:hover, #dr-updates .btn:focus-visible { border-color:${COL.sel}; box-shadow:0 0 0 2px #000, 0 0 0 4px ${COL.sel}; }
#dr-updates .btn:hover .w, #dr-updates .btn:focus-visible .w { display:none; } #dr-updates .btn:hover .y, #dr-updates .btn:focus-visible .y { display:block; }
#dr-updates .btn[disabled] { opacity:.35; pointer-events:none; }
#dr-updates .card:focus, #dr-updates .body:focus { outline:none; }
@media (max-width:420px) { #dr-updates .foot .keys { display:none; } }
@media (prefers-reduced-motion: reduce) { #dr-updates .box { animation:none !important; } }
`;
  document.head.appendChild(st);
}

// ------------------------------------------------------------------------------------------ the kit
// What the view is built from, for the site's other plain pages too (/giveaway): the display's integer
// pixel ratio, the layout tier, the text box frame and runs of bitmap text.
export const dpr = () => Math.max(1, Math.round(window.devicePixelRatio || 1));
/** 'L' a big window (2x text), 'W' short and wide (a phone sideways, 1x), 'S' the rest (1x) */
export function tierOf() {
  const w = window.innerWidth, h = window.innerHeight;
  if (w >= 960 && h >= 640) return 'L';
  if (w > h && w >= 600 && h < 560) return 'W';
  return 'S';
}
/** the text box as a 9-slice border image at px device pixels per art pixel ({ corner, top, left } images) */
export function frameDataURL(p, px) {
  if (!p || !p.corner || !p.top || !p.left) return null;
  const C = 16 * px, Z = C * 3, cv = document.createElement('canvas'); cv.width = Z; cv.height = Z;
  const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  x.fillStyle = '#000'; x.fillRect(4 * px, 4 * px, Z - 8 * px, Z - 8 * px);
  const put = (img, sx, sy, dx, dy) => { x.save(); x.translate(dx + (sx < 0 ? C : 0), dy + (sy < 0 ? C : 0)); x.scale(sx, sy); x.drawImage(img, 0, 0, C, C); x.restore(); };
  put(p.top, 1, 1, C, 0); put(p.top, 1, -1, C, 2 * C); put(p.left, 1, 1, 0, C); put(p.left, -1, 1, 2 * C, C);
  put(p.corner, 1, 1, 0, 0); put(p.corner, -1, 1, 2 * C, 0); put(p.corner, 1, -1, 0, 2 * C); put(p.corner, -1, -1, 2 * C, 2 * C);
  try { return cv.toDataURL(); } catch (e) { return null; }
}
/** runs of bitmap text in elements: a canvas for the eyes, the same words for screen readers */
export function textKit(F) {
  const texts = [];
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
  // o: { font: 'fnt_main' | 'fnt_mainbig', col, s (whole-number scale), wrap (fill the parent's width) }
  function bt(parent, text, o = {}, cls = '') {
    const w = el('span', 'bt ' + cls, parent);
    const sr = el('span', 'sr', w); sr.textContent = text;
    const cv = el('canvas', '', w); cv.setAttribute('aria-hidden', 'true');
    w._bt = { text, font: o.font || 'fnt_main', col: o.col || COL.fg, s: o.s || 1, wrap: !!o.wrap, cv };
    texts.push(w);
    return w;
  }
  function paint(w) {
    const b = w._bt, f = F[b.font];
    if (!ok(f)) { b.cv.style.display = 'none'; w.classList.add('fb'); return; }
    const s = b.s, D = dpr(), lh = b.font === 'fnt_mainbig' ? 34 : 20;
    const avail = b.wrap ? Math.max(40, Math.floor(w.parentElement ? w.parentElement.clientWidth : 300)) : 0;
    const lines = b.wrap ? wrapText(f, b.text, Math.floor(avail / s)) : [{ t: b.text, x: 0 }];
    const cssW = b.wrap ? avail : Math.ceil(textW(f, b.text) * s);
    const cssH = (b.wrap ? (lines.length - 1) * lh + (gl(f, 'A') || [0, 0, 0, 16])[3] : (gl(f, 'A') || [0, 0, 0, 16])[3]) * s;
    const cv = b.cv; cv.width = Math.max(1, cssW * D); cv.height = Math.max(1, cssH * D); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(s * D, 0, 0, s * D, 0, 0);
    lines.forEach((l, i) => drawText(x, f, l.t, l.x, i * lh, b.col));
  }
  // a label in white that turns yellow when its card or button is selected / hovered
  function label2(parent, text, font, s, wrap = false) { bt(parent, text, { font, s, wrap }, 'w'); bt(parent, text, { font, s, wrap, col: COL.sel }, 'y').setAttribute('aria-hidden', 'true'); }
  return {
    bt, paint, label2,
    // every run (wrapped ones measure their parent: once more after layout)
    paintAll(wrapOnly = false) { for (const w of texts) if (!wrapOnly || w._bt.wrap) paint(w); },
    reset() { texts.length = 0; },
  };
}

// ------------------------------------------------------------------------------------------ the view
export function mount(root, data, env) {
  mountStyle();
  const U = (data && Array.isArray(data.updates) ? data.updates : []).filter((e) => e && e.version);
  const F = env.F, kit = textKit(F), bt = kit.bt, label2 = kit.label2;
  const S = { view: 'list', sel: 0, open: -1, tier: 'L', scrollList: 0 };
  const isNew = (e) => !!env.seen && cmpVersion(e.version, env.seen) > 0;
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
  const sound = (n) => { try { if (env.sound) env.sound(n); } catch (e) { } };
  root.id = 'dr-updates';
  root.classList.add(env.home === 'app' ? 'app' : 'page');
  // over the app nothing reaches the menu under it (a tap on the dim closes, and goes no further)
  if (env.home === 'app') for (const t of ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'wheel', 'click', 'contextmenu']) root.addEventListener(t, (ev) => ev.stopPropagation(), { passive: true });
  if (env.still) root.classList.add('still');

  function thumb(parent, e, k) {
    const cv = el('canvas', 'th', parent); cv.setAttribute('aria-hidden', 'true');
    const D = dpr(); paintThumb(cv, e, env, k * D);
    cv.style.width = THUMB_W * k + 'px'; cv.style.height = THUMB_H * k + 'px';
    return cv;
  }
  let box = null, body = null, cards = [], btnRow = null;
  function button(parent, text, s, act, aria) {
    const b = el(env.home === 'page' && act === 'home' ? 'a' : 'button', 'btn', parent);
    if (b.tagName === 'A') b.href = '/'; else b.type = 'button';
    b.setAttribute('aria-label', aria || text);
    label2(b, text, 'fnt_main', s);
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'touchstart']) b.addEventListener(t, (ev) => ev.stopPropagation(), { passive: true });
    if (typeof act === 'function') b.addEventListener('click', (ev) => { ev.preventDefault(); sound('snd_select'); act(); });
    return b;
  }

  function render() {
    const keepTop = body ? body.scrollTop : 0;
    S.tier = tierOf(); kit.reset(); cards = [];
    root.classList.remove('t-L', 't-W', 't-S'); root.classList.add('t-' + S.tier);
    root.textContent = '';
    const big = S.tier === 'L', T = big ? 2 : 1, K = big ? 2 : 1;
    if (env.home === 'app') { const bk = el('div', 'bk', root); bk.addEventListener('click', () => { if (env.close) env.close(); }); }
    box = el('div', 'box', root);
    const px = (big ? 2 : 1) * dpr(), fu = frameDataURL(env.box, px);
    if (fu) { box.style.borderImageSource = `url(${fu})`; box.style.borderImageSlice = (16 * px) + ' fill'; }
    else { box.style.border = '2px solid #fff'; box.style.background = '#000'; box.style.padding = '12px'; }
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'wheel', 'contextmenu']) box.addEventListener(t, (ev) => ev.stopPropagation(), { passive: true });
    const inner = el('div', 'in', box);
    const head = el('div', 'head', inner);
    const h = el(env.home === 'page' ? 'h1' : 'h2', '', head); h.style.cssText = 'margin:0;font:inherit'; h.id = 'dru-title';
    bt(h, 'UPDATE NOTES', { font: 'fnt_mainbig', s: big ? 2 : 1 });
    if (U[0]) bt(head, 'v' + U[0].version + ' BETA', { col: COL.dim, s: 1 });
    body = el('div', 'body', inner); body.tabIndex = -1;
    if (S.view === 'list') renderList(body, T, K); else renderEntry(body, T, K);
    const foot = el('div', 'foot', inner);
    const hint = S.view === 'list'
      ? (env.touch ? 'TAP AN UPDATE TO READ IT' : 'Z: READ   ' + (env.home === 'app' ? 'X: CLOSE' : 'ARROWS: MOVE'))
      : (env.touch ? 'TAP < > FOR OTHER UPDATES' : 'X: BACK   < >: OTHER UPDATES');
    bt(foot, hint, { col: COL.dim, s: 1 }, 'keys');
    btnRow = el('div', 'btns', foot);
    if (S.view === 'entry') {
      const newer = button(btnRow, '<', T, () => go(-1), 'Newer update'); if (S.open <= 0) newer.disabled = true;
      const older = button(btnRow, '>', T, () => go(1), 'Older update'); if (S.open >= U.length - 1) older.disabled = true;
      button(btnRow, 'BACK', T, () => back(), 'Back to all updates');
    } else if (env.home === 'app') button(btnRow, 'CLOSE', T, () => { if (env.close) env.close(); }, 'Close the update notes');
    else button(btnRow, 'BACK TO THE SIMULATOR', T, 'home', 'Back to the simulator');
    kit.paintAll();
    requestAnimationFrame(() => kit.paintAll(true));
    if (S.view === 'list') { body.scrollTop = S.scrollList; select(S.sel, false, true); } else body.scrollTop = keepTop && S.keepEntryTop ? keepTop : 0;
    S.keepEntryTop = false;
  }
  function renderList(parent, T, K) {
    const ul = el('ul', 'list', parent); ul.setAttribute('aria-label', 'Updates, newest first');
    U.forEach((e, i) => {
      const li = el('li', '', ul);
      const c = el('button', 'card', li); c.type = 'button';
      c.setAttribute('aria-label', 'Version ' + e.version + ', ' + e.title + ', ' + dateLabel(e.date, true) + (isNew(e) ? ', new' : '') + '. ' + (e.tags || []).join(', '));
      thumb(c, e, K);
      const meta = el('div', 'meta', c);
      const tl = el('div', 'tl', meta); el('span', 'soul', tl).innerHTML = SOUL_SVG;
      // (a long title wraps under itself instead of running off the card)
      const tw = el('div', 'tt', tl); label2(tw, e.title.toUpperCase(), S.tier === 'L' ? 'fnt_mainbig' : 'fnt_main', 1, true);
      const line = el('div', 'line', meta);
      bt(line, 'v' + e.version + '   ' + dateLabel(e.date), { col: COL.dim, s: 1 });
      if (isNew(e)) bt(line, 'NEW', { col: COL.sel, s: 1 });
      // the first lines (the first two on a big window, one on a phone held sideways)
      const nEx = S.tier === 'L' ? 2 : S.tier === 'W' ? 1 : 0;
      if (nEx) {
        const ex = el('div', 'ex', meta);
        for (const n of (e.notes || []).slice(0, nEx)) bt(ex, '* ' + n, { s: 1, wrap: true });
        if ((e.notes || []).length > nEx) bt(ex, '+ ' + (e.notes.length - nEx) + ' more', { col: COL.dim, s: 1 });
      }
      c.addEventListener('pointerenter', () => select(i, false));
      c.addEventListener('focus', () => select(i, false));
      c.addEventListener('click', () => { sound('snd_select'); open(i); });
      cards.push(c);
    });
  }
  function renderEntry(parent, T, K) {
    const e = U[S.open]; if (!e) return;
    const art = el('article', 'entry', parent); art.setAttribute('aria-labelledby', 'dru-etitle');
    const top = el('div', 'top', art);
    thumb(top, e, K);
    const eh = el('div', 'eh', top);
    const t = el('h3', '', eh); t.id = 'dru-etitle'; t.style.cssText = 'margin:0;font:inherit';
    bt(t, e.title.toUpperCase(), { font: 'fnt_mainbig', s: S.tier === 'L' ? 2 : 1, wrap: true });
    const line = el('div', 'line', eh);
    bt(line, 'v' + e.version + '   ' + dateLabel(e.date), { col: COL.dim, s: T });
    if (isNew(e)) bt(line, 'NEW', { col: COL.sel, s: T });
    const ul = el('ul', 'notes', art);
    for (const n of e.notes || []) bt(el('li', '', ul), '* ' + n, { s: T, wrap: true });
  }

  function select(i, snd = true, scroll = false) {
    if (!cards.length) return;
    i = Math.max(0, Math.min(cards.length - 1, i));
    if (snd && i !== S.sel) sound('snd_menumove');
    S.sel = i;
    cards.forEach((c, k) => c.classList.toggle('sel', k === i));
    if (scroll && body) {
      const c = cards[i], top = c.offsetTop - body.offsetTop, bottom = top + c.offsetHeight;
      if (top < body.scrollTop) body.scrollTop = top - 6; else if (bottom > body.scrollTop + body.clientHeight) body.scrollTop = bottom - body.clientHeight + 6;
    }
  }
  function open(i) {
    if (!U[i]) return;
    if (S.view === 'list' && body) S.scrollList = body.scrollTop;
    S.view = 'entry'; S.open = i; S.sel = i;
    render();
    if (env.onOpen) env.onOpen(U[i].version);
    try { body.focus({ preventScroll: true }); } catch (e) { }
  }
  function back() {
    if (S.view !== 'entry') return false;
    S.view = 'list'; S.sel = S.open; render();
    select(S.sel, false, true);
    if (env.onOpen) env.onOpen(null);
    try { cards[S.sel].focus({ preventScroll: true }); } catch (e) { }
    return true;
  }
  function go(d) {
    if (S.view !== 'entry') return;
    const n = S.open + d; if (n < 0 || n >= U.length) return;
    sound('snd_menumove'); open(n);
  }
  // LEFT/RIGHT walk the list too: there is one row per update
  function key(e) {
    const k = e.key;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const down = k === 'ArrowDown' || k === 's' || k === 'S', up = k === 'ArrowUp' || k === 'w' || k === 'W';
    const left = k === 'ArrowLeft' || k === 'a' || k === 'A' || k === '[' || k === 'q' || k === 'Q', right = k === 'ArrowRight' || k === 'd' || k === 'D' || k === ']' || k === 'e' || k === 'E';
    const yes = k === 'z' || k === 'Z' || k === 'Enter' || k === ' ', no = k === 'x' || k === 'X' || k === 'Escape' || k === 'Backspace';
    if (S.view === 'list') {
      if (down || right) { select(S.sel + 1, true, true); return true; }
      if (up || left) { select(S.sel - 1, true, true); return true; }
      if (k === 'Home') { select(0, true, true); return true; }
      if (k === 'End') { select(U.length - 1, true, true); return true; }
      if (yes) { const a = document.activeElement; if (a && a.classList && a.classList.contains('btn') && root.contains(a) && k !== 'z' && k !== 'Z') { a.click(); return true; } sound('snd_select'); open(S.sel); return true; }
      if (no && env.home === 'app') { sound('snd_menumove'); if (env.close) env.close(); return true; }
      return false;
    }
    if (no || k === 'z' || k === 'Z') { sound('snd_menumove'); back(); return true; }
    if (left) { go(-1); return true; }
    if (right) { go(1); return true; }
    if (down) { body.scrollTop += 40; return true; }
    if (up) { body.scrollTop -= 40; return true; }
    if (k === 'PageDown' || k === ' ') { body.scrollTop += body.clientHeight - 30; return true; }
    if (k === 'PageUp') { body.scrollTop -= body.clientHeight - 30; return true; }
    if (k === 'Enter') { const a = document.activeElement; if (a && a.classList && a.classList.contains('btn') && root.contains(a)) { a.click(); return true; } back(); return true; }
    return false;
  }
  // a gamepad (the app hands its game buttons over): p = { confirm, cancel, left, right, up, down, upHeld, downHeld }
  function pad(p) {
    if (S.view === 'list') {
      if (p.down || p.right) select(S.sel + 1, true, true);
      else if (p.up || p.left) select(S.sel - 1, true, true);
      else if (p.confirm) { sound('snd_select'); open(S.sel); }
      else if (p.cancel) { sound('snd_menumove'); if (env.close) env.close(); }
      return;
    }
    if (p.cancel || p.confirm) { sound('snd_menumove'); back(); }
    else if (p.left) go(-1);
    else if (p.right) go(1);
    else if (p.upHeld) body.scrollTop -= 8;
    else if (p.downHeld) body.scrollTop += 8;
  }
  let rz = 0;
  const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { if (S.view === 'entry') S.keepEntryTop = true; if (S.view === 'list' && body) S.scrollList = body.scrollTop; render(); }, 120); };
  addEventListener('resize', onResize);
  const at = env.start ? U.findIndex((e) => e.version === String(env.start).replace(/^v/, '')) : -1;
  if (at >= 0) { S.view = 'entry'; S.open = S.sel = at; }
  render();
  return {
    key, pad, render, open, back, view: () => S.view, sel: () => S.sel,
    destroy() { removeEventListener('resize', onResize); clearTimeout(rz); root.textContent = ''; },
  };
}
