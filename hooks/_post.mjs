// Shared hook poster. Targets POL_SERVER (default localhost) with an optional
// POL_TOKEN, so the exact same hooks work locally or against a deployed server.
// Never blocks or fails a session: it always exits 0.
import http from 'node:http';
import https from 'node:https';

export function send(pathName, obj) {
  const base = process.env.POL_SERVER || 'http://127.0.0.1:4855';
  let u;
  try { u = new URL(pathName, base); } catch { return done(); }
  const body = JSON.stringify(obj);
  const lib = u.protocol === 'https:' ? https : http;
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
  if (process.env.POL_TOKEN) headers['x-pol-token'] = process.env.POL_TOKEN;
  const req = lib.request(
    { protocol: u.protocol, hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers },
    (res) => { res.on('data', () => {}); res.on('end', done); }
  );
  req.on('error', done);
  req.setTimeout(1500, () => { try { req.destroy(); } catch {} done(); });
  req.write(body);
  req.end();
}

export function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.on('data', (d) => (input += d));
    process.stdin.on('end', () => { try { resolve(JSON.parse(input || '{}')); } catch { resolve({}); } });
    process.stdin.on('error', () => resolve({}));
    setTimeout(() => resolve({}), 1200);
  });
}

export function done() { try { process.exit(0); } catch {} }
