// UPDATE NOTES page (/updates). The same view the simulator's UPDATES page shows (view.js), on a page of
// its own that can be shared: /updates#v0.9.4 opens that update. It reads updates.json, the game's two
// text fonts and the text box parts the /stats page uses. One module, no inline script, nothing sent.
import { mount } from './view.js';

const A = '/assets/', S = '/assets/stats/', U = '/assets/updates/';
const load = (src) => new Promise((ok, no) => {
  const i = new Image(), t = setTimeout(() => no(new Error('timeout')), 20000);
  i.onload = () => { clearTimeout(t); ok(i); }; i.onerror = (e) => { clearTimeout(t); no(e); }; i.src = src;
});
const json = (url) => fetch(url, { credentials: 'same-origin', cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
const wanted = () => { const m = /^#v?(\d+\.\d+\.\d+)$/.exec(location.hash || ''); return m ? m[1] : null; };

async function boot() {
  const root = document.getElementById('upd');
  let data, F = {};
  try {
    const [tab, d] = await Promise.all([json(S + 'fonts.json'), json(U + 'updates.json')]);
    data = d;
    await Promise.all(['fnt_main', 'fnt_mainbig'].map(async (n) => { try { F[n] = { ...tab[n], img: await load(A + n + '.png') }; } catch (e) { } }));
  } catch (e) {
    root.textContent = '';
    const p = document.createElement('p'); p.className = 'plain';
    p.append('The update notes did not load. Reload the page to try again. ');
    const a = document.createElement('a'); a.href = '/'; a.textContent = 'Back to the simulator'; p.append(a);
    root.appendChild(p);
    return;
  }
  let box = null;
  try { const [corner, top, left] = await Promise.all(['box_corner', 'box_top', 'box_left'].map((n) => load(S + n + '.png'))); box = { corner, top, left }; } catch (e) { }
  let ctrl = null, own = false;
  const make = () => {
    if (ctrl) ctrl.destroy();
    ctrl = mount(root, data, {
      F, box, spriteURL: (n, f) => U + 'spr/' + n + '_' + f + '.png',
      home: 'page', seen: '', start: wanted(),
      touch: !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches),
      onOpen: (v) => { own = true; history.replaceState(null, '', v ? '#v' + v : location.pathname); setTimeout(() => { own = false; }, 0); scrollTo(0, 0); },
    });
  };
  make();
  addEventListener('keydown', (e) => { if (ctrl && ctrl.key(e)) e.preventDefault(); });
  // a link to another update on this page (or the browser's back button over a hash)
  addEventListener('hashchange', () => { if (!own) make(); });
}
boot();
