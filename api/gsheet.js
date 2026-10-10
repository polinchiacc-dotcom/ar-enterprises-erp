// GSheet gviz same-origin proxy — browser never touches docs.google.com directly.
// Workbook id whitelist (ERP workbook only). Other /api/* still rewrite to the gateway.
const ALLOWED = ['1Qwdkod9Q8nANXPfz-2Ah6ZVQp0DAsIfaygBT57Tw1jw'];

module.exports = async function (req, res) {
  try {
    const id = String((req.query && req.query.id) || '');
    if (ALLOWED.indexOf(id) < 0) { res.status(400).send('bad id'); return; }
    const gid = String((req.query && req.query.gid) || '').replace(/[^0-9]/g, '');
    const sh = String((req.query && req.query.sheet) || '').replace(/[^A-Za-z0-9_.\- ]/g, '');
    const tq = String((req.query && req.query.tq) || '').slice(0, 500);
    let u = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:json&headers=0';
    if (gid) u += '&gid=' + gid;
    else if (sh) u += '&sheet=' + encodeURIComponent(sh);
    if (tq) u += '&tq=' + encodeURIComponent(tq);
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const t = await r.text();
    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(t);
  } catch (e) {
    res.status(502).send('proxy error');
  }
};
