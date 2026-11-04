// /api/v3 — same-origin proxy to ArV3Api Apps Script (avoids browser→Google CORS/cookie/redirect issues)
// usage: /api/v3?u=<encoded exec URL>&callback=cbXXX&k=...&action=...&params...
module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const u = String(q.u || '');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) {
      res.status(400).send('bad target');
      return;
    }
    const t = new URL(u);
    Object.keys(q).forEach(function (k) { if (k !== 'u') t.searchParams.set(k, q[k]); });
    const r = await fetch(t, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const body = await r.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(body);
  } catch (e) {
    res.status(502).send('cbfetch({"ok":false,"error":"proxy: ' + String((e && e.message) || e).replace(/"/g, "'").slice(0, 120) + '"});');
  }
};
