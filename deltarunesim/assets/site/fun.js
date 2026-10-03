// The launch pages' easter eggs (/home, /download): game characters that react when clicked, with the
// game's own sound. Nothing plays until a click; a click on a car of the coaster train makes it hop.
// Same-origin and module-only (the pages' CSP allows no inline script).
const cache = new Map();
function play(name) {
  try {
    let a = cache.get(name);
    if (!a) { a = new Audio('/assets/' + name); a.preload = 'auto'; a.volume = 0.6; cache.set(name, a); }
    a.currentTime = 0; a.play().catch(() => {});
  } catch (e) { /* no audio: the animation still plays */ }
}
function poke(el) {
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('go'), Number(el.dataset.cut) || 2400);
  // data-snd may list several sounds (a|b|c, all at once); data-cut stops the first one after that many ms
  if (el.dataset.snd) {
    const names = el.dataset.snd.split('|');
    names.forEach(play);
    const cut = Number(el.dataset.cut);
    if (cut > 0) { clearTimeout(el._cut); el._cut = setTimeout(() => { const a = cache.get(names[0]); if (a) { a.pause(); a.currentTime = 0; } }, cut); }
  }
  // the coaster cars and the dog hop on top of their own animation (`translate` stacks with the ride's
  // `transform`, so the car keeps its place in the train)
  if ((el.closest('.ride') || el.classList.contains('dog')) && el.animate) {
    const up = el.classList.contains('dog') ? '-18px' : '-36px';
    el.animate([{ translate: '0 0' }, { translate: '0 ' + up, offset: 0.4 }, { translate: '0 0' }], { duration: el.classList.contains('dog') ? 1500 : 500, easing: 'ease-out', iterations: 1 });
  }
}
document.addEventListener('click', (e) => {
  const tv = e.target.closest && e.target.closest('[data-tvtime]');
  if (tv) { tvTime(tv); return; }
  const el = e.target.closest && e.target.closest('[data-snd]');
  if (el) poke(el);
});

// TENNA'S "IT'S TV TIME!" as chapter 3 plays it (gml_Object_obj_intro_tv_time): snd_its_tv_time plays and
// the logo's frame follows the sound - frame = 164 x (time played / length) - then the two-frame
// spr_dw_tv_time_intro_loop at image_speed 0.1 (3 frames a second) until it fades.
let tvSheet = null, tvMeta = null, tvRun = 0;
async function tvTime(btn) {
  const box = btn.nextElementSibling; const cv = box && box.querySelector('canvas'); if (!cv) return;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
  if (!tvMeta) {
    try { tvMeta = await (await fetch('/assets/site/launch/tvtime-intro.json')).json(); } catch (e) { return; }
    tvSheet = new Image(); tvSheet.src = '/assets/site/launch/tvtime-intro.webp';
    await tvSheet.decode().catch(() => {});
  }
  const M = tvMeta, run = ++tvRun;
  btn.classList.remove('go'); void btn.offsetWidth; btn.classList.add('go');
  box.classList.remove('on', 'out'); void box.offsetWidth; box.classList.add('on');
  const a = new Audio('/assets/site/launch/its-tv-time.ogg'); a.volume = 0.7;
  const frame = (i) => { g.clearRect(0, 0, M.w, M.h); g.drawImage(tvSheet, (i % M.cols) * M.w, Math.floor(i / M.cols) * M.h, M.w, M.h, 0, 0, M.w, M.h); };
  let loopFrom = 0;
  const tick = (t) => {
    if (run !== tvRun) return;
    const d = a.duration || 5.53, p = a.ended ? 1 : Math.min(1, a.currentTime / d);
    if (p < 1) frame(Math.min(M.intro - 1, Math.floor(M.intro * p)));
    else {
      if (!loopFrom) loopFrom = t;
      const k = t - loopFrom;
      frame(M.intro + (Math.floor(k / 333) % M.loop));
      if (k > 2000 && !box.classList.contains('out')) box.classList.add('out');
      if (k > 2600) { box.classList.remove('on', 'out'); btn.classList.remove('go'); return; }
    }
    requestAnimationFrame(tick);
  };
  a.play().catch(() => {}); frame(0); requestAnimationFrame(tick);
}
