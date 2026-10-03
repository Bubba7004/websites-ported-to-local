import './fun.js';   // the easter eggs (the dog by the footer logo, the coaster cars)
// /home's live numbers: the all-time and last-24-hours totals from /api/stats (the same response the
// /stats page reads). Each number's <li> stays hidden until it has a value, so the page reads fine
// without this script, offline, or when the stats are off.
const box = document.querySelector('[data-live]');
if (box) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
  fetch('/api/stats', { credentials: 'same-origin', signal: ctl.signal })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const all = j && j.v === 1 && j.periods && j.periods.all, day = j && j.periods && j.periods['24h'];
      if (!all) return;
      const fmt = (n) => (typeof n === 'number' && isFinite(n) ? Math.round(n).toLocaleString('en-US') : null);
      const vals = { fights: fmt(all.fights), wins: fmt(all.playerWins), nohit: fmt(all.noHitWins), day: day ? fmt(day.fights) : null };
      for (const li of box.querySelectorAll('[data-stat]')) {
        const v = vals[li.getAttribute('data-stat')];
        if (v === null || v === undefined) continue;
        li.querySelector('b').textContent = v;
        li.hidden = false;
      }
    })
    .catch(() => {})
    .finally(() => clearTimeout(t));
}
