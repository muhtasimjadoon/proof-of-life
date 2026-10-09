// Proof of Life — server (multi-operator, host-ready)
// Zero dependencies. Runs the same locally and deployed. Each operator owns
// their own creatures; runs are routed by an operator token (or the local
// default operator when a request comes from localhost with no token).

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { computeCreature, detectDomain, SPECIES, operatorScore, levelFor, xpGain, hashString, mulberry32, breedCreature } = require('./engine');

const PORT = process.env.POL_PORT ? Number(process.env.POL_PORT) : 4855;
const MIN_HATCH_MS = 10 * 1000;
// an egg older than this never got its Stop hook (session ended / server was down)
// -> it is orphaned, so drop it instead of "growing" forever
const MAX_EGG_MS = 3 * 60 * 60 * 1000; // a sub-10s turn is too quick to hatch
const DATA_DIR = process.env.POL_DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ACCENTS = ['#67e39a', '#8fa2c9', '#65d6d6', '#7bd6ff', '#ffb959', '#e6a3b6', '#a48ff0', '#f2b545'];

// the local default operator (you). On a host, operators arrive via /api/register.
let config = {
  handle: ((process.env.USERNAME || 'operator').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'operator'),
  displayName: process.env.USERNAME || 'Operator',
};
function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) config = Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); } catch {}
}
function saveConfig() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2)); }
  catch (e) { console.error('[pol] config write failed:', e.message); }
}

// ---- signed attestations (proof of work life) ----------------------------
// Each creature is signed with Ed25519 the moment it hatches. The signature
// covers the run's real facts, so altering any of them (duration, rarity,
// owner) breaks it. Anyone with the public key can verify independently.
const KEY_FILE = path.join(DATA_DIR, 'attestor.json');
let keys = null;
function loadKeys() {
  try {
    if (fs.existsSync(KEY_FILE)) {
      const k = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      keys = { priv: crypto.createPrivateKey(k.privateKey), pub: crypto.createPublicKey(k.publicKey), pubPem: k.publicKey };
      return;
    }
  } catch (e) { console.error('[pol] key read failed, regenerating:', e.message); }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify({ publicKey: pubPem, privateKey: privPem }, null, 2));
  keys = { priv: privateKey, pub: publicKey, pubPem };
}
function pubFingerprint() { return crypto.createHash('sha256').update(keys.pubPem).digest('hex').slice(0, 16).toUpperCase(); }

// the exact facts a creature's rarity depends on — the canonical signed message
function creaturePayload(c) {
  const p = { op: c.op || null, id: c.id, dur: c.durationMs, dom: c.domainKey, err: !!c.error, tier: c.rarity.tier, seed: c.seed, born: c.bornAt };
  if (c.toolCalls != null) p.calls = c.toolCalls; // newer runs also sign how many tool calls the agent made
  return JSON.stringify(p);
}
function breedPayload(c) { return JSON.stringify({ breed: c.id, pair: c.bredBy, dom: c.domain, seed: c.seed, tier: c.rarity.tier, parents: c.parentFps || [] }); }
function sign(msg) { return crypto.sign(null, Buffer.from(msg), keys.priv).toString('base64'); }
function fpOf(sig) { return crypto.createHash('sha256').update(sig).digest('hex').slice(0, 8).toUpperCase(); }

function attest(c, opHandle) { c.op = opHandle; const sig = sign(creaturePayload(c)); c.att = { v: 1, alg: 'ed25519', sig, fp: fpOf(sig) }; return c; }
function attestBreed(c, a, b) { c.parentFps = [a.att && a.att.fp, b.att && b.att.fp]; const sig = sign(breedPayload(c)); c.att = { v: 1, alg: 'ed25519', sig, fp: fpOf(sig) }; return c; }
function verifyCreature(c) {
  if (!c || !c.att) return { valid: false, reason: 'no attestation' };
  const msg = c.bredBy ? breedPayload(c) : creaturePayload(c);
  try { return { valid: crypto.verify(null, Buffer.from(msg), keys.pub, Buffer.from(c.att.sig, 'base64')), fp: c.att.fp, alg: c.att.alg, signer: pubFingerprint() }; }
  catch (e) { return { valid: false, reason: e.message }; }
}
function ensureAttested() {
  let n = 0;
  for (const op of Object.values(state.operators)) for (const c of op.creatures) if (!c.att) { attest(c, op.handle); n++; }
  return n;
}
function findCreatureById(id) {
  for (const op of Object.values(state.operators)) { const c = op.creatures.find((x) => x.id === id); if (c) return c; }
  return (state.breeds && state.breeds[id]) || null;
}

// one-time migration: earlier creatures all defaulted to Wisp. Re-mint every
// wisp into one of the six real domains (deterministic per creature), keeping
// its id and progression, so the shelf becomes varied instead of all-purple.
function respreadDomains() {
  const pool = DOMAINS.filter((d) => d !== 'wisp');
  for (const op of Object.values(state.operators)) {
    for (let i = 0; i < op.creatures.length; i++) {
      const c = op.creatures[i];
      if (c.domainKey !== 'wisp') continue;
      const dom = pool[hashString('spread|' + c.id) % pool.length];
      const nc = computeCreature({ id: (c.id.split(':')[0] || c.id), startedAt: c.bornAt - (c.durationMs || 0), endedAt: c.bornAt, durationMs: c.durationMs, domainKey: dom, error: !!c.error, subagents: c.subagents || 0 });
      nc.id = c.id; nc.level = c.level; nc.xp = c.xp; nc.status = c.status; nc.hp = c.hp; nc.hpMax = c.hpMax;
      attest(nc, op.handle);
      op.creatures[i] = nc;
    }
  }
}

// sample operators, each with a REAL generated menagerie so the Board, the
// profiles, and cross-breeding all compute from genuine creature data (not
// hardcoded numbers). Clearly flagged sample until real operators join.
const SAMPLE_OPS = [
  { handle: 'dev_james', displayName: 'James', accent: '#8fa2c9', n: 42, bias: 'cog' },
  { handle: 'ops_wizard', displayName: 'Wizard', accent: '#65d6d6', n: 36, bias: 'scholar' },
  { handle: 'girl_ghost', displayName: 'Ghost', accent: '#7bd6ff', n: 26, bias: 'prism' },
  { handle: 'bug_slayer', displayName: 'Slayer', accent: '#f2b545', n: 21, bias: 'cog' },
  { handle: 'refactor_king', displayName: 'King', accent: '#67e39a', n: 16, bias: 'hydra' },
];
const DOMAINS = ['cog', 'scholar', 'moth', 'prism', 'lumen', 'hydra', 'wisp'];

function seedSampleOp(s) {
  const op = ensureOp(s.handle, s.displayName);
  op.sample = true; op.accent = s.accent;
  if (op.creatures.length) return;
  for (let i = 0; i < s.n; i++) {
    const rng = mulberry32(hashString(s.handle + '|' + i));
    const domain = rng() < 0.5 ? s.bias : DOMAINS[Math.floor(rng() * DOMAINS.length)];
    const dur = Math.floor((0.1 + rng() * rng() * rng() * 55) * 60000); // heavily skewed short, rare long
    const start = 1700000000000 + i * 5400000; // fixed epoch, deterministic (no Date.now)
    const err = rng() < 0.12;
    const c = computeCreature({ id: s.handle + '-s' + i, startedAt: start, endedAt: start + dur, durationMs: dur, domainKey: domain, error: err, subagents: rng() < 0.2 ? Math.floor(rng() * 8) : 0 });
    c.xp = (s.n - i) * 90;
    c.level = levelFor(c.xp);
    if (c.status === 'sick' && c.level >= 2) { c.status = 'healed'; c.hp = c.hpMax; if (!c.traits.includes('Survivor')) c.traits.push('Survivor'); }
    attest(c, s.handle);
    op.creatures.push(c);
  }
}

// ---- state: operators keyed by handle ------------------------------------
let state = { operators: {} };

function accentFor(handle) { return ACCENTS[hashString(handle) % ACCENTS.length]; }
function genToken() { return crypto.randomBytes(24).toString('base64url'); }

function ensureOp(handle, displayName) {
  handle = String(handle || config.handle).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'operator';
  if (!state.operators[handle]) {
    state.operators[handle] = { handle, displayName: displayName || handle, token: genToken(), accent: accentFor(handle), creatures: [], eggs: {}, createdAt: Date.now() };
  }
  return state.operators[handle];
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (raw.operators) state = raw;
      else if (Array.isArray(raw.creatures)) {
        // migrate the old single-operator shape into the default operator
        state = { operators: {} };
        const op = ensureOp(config.handle, config.displayName);
        op.creatures = raw.creatures || [];
        op.eggs = raw.eggs || {};
      }
    }
  } catch (e) { console.error('[pol] could not read state, starting fresh:', e.message); state = { operators: {} }; }
  state.operators = state.operators || {};
}

let saveTimer = null;
function saveState() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }
    catch (e) { console.error('[pol] could not write state:', e.message); }
  }, 120);
}

// resolve which operator a request acts on: token wins, else local default
function isLocal(req) {
  const a = (req.socket && req.socket.remoteAddress) || '';
  return a === '::1' || a === '127.0.0.1' || a === '::ffff:127.0.0.1';
}
function opByToken(token) { return token ? Object.values(state.operators).find((o) => o.token === token) : null; }
function resolveOp(req, body) {
  const token = req.headers['x-pol-token'] || (body && body.token);
  const byTok = opByToken(token);
  if (byTok) return byTok;
  if (isLocal(req)) return ensureOp((body && body.handle) || config.handle, config.displayName);
  return null;
}

// ---- run lifecycle -------------------------------------------------------
function pruneStaleEggs() {
  const now = Date.now(); let changed = false;
  for (const op of Object.values(state.operators)) {
    for (const id of Object.keys(op.eggs)) {
      if (now - (op.eggs[id].startedAt || 0) > MAX_EGG_MS) { delete op.eggs[id]; changed = true; }
    }
  }
  if (changed) saveState();
  return changed;
}
function findEgg(op, id) {
  if (id && op.eggs[id]) return op.eggs[id];
  return Object.values(op.eggs).sort((a, b) => a.startedAt - b.startedAt)[0] || null;
}
const DOMAIN_KEYS = SPECIES.map((sp) => sp.key);
function layEgg(op, { id, prompt, domain }) {
  const eggId = String(id || 'egg-' + Date.now()).slice(0, 80);
  // prompts are never stored: older hooks still send one, so classify it and drop it
  op.eggs[eggId] = { id: eggId, startedAt: Date.now(), domainKey: DOMAIN_KEYS.includes(domain) ? domain : detectDomain(prompt) };
  saveState();
  return op.eggs[eggId];
}
function tickSubagent(op, { id }) {
  const egg = findEgg(op, id);
  if (!egg) return null;
  egg.subagents = (egg.subagents || 0) + 1;
  saveState();
  return egg;
}
function raiseHerd(op, justCompleted) {
  const gain = xpGain(justCompleted);
  for (const c of op.creatures) {
    if (c.id === justCompleted.id) continue;
    c.xp = (c.xp || 0) + gain;
    c.level = levelFor(c.xp);
    if (c.status === 'sick' && c.level >= 2) { c.status = 'healed'; c.hp = c.hpMax; if (!c.traits.includes('Survivor')) c.traits.push('Survivor'); }
  }
}
// keep only the counts the engine reads, capped, so a client cannot bloat state
function cleanActivity(a) {
  if (!a || typeof a !== 'object') return null;
  const counts = (o) => { const r = {}; if (o && typeof o === 'object') for (const [k, v] of Object.entries(o).slice(0, 40)) { const n = Math.floor(Number(v)); if (n > 0) r[String(k).slice(0, 80)] = Math.min(n, 100000); } return r; };
  const toolCalls = Math.max(0, Math.min(100000, Math.floor(Number(a.toolCalls) || 0)));
  return { toolCalls, tools: counts(a.tools), exts: counts(a.exts), cmds: counts(a.cmds) };
}
function hatch(op, { id, error, subagents, activity }) {
  const egg = findEgg(op, id);
  const now = Date.now();
  const startedAt = egg ? egg.startedAt : now - 1000;
  if (now - startedAt < MIN_HATCH_MS) { if (egg) delete op.eggs[egg.id]; saveState(); return { skipped: true, reason: 'too quick to hatch' }; }
  const run = {
    id: (egg && egg.id) || id || 'run-' + now, startedAt, endedAt: now,
    domainKey: egg ? egg.domainKey : undefined, activity: cleanActivity(activity),
    error: !!error, subagents: subagents != null ? subagents : (egg ? egg.subagents || 0 : 0),
  };
  const creature = computeCreature(run);
  attest(creature, op.handle);
  op.creatures.push(creature);
  if (creature.status === 'healthy') raiseHerd(op, creature);
  if (egg) delete op.eggs[egg.id];
  computeBreeds(); // a new creature may unlock new cross-fed hybrids
  saveState();
  return creature;
}

// ---- derived views -------------------------------------------------------
function topSpecies(creatures) {
  const count = {};
  for (const c of creatures) count[c.speciesName] = (count[c.speciesName] || 0) + 1;
  return Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '—';
}
function statsOf(op) {
  const machineMs = op.creatures.reduce((a, c) => a + (c.durationMs || 0), 0);
  const rarest = op.creatures.reduce((best, c) => (c.rarity.index > (best ? best.rarity.index : -1) ? c : best), null);
  return {
    total: op.creatures.length,
    machineHours: +(machineMs / 3600000).toFixed(1),
    rarest: rarest ? { name: rarest.fullName, tier: rarest.rarity.tier } : null,
    sick: op.creatures.filter((c) => c.status === 'sick').length,
    eggs: Object.keys(op.eggs).length,
  };
}
function meOf(op) {
  const s = statsOf(op);
  return {
    handle: op.handle, displayName: op.displayName, accent: op.accent, sample: !!op.sample,
    score: operatorScore(op.creatures), runs: op.creatures.length, hours: s.machineHours,
    survivors: op.creatures.filter((c) => c.status === 'healed').length,
    scars: op.creatures.filter((c) => c.features && c.features.scar).length,
    topSpecies: topSpecies(op.creatures), rarest: s.rarest,
  };
}
function board() {
  const rows = Object.values(state.operators).filter((o) => o.creatures.length)
    .map((o) => Object.assign({ you: o.handle === config.handle }, meOf(o)))
    .sort((a, b) => b.score - a.score);
  return rows.map((r, i) => Object.assign({ rank: i + 1 }, r));
}
function profile(handle) {
  const op = state.operators[handle];
  if (op) return Object.assign({ you: handle === config.handle }, meOf(op), { creatures: op.creatures.slice().sort((a, b) => b.bornAt - a.bornAt) });
  return null;
}

// ---- cross-breeding across operators -------------------------------------
function domainsOf(op) { const s = {}; for (const c of op.creatures) s[c.domainKey] = true; return s; }
// a representative creature (deterministic per pair), not the rarest — so hybrids span tiers
function pickInDomain(op, d, salt) { const list = op.creatures.filter((c) => c.domainKey === d); return list[hashString(op.handle + '|' + d + '|' + salt) % list.length]; }
// the domain the two operators BOTH work most — their shared specialty
function sharedSpecialty(A, B, shared) {
  let best = null;
  for (const d of shared) { const sc = Math.min(A.creatures.filter((c) => c.domainKey === d).length, B.creatures.filter((c) => c.domainKey === d).length); if (!best || sc > best.sc) best = { d, sc }; }
  return best.d;
}
function topDomain(op) { const c = {}; for (const cr of op.creatures) c[cr.domainKey] = (c[cr.domainKey] || 0) + 1; return Object.keys(c).sort((a, b) => c[b] - c[a])[0]; }
function breedFor(A, B) {
  const da = domainsOf(A), db = domainsOf(B);
  const shared = Object.keys(da).filter((d) => db[d]);
  if (!shared.length) return null; // gate: their agents must have collided on a domain
  const salt = [A.handle, B.handle].sort().join('&');
  const domain = sharedSpecialty(A, B, shared); // where they collided
  // the hybrid fuses each operator's OWN signature species
  const a = pickInDomain(A, topDomain(A), salt), b = pickInDomain(B, topDomain(B), salt);
  const hyb = attestBreed(breedCreature(a, b, A.handle, B.handle, domain), a, b);
  return { hyb, domain, sharedCount: shared.length };
}

function computeBreeds() {
  const ops = Object.values(state.operators).filter((o) => o.creatures.length);
  const breeds = {};
  for (let i = 0; i < ops.length; i++) {
    for (let j = i + 1; j < ops.length; j++) {
      const r = breedFor(ops[i], ops[j]);
      if (r) breeds[r.hyb.id] = r.hyb;
    }
  }
  state.breeds = breeds;
  return breeds;
}

function bestiary() {
  const breeds = Object.values(state.breeds || {}).sort((a, b) => b.rarity.index - a.rarity.index);
  const opsWith = Object.values(state.operators).filter((o) => o.creatures.length);
  const species = new Set();
  for (const o of opsWith) for (const c of o.creatures) species.add(c.speciesName);
  for (const b of breeds) species.add(b.speciesName);
  const duos = breeds.map((b) => ({ pair: b.bredBy, species: b.fullName, tier: b.rarity.tier, chip: b.rarity.chip, domain: b.domain }))
    .sort((a, b) => 0); // order already rarity-desc
  return {
    network: { operators: opsWith.length, species: species.size, breeds: breeds.length },
    breeds,
    duos: duos.slice(0, 6),
    operators: opsWith.map((o) => ({ handle: o.handle, accent: o.accent, sample: !!o.sample })),
  };
}

function breedPair(ha, hb) {
  const A = state.operators[ha], B = state.operators[hb];
  if (!A || !B || A === B || !A.creatures.length || !B.creatures.length) return { none: true, reason: 'need two operators with creatures' };
  const r = breedFor(A, B);
  if (!r) return { none: true, reason: 'no shared work yet — these two have never run the same domain' };
  return { creature: r.hyb, domain: r.domain, sharedCount: r.sharedCount };
}

// ---- demo seed -----------------------------------------------------------
function seedDemo() {
  const now = Date.now();
  const op = ensureOp(config.handle, config.displayName);
  const runs = [
    { id: 'demo1', startedAt: now - 15000, endedAt: now - 3000, prompt: 'fix the build and deploy the api', error: false },
    { id: 'demo2', startedAt: now - 9 * 60000, endedAt: now, prompt: 'research competitors and analyze the market', subagents: 6, error: false },
    { id: 'demo3', startedAt: now - 40 * 60000, endedAt: now, prompt: 'design the brand carousel and figma layout', subagents: 2, error: false },
    { id: 'demo4', startedAt: now - 4000, endedAt: now, prompt: 'write the launch email and post copy', error: true },
    { id: 'demo5', startedAt: now - 25 * 60000, endedAt: now, prompt: 'render the remotion video and export frames', subagents: 3, error: false },
  ];
  for (const r of runs) { r.durationMs = r.endedAt - r.startedAt; op.creatures.push(computeCreature(r)); }
  saveState();
}

// ---- http ----------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
function serveStatic(req, res) {
  let rel = req.url.split('?')[0];
  if (rel === '/') rel = '/index.html';
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}
function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (d) => { b += d; if (b.length > 64 * 1024) { req.destroy(); resolve({}); } }); req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } }); });
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') return json(res, 200, { ok: true, operators: Object.keys(state.operators).length });

  // onboarding for a new operator on a hosted server -> returns their token
  if (req.method === 'POST' && url === '/api/register') {
    const body = await readBody(req);
    if (!body.handle) return json(res, 400, { error: 'handle required' });
    const h = String(body.handle).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    if (!h) return json(res, 400, { error: 'handle must use letters, numbers or _' });
    // an existing handle is never handed out again: that would leak its token
    if (state.operators[h]) return json(res, 409, { error: 'handle taken' });
    const op = ensureOp(h, body.displayName);
    saveState();
    return json(res, 200, { ok: true, handle: op.handle, token: op.token });
  }

  if (url === '/api/state') {
    pruneStaleEggs();
    const op = resolveOp(req, null) || ensureOp(config.handle, config.displayName);
    return json(res, 200, {
      eggs: Object.values(op.eggs),
      creatures: op.creatures.slice().sort((a, b) => b.bornAt - a.bornAt),
      stats: statsOf(op), me: meOf(op),
    });
  }
  if (url === '/api/me' && req.method === 'GET') return json(res, 200, meOf(resolveOp(req, null) || ensureOp(config.handle)));
  if (url === '/api/me' && req.method === 'POST') {
    if (!isLocal(req)) return json(res, 403, { error: 'local only' });
    const body = await readBody(req);
    // local rename of the default operator identity
    if (body.handle) {
      const newH = String(body.handle).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
      if (newH && newH !== config.handle) {
        const old = state.operators[config.handle];
        if (old) { delete state.operators[config.handle]; old.handle = newH; state.operators[newH] = old; }
        config.handle = newH;
      }
    }
    if (body.displayName) { config.displayName = String(body.displayName).slice(0, 40); const op = ensureOp(config.handle); op.displayName = config.displayName; }
    saveConfig(); saveState();
    return json(res, 200, { ok: true, me: meOf(ensureOp(config.handle)) });
  }
  if (url === '/api/board') return json(res, 200, { board: board() });
  if (url === '/api/pubkey') return json(res, 200, { alg: 'ed25519', publicKey: keys.pubPem, fingerprint: pubFingerprint(), signed: Object.values(state.operators).reduce((a, o) => a + o.creatures.length, 0) + Object.keys(state.breeds || {}).length });
  if (url.startsWith('/api/verify')) { const id = new URLSearchParams(req.url.split('?')[1] || '').get('id'); return json(res, 200, verifyCreature(findCreatureById(id))); }
  if (url === '/api/bestiary') return json(res, 200, bestiary());
  if (url.startsWith('/api/breed')) {
    const q = new URLSearchParams(req.url.split('?')[1] || '');
    return json(res, 200, breedPair(q.get('a'), q.get('b')));
  }
  if (url.startsWith('/api/profile')) {
    const handle = new URLSearchParams(req.url.split('?')[1] || '').get('handle') || config.handle;
    const p = profile(handle);
    return p ? json(res, 200, p) : json(res, 404, { error: 'no such operator' });
  }

  if (req.method === 'POST' && url === '/api/run-start') {
    const body = await readBody(req); const op = resolveOp(req, body);
    if (!op) return json(res, 401, { error: 'unknown operator' });
    return json(res, 200, { ok: true, egg: layEgg(op, body) });
  }
  if (req.method === 'POST' && url === '/api/run-subagent') {
    const body = await readBody(req); const op = resolveOp(req, body);
    if (!op) return json(res, 401, { error: 'unknown operator' });
    return json(res, 200, { ok: true, egg: tickSubagent(op, body) });
  }
  if (req.method === 'POST' && url === '/api/run-end') {
    const body = await readBody(req); const op = resolveOp(req, body);
    if (!op) return json(res, 401, { error: 'unknown operator' });
    return json(res, 200, { ok: true, creature: hatch(op, body) });
  }

  if (url.startsWith('/api/dev/') && !isLocal(req)) return json(res, 403, { error: 'local only' });
  if (req.method === 'POST' && url === '/api/dev/seed') { seedDemo(); return json(res, 200, { ok: true }); }
  if (req.method === 'POST' && url === '/api/dev/reset') { state = { operators: {} }; saveState(); return json(res, 200, { ok: true }); }

  return serveStatic(req, res);
});

loadState();
loadConfig();
loadKeys();
ensureOp(config.handle, config.displayName);
if (process.argv.includes('--seed-demo') && !state.operators[config.handle].creatures.length) seedDemo();
// sample operators are opt-in, so a fresh install shows only real data
if (process.argv.includes('--samples') || process.env.POL_SAMPLES === '1') SAMPLE_OPS.forEach(seedSampleOp);
ensureAttested(); // sign any creature not yet attested (migration + demo)
if (!state.respread) { respreadDomains(); state.respread = true; } // fix the wall of wisps, once
for (const op of Object.values(state.operators)) for (const e of Object.values(op.eggs || {})) delete e.prompt; // older versions kept prompts
pruneStaleEggs(); // clear any orphaned eggs left by sessions that never sent a Stop
computeBreeds();
saveState();

server.listen(PORT, () => {
  console.log(`[pol] Proof of Life live at http://localhost:${PORT}`);
  console.log(`[pol] operators: ${Object.keys(state.operators).length}, you: @${config.handle}`);
});
