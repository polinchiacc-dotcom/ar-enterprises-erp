// /api/v3 — same-origin proxy to ArV3Api Apps Script (server-side redirect follow; pure Node, no deps)
// usage: /api/v3?u=<encoded exec URL>&callback=cbXXX&k=...&action=...&params...
import https from 'node:https';

function get(fullUrl, redirects, cb) {
  https.get(fullUrl, function (res) {
    if (res.statusCode >= 301 && res.statusCode < 400 && res.headers.location && redirects < 6) {
      res.resume();
      return get(res.headers.location, redirects + 1, cb);
    }
    const chunks = [];
    res.on('data', function (c) { chunks.push(c); });
    res.on('end', function () { cb(null, Buffer.concat(chunks).toString('utf8')); });
  }).on('error', function (e) { cb(e); });
}

export default async function handler(req, res) {
  try {
    const u = String((req.query && req.query.u) || '');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) {
      res.status(400).send('bad target');
      return;
    }
    const t = new URL(u);
    Object.keys(req.query || {}).forEach(function (k) { if (k !== 'u') t.searchParams.set(k, req.query[k]); });
    get(t.toString(), 0, function (err, body) {
      if (err) {
        res.status(502).send('cbfetch({"ok":false,"error":"proxy: ' + String(err && err.message ? err.message : err).replace(/"/g, "'").slice(0, 120) + '"});');
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(200).send(body);
    });
  } catch (e) {
    res.status(502).send('cbfetch({"ok":false,"error":"proxy: ' + String((e && e.message) || e).replace(/"/g, "'").slice(0, 120) + '"});');
  }
}
