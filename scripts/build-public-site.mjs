// Build a public, read-only copy of your Proof of Life page as plain static
// files (for GitHub Pages or any static host), from your running local server.
//
//   node scripts/build-public-site.mjs [--out <dir>] [--server http://127.0.0.1:4855]
//
// What goes public: your creatures, skills, stats and the signer's public key.
// What does not: prompts, paths and file names never exist in the data; on top of
// that, MCP tool names are reduced to their family (mcp__outreach, mcp__design, ...)
// so the page never shows which servers or accounts you use. Eggs in progress and
// "done" notices are dropped. The build stops if a known private string survives.
//
// Signatures still check in the visitor's browser (WebCrypto Ed25519): each
// creature carries the hash of its raw activity counts (actHash), which is what
// the signed message covers, so the counts can be summarised without breaking it.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { toolLabel } from '../hooks/_activity.mjs';

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.resolve(flag('--out', path.join(ROOT, '..', 'proof-of-life-site')));
const SERVER = flag('--server', 'http://127.0.0.1:4855');
const TZ = new Date().getTimezoneOffset();

function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
const actHash = (a) => crypto.createHash('sha256').update(stableStringify(a)).digest('hex').slice(0, 16);
const get = async (p) => { const r = await fetch(SERVER + p); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };

function publicActivity(a) {
  if (!a) return a;
  const tools = {};
  for (const [k, v] of Object.entries(a.tools || {})) { const f = toolLabel(k, true); tools[f] = (tools[f] || 0) + v; }
  return Object.assign({}, a, { tools });
}
function publicCreature(c) {
  const out = Object.assign({}, c);
  if (c.activity) { out.actHash = actHash(c.activity); out.activity = publicActivity(c.activity); }
  return out;
}

const [state, board, bestiary, pubkey, version, profile] = await Promise.all([
  get('/api/state?tz=' + TZ), get('/api/board'), get('/api/bestiary'), get('/api/pubkey'), get('/api/version'), null,
]);
state.eggs = []; state.done = [];
state.creatures = state.creatures.map(publicCreature);
const me = state.me && state.me.handle;
const prof = me ? await get('/api/profile?handle=' + encodeURIComponent(me)) : null;
if (prof && Array.isArray(prof.creatures)) prof.creatures = prof.creatures.map(publicCreature);
version.telemetry = { enabled: false, decided: true, canSet: false, reason: 'public copy', endpointSet: false };
version.stale = false; version.disk = version.build;
const snapshot = { builtAt: new Date().toISOString(), handle: me, creatures: state.creatures.length };

// nothing private may leave: fail loudly instead of publishing it
const files = { 'state.json': state, 'board.json': board, 'bestiary.json': bestiary, 'pubkey.json': pubkey, 'version.json': version, 'profile.json': prof, 'snapshot.json': snapshot };
const PRIVATE = /mcp__(?!outreach|design|video|database|browser|search|other)[a-z0-9_-]+|aimfox|zoho|calcom|posthog|whatsapp|omni-computer|windows-mcp|[A-Z]:\\\\|\/Users\/|"token"/i;
for (const [name, data] of Object.entries(files)) {
  const m = PRIVATE.exec(JSON.stringify(data));
  if (m) { console.error(`refusing to publish: ${name} still contains "${m[0]}"`); process.exit(1); }
}

fs.rmSync(path.join(OUT, 'api'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(OUT, 'api', name), JSON.stringify(data));

// the page itself, with root-relative paths made relative (a project page lives under /<repo>/)
const PUB = path.join(ROOT, 'public');
const copyTree = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name), b = path.join(to, f.name);
    if (f.isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b);
  }
};
copyTree(PUB, OUT);
fs.copyFileSync(path.join(ROOT, 'skills.js'), path.join(OUT, 'skills.js'));
const rel = (s) => s.replace(/(["'`(])\/(style\.css|variants\.js|app\.js|skills\.js|creatures\/)/g, '$1$2');
for (const f of ['app.js', 'variants.js', 'style.css']) fs.writeFileSync(path.join(OUT, f), rel(fs.readFileSync(path.join(OUT, f), 'utf8')));
// visitors are not the owner: name whose shelf this is
const owner = (state.me && state.me.displayName) || me;
const ownerOf = owner.split(' ')[0] + (/s$/i.test(owner.split(' ')[0]) ? '’' : '’s'); // a typographic apostrophe: app.js strings are single-quoted
fs.writeFileSync(path.join(OUT, 'app.js'), fs.readFileSync(path.join(OUT, 'app.js'), 'utf8').replace(/Meet your creatures/g, `Meet ${ownerOf} creatures`).replace(/Your creatures/g, `${ownerOf} creatures`));
fs.appendFileSync(path.join(OUT, 'style.css'), '\n/* public copy banner */\n.pub-banner { display: block; }\n.pub-banner a { color: #ffd27a; font-weight: 600; text-decoration: underline; }\n');
const when = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
let html = rel(fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'));
html = html.replace('<title>Proof of Life</title>', `<title>Proof of Life · @${me}</title>\n  <meta name="description" content="${state.creatures.length} signed records of real Claude Code runs by @${me}. A CV of AI work." />`)
  .replace('<script src="variants.js"></script>', '<script src="static.js"></script>\n  <script src="variants.js"></script>')
  .replace('<div id="banner" class="srv-banner" role="status" hidden></div>',
    `<div class="srv-banner pub-banner" role="status">Public copy of <b>@${me}</b>'s record · ${state.creatures.length} runs · updated ${when} · every signature checks in your browser · <a href="https://github.com/muhtasimjadoon/proof-of-life">Get your own</a></div>\n      <div id="banner" class="srv-banner" role="status" hidden></div>`);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.copyFileSync(path.join(ROOT, 'scripts', 'static-shim.js'), path.join(OUT, 'static.js'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
console.log(`public site: ${OUT}  (${state.creatures.length} creatures, built ${snapshot.builtAt})`);
