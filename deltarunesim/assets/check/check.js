// NETWORK CHECK (/check). Asks deltarunesim.com for one real file of each kind the simulator loads (its
// code, a sprite sheet, a sound, a video clip), tries the browser's storage and the fight stats API, and
// says plainly what came through. It looks at what came BACK, not only at the status: a school filter or
// an SSL-inspecting proxy often answers a blocked file with its own web page and a 200.
// One module, no inline script (the CSP), no other site, nothing sent anywhere.
const TIMEOUT = 15000;
const DOMAIN = 'deltarunesim.com';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };

// one request, given up after TIMEOUT; resolves { r, bytes } or throws an Error whose message is for people
async function get(url, { range = 0 } = {}) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ac && ac.abort(), TIMEOUT);
  try {
    const headers = range ? { Range: 'bytes=0-' + (range - 1) } : {};
    let r;
    try { r = await fetch(url, { cache: 'no-store', credentials: 'same-origin', headers, signal: ac ? ac.signal : undefined }); }
    catch (e) { throw new Error(e && e.name === 'AbortError' ? 'no answer in ' + TIMEOUT / 1000 + ' seconds' : 'the connection was refused or cut (blocked, or offline)'); }
    if (r.headers.get('cf-mitigated') === 'challenge') throw new Error("the site's bot check answered instead of the file (it may be blocked on this network)");
    if (r.status === 403) throw new Error('refused (HTTP 403) - a filter or firewall?');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = new Uint8Array(await r.arrayBuffer());
    clearTimeout(t);
    return { r, bytes: range ? buf.subarray(0, range) : buf };
  } catch (e) { if (e && e.name === 'AbortError') throw new Error('no answer in ' + TIMEOUT / 1000 + ' seconds'); throw e; }
  finally { clearTimeout(t); }
}
const text = (b) => new TextDecoder().decode(b);
const type = (r) => (r.headers.get('content-type') || '').toLowerCase();
function notAPage(r, b) {
  if (/text\/html/.test(type(r)) || /^\s*<(!doctype|html)/i.test(text(b.subarray(0, 64)))) throw new Error('a web page came back instead of the file (a filter\'s block page?)');
}
const starts = (b, sig) => sig.every((v, i) => b[i] === v);

const CHECKS = [
  { id: 'code', name: 'Game code', need: true, async run() {
    // the page lists its code (index.html #dr-boot); the dev server has none and serves js/main.js
    const home = await get('/');
    notAPageIfNotHome(home);
    const m = /<script type="application\/json" id="dr-boot">([\s\S]*?)<\/script>/.exec(text(home.bytes));
    let main = 'js/main.js';
    if (m) { try { main = JSON.parse(m[1]).main || main; } catch (e) { } }
    const { r, bytes } = await get('/' + main);
    notAPage(r, bytes);
    if (!/javascript|ecmascript/.test(type(r))) throw new Error('the file came back as ' + (type(r) || 'an unknown type') + ', not as a script');
    if (bytes.length < 1000) throw new Error('the file came back cut short');
    return 'the code downloads';
  } },
  { id: 'sprites', name: 'Sprites', need: true, async run() {
    const idx = await get('/assets/atlas_pages.json');
    notAPage(idx.r, idx.bytes);
    let first = null; try { first = JSON.parse(text(idx.bytes)).pages[0].file; } catch (e) { throw new Error('the sprite list came back damaged'); }
    const { r, bytes } = await get('/assets/' + first, { range: 4096 });
    notAPage(r, bytes);
    if (!starts(bytes, [0x89, 0x50, 0x4e, 0x47])) throw new Error('the sprite sheet came back as something else');
    return 'the sprite sheets download';
  } },
  { id: 'sound', name: 'Sound', need: false, async run() {
    const { r, bytes } = await get('/assets/snd_select.wav');
    notAPage(r, bytes);
    if (!starts(bytes, [0x52, 0x49, 0x46, 0x46])) throw new Error('the sound came back as something else');
    return 'the sound files download';
  } },
  { id: 'video', name: 'Video clips', need: false, async run() {
    const v = document.createElement('video');
    const mp4 = v.canPlayType && v.canPlayType('video/mp4; codecs="avc1.64001F"');
    const { r, bytes } = await get('/assets/games/previews/tetris.' + (mp4 ? 'mp4' : 'webm'), { range: 4096 });
    notAPage(r, bytes);
    const ok = mp4 ? text(bytes.subarray(4, 8)) === 'ftyp' : starts(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    if (!ok) throw new Error('the clip came back as something else');
    return 'the game clips download (the GAMES page shows drawn loops without them)';
  } },
  { id: 'storage', name: 'Saved settings', need: false, async run() {
    try { const k = '__drcheck'; localStorage.setItem(k, '1'); const v = localStorage.getItem(k); localStorage.removeItem(k); if (v !== '1') throw new Error('x'); }
    catch (e) { const w = new Error('this browser blocks site storage here: the simulator works, but settings and progress are forgotten when the tab closes'); w.warn = true; throw w; }
    return 'settings and progress are kept';
  } },
  { id: 'stats', name: 'Fight stats', need: false, async run() {
    const { r, bytes } = await get('/api/stats');
    notAPage(r, bytes);
    let j = null; try { j = JSON.parse(text(bytes)); } catch (e) { }
    if (!j || j.v !== 1) throw new Error('the stats came back as something else');
    return 'the public stats page works';
  } },
];
// the start page IS a web page; only a page that is not ours counts as blocked
function notAPageIfNotHome(home) { if (!/DELTARUNE Fight Simulator/.test(text(home.bytes))) throw new Error('the start page came back as someone else\'s page (a filter\'s block page?)'); }

async function runAll() {
  const btn = $('again'); btn.disabled = true;
  const list = $('checks'); list.textContent = '';
  const rows = CHECKS.map((c) => {
    const li = el('li', '', list);
    el('span', 'mark', li, '..').setAttribute('aria-hidden', 'true');
    el('span', 'name', li, c.name);
    const st = el('span', 'state', li, 'CHECKING');
    const why = el('span', 'why', li, c.need ? 'needed to play' : 'nice to have');
    return { c, li, st, why };
  });
  $('verdict').textContent = ''; el('p', '', $('verdict'), 'Checking...');
  const res = await Promise.all(rows.map(async (row) => {
    let out;
    try { out = { ok: true, why: await row.c.run() }; }
    catch (e) { out = { ok: false, warn: !!(e && e.warn), why: (e && e.message) || 'failed' }; }
    row.li.className = out.ok ? 'ok' : out.warn || !row.c.need ? 'warn' : 'bad';
    row.li.querySelector('.mark').textContent = out.ok ? 'OK' : '!';
    row.st.textContent = out.ok ? 'WORKS' : out.warn || !row.c.need ? 'LIMITED' : 'BLOCKED';
    row.why.textContent = out.why.charAt(0).toUpperCase() + out.why.slice(1) + '.';
    return { c: row.c, ...out };
  }));
  verdict(res);
  btn.disabled = false;
}

function verdict(res) {
  const v = $('verdict'); v.textContent = '';
  const blocked = res.filter((x) => !x.ok && x.c.need), extras = res.filter((x) => !x.ok && !x.c.need);
  if (!blocked.length && !extras.length) {
    const p = el('p', '', v); el('b', '', p, 'Everything works on this network.');
    el('p', '', v, 'If the simulator still does not start, reload it once; if that does not help, the Discord on the start page is the place to ask.');
    return;
  }
  if (!blocked.length) {
    const p = el('p', '', v); el('b', '', p, 'The simulator works on this network.');
    el('p', '', v, 'Limited here: ' + extras.map((x) => x.c.name.toLowerCase()).join(', ') + '. The fights themselves are not affected.');
    if (extras.some((x) => x.c.id !== 'storage')) ask(v);
    return;
  }
  const p = el('p', '', v); el('b', '', p, 'Something the simulator needs is blocked on this network: ' + blocked.map((x) => x.c.name.toLowerCase()).join(' and ') + '.');
  ask(v);
}
function ask(v) {
  const a = el('p', 'ask', v);
  a.appendChild(document.createTextNode('What to ask your school\'s or workplace\'s IT for: '));
  el('code', '', a, 'allow ' + DOMAIN);
  a.appendChild(document.createTextNode(' (this one domain is all the site uses).'));
  el('p', 'fine', v, 'What it is, if they ask: a free browser game - a fan-made battle simulator for the games DELTARUNE and UNDERTALE. No downloads, no accounts, no ads, no chat.');
}

$('again').addEventListener('click', runAll);
runAll();

// THE SIMULATOR'S VERSION (the newest entry of the update notes, assets/updates/updates.json): worth
// saying in a bug report. Not one of the checks; nothing happens if it does not load.
get('/assets/updates/updates.json').then(({ bytes }) => {
  const v = String(JSON.parse(text(bytes)).updates[0].version || ''); if (!/^\d+\.\d+\.\d+$/.test(v)) return;
  const p = el('p', 'fine', document.querySelector('main'), 'Simulator version v' + v + '. ');
  const a = el('a', '', p, 'Update notes'); a.href = '/updates';
}).catch(() => { });
