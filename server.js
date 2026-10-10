// Proof of Life — server (multi-operator, host-ready)
// Zero dependencies. Runs the same locally and deployed. Each operator owns
// their own creatures; runs are routed by an operator token (or the local
// default operator when a request comes from localhost with no token).

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const {
  computeCreature, detectDomain, SPECIES, RARITY, operatorScore, weekScore, levelFor, xpGain, hashString, mulberry32, breedCreature,
  durationLabel, isOpenSession, HERD_WINDOW, Skills, MYTHIC_RUN_MS, MYTHIC_SUBAGENTS, MYTHIC_STREAK, MARATHON_MS,
} = require('./engine');
const Variants = require('./public/variants.js');
const Telemetry = require('./telemetry.js');

// ---- build identity ------------------------------------------------------
// The page is read from disk on every request, so after an update the browser
// can run newer code than this process. /api/version lets the page notice and
// ask for a restart instead of quietly showing empty panels.
const API_LEVEL = 2; // bump when the page needs something new from the API
const CODE_FILES = ['server.js', 'engine.js', 'skills.js', 'public/variants.js', 'telemetry.js', 'paths.js'];
function codeHash() {
  const h = crypto.createHash('sha256');
  for (const f of CODE_FILES) { try { h.update(fs.readFileSync(path.join(__dirname, f))); } catch { h.update('missing:' + f); } }
  return h.digest('hex').slice(0, 12);
}
const BUILD = codeHash();
const BOOT = Date.now().toString(36); // ETags carry it, so a restart never answers 304 with an older body

const PORT = process.env.POL_PORT ? Number(process.env.POL_PORT) : 4855;
// privacy first: only this machine can reach the server unless you opt in
// (a hosted/Docker deploy sets POL_HOST=0.0.0.0)
const HOST = process.env.POL_HOST || '127.0.0.1';
// a sub-10s turn is too quick to hatch
const MIN_HATCH_MS = 10 * 1000;
// an egg not seen for this long never got its Stop hook (session closed, server
// was down): it is orphaned and dropped. Long, live runs stay well inside this.
const EGG_TTL_MS = 24 * 60 * 60 * 1000;
// a git clone keeps ./data; npm, npx and plugin copies use ~/.proof-of-life/data (paths.js)
const DATA_DIR = require('./paths.js').dataDir(__dirname);
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const ACCENTS = ['#67e39a', '#8fa2c9', '#65d6d6', '#7bd6ff', '#ffb959', '#e6a3b6', '#a48ff0', '#f2b545'];
// sample operators are opt-in: without the flag they stay hidden even if a
// previous run stored them
const SHOW_SAMPLES = process.argv.includes('--samples') || process.env.POL_SAMPLES === '1';
const HERD_VERSION = 3; // per-domain raising on the 60-level curve, see raiseHerd

// ---- safe file io --------------------------------------------------------
// write to a temp file then rename, so a crash mid-write can never leave a
// half-written state.json behind
function writeAtomic(file, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, file); return; }
    catch (e) {
      // Windows: a reader (antivirus, editor) can briefly lock the target
      if (i < 5 && (e.code === 'EPERM' || e.code === 'EBUSY' || e.code === 'EACCES')) { const t = Date.now() + 40; while (Date.now() < t) {} continue; }
      throw e;
    }
  }
}
// a file that exists but cannot be read is never silently replaced: keep a copy
// and stop, so a human can look at it
function refuseCorrupt(file, err) {
  const copy = file + '.unreadable-' + Date.now();
  try { fs.copyFileSync(file, copy); } catch {}
  console.error(`[pol] ${path.basename(file)} exists but could not be read (${err.message}).`);
  console.error(`[pol] Nothing was overwritten. A copy was saved to ${copy}. Fix or restore the file, then start again.`);
  process.exit(1);
}

// the local default operator (you). On a host, operators arrive via /api/register.
let config = {
  handle: ((process.env.USERNAME || process.env.USER || 'operator').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'operator'),
  displayName: process.env.USERNAME || process.env.USER || 'Operator',
};
let configReadable = true;
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return;
  try { config = Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
  catch (e) { configReadable = false; console.error('[pol] config.json unreadable, using defaults and leaving it untouched:', e.message); }
}
function saveConfig() {
  if (!configReadable) return console.error('[pol] config.json was unreadable at start; not overwriting it');
  try { writeAtomic(CONFIG_FILE, JSON.stringify(config, null, 2)); }
  catch (e) { console.error('[pol] config write failed:', e.message); }
}
// the daily goal: one you picked, or by default your own median day (so a
// 50-run day never sits against a target of 3, and the ring means something)
function goalOf(medianDay) {
  const g = config.goal;
  if (!g || g.type === 'auto') return { type: 'runs', target: Math.max(3, Math.min(100, Math.round(Number(medianDay) || 0) || 3)), auto: true };
  const type = g.type === 'minutes' ? 'minutes' : 'runs';
  const target = Math.max(1, Math.min(type === 'runs' ? 100 : 1440, Math.floor(Number(g.target) || (type === 'runs' ? 3 : 30))));
  return { type, target, auto: false };
}

// ---- signatures: a tamper-evident record --------------------------------
// Each creature is signed with Ed25519 the moment it hatches. The signature
// covers the run's recorded facts, so changing any of them later (duration,
// rarity, owner) shows. The key lives on this machine: it is the operator's own
// record, not an audit. Anyone with the public key can check a signature.
const KEY_FILE = path.join(DATA_DIR, 'attestor.json');
let keys = null;
function loadKeys() {
  if (fs.existsSync(KEY_FILE)) {
    try {
      const k = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
      keys = { priv: crypto.createPrivateKey(k.privateKey), pub: crypto.createPublicKey(k.publicKey), pubPem: k.publicKey };
      return;
    } catch (e) { refuseCorrupt(KEY_FILE, e); } // a new key would orphan every signature
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  writeAtomic(KEY_FILE, JSON.stringify({ publicKey: pubPem, privateKey: privPem }, null, 2));
  keys = { priv: privateKey, pub: publicKey, pubPem };
}
function pubFingerprint() { return crypto.createHash('sha256').update(keys.pubPem).digest('hex').slice(0, 16).toUpperCase(); }

// canonical JSON (sorted keys) so the activity hash is stable
function stableStringify(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}
function activityHash(a) { return crypto.createHash('sha256').update(stableStringify(a)).digest('hex').slice(0, 16); }

// the exact facts a creature's rarity depends on — the canonical signed message.
// Fields are only ever ADDED when present on newer creatures, so every older
// creature's message (and signature) stays byte-for-byte the same.
function creaturePayload(c) {
  const p = { op: c.op || null, id: c.id, dur: c.durationMs, dom: c.domainKey, err: !!c.error, tier: c.rarity.tier, seed: c.seed, born: c.bornAt };
  if (c.toolCalls != null) p.calls = c.toolCalls; // newer runs also sign how many tool calls the agent made
  if (c.activity) p.act = activityHash(c.activity); // and a hash of the activity counts skills are computed from
  if (c.ruleVersion != null) p.ruleVersion = c.ruleVersion; // rule 2 creatures (rarity from outcomes) say so in the signed message
  return JSON.stringify(p);
}
function breedPayload(c) { return JSON.stringify({ breed: c.id, pair: c.bredBy, dom: c.domain, seed: c.seed, tier: c.rarity.tier, parents: c.parentFps || [] }); }
function sign(msg) { return crypto.sign(null, Buffer.from(msg), keys.priv).toString('base64'); }
function fpOf(sig) { return crypto.createHash('sha256').update(sig).digest('hex').slice(0, 8).toUpperCase(); }

function attest(c, opHandle) { c.op = opHandle; const sig = sign(creaturePayload(c)); c.att = { v: 1, alg: 'ed25519', sig, fp: fpOf(sig) }; return c; }
function attestBreed(c, a, b) { c.parentFps = [a.att && a.att.fp, b.att && b.att.fp]; const sig = sign(breedPayload(c)); c.att = { v: 1, alg: 'ed25519', sig, fp: fpOf(sig) }; return c; }
function verifyCreature(c) {
  if (!c || !c.att) return { valid: false, reason: c ? 'no attestation' : 'not found' };
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
  if (!id) return null;
  for (const op of Object.values(state.operators)) { const c = op.creatures.find((x) => x.id === id); if (c) return c; }
  return (state.breeds && Object.prototype.hasOwnProperty.call(state.breeds, id) && state.breeds[id]) || null;
}

// one-time migration: earlier creatures all defaulted to Wisp. Re-mint every
// wisp into one of the six real domains (deterministic per creature), keeping
// its id and progression. The new domain is a hash, not a fact, so it is marked
// domainSource='respread' and skills count it as general work.
function respreadDomains() {
  const pool = DOMAINS.filter((d) => d !== 'wisp');
  for (const op of Object.values(state.operators)) {
    for (let i = 0; i < op.creatures.length; i++) {
      const c = op.creatures[i];
      if (c.domainKey !== 'wisp') continue;
      const dom = pool[hashString('spread|' + c.id) % pool.length];
      const nc = computeCreature({ id: (c.id.split(':')[0] || c.id), startedAt: c.bornAt - (c.durationMs || 0), endedAt: c.bornAt, durationMs: c.durationMs, domainKey: dom, error: !!c.error, subagents: c.subagents || 0 });
      nc.id = c.id; nc.level = c.level; nc.xp = c.xp; nc.status = c.status; nc.hp = c.hp; nc.hpMax = c.hpMax;
      nc.domainSource = 'respread';
      nc.skillXp = Skills.computeSkillXp(nc);
      attest(nc, op.handle);
      op.creatures[i] = nc;
    }
  }
}

// sample operators, each with a REAL generated menagerie so the Board, the
// profiles, and cross-breeding all compute from genuine creature data (not
// hardcoded numbers). Opt-in with --samples, and always flagged sample.
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
    const c = computeCreature({ id: s.handle + '-s' + i, startedAt: start, endedAt: start + dur, durationMs: dur, domainKey: domain, error: err, subagents: rng() < 0.2 ? Math.floor(rng() * 8) : 0, tzOffset: 0 });
    attest(c, s.handle);
    op.creatures.push(c);
  }
  replayHerd(op);
}

// ---- state: operators keyed by handle ------------------------------------
let state = { operators: {} };
let rev = 1; // bumps on every change; drives ETags and the skills memo

function accentFor(handle) { return ACCENTS[hashString(handle) % ACCENTS.length]; }
function genToken() { return crypto.randomBytes(24).toString('base64url'); }
function cleanHandle(h) { return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24); }
const RESERVED = new Set(['__proto__', 'constructor', 'prototype', 'hasownproperty', 'tostring', 'valueof']);

function ensureOp(handle, displayName) {
  handle = cleanHandle(handle || config.handle) || 'operator';
  if (RESERVED.has(handle)) handle = 'operator';
  if (!Object.prototype.hasOwnProperty.call(state.operators, handle)) {
    state.operators[handle] = { handle, displayName: String(displayName || handle).slice(0, 40), token: genToken(), accent: accentFor(handle), creatures: [], eggs: {}, createdAt: Date.now() };
  }
  const op = state.operators[handle];
  if (!op.eggs || typeof op.eggs !== 'object') op.eggs = {};
  return op;
}
function visibleOps() { return Object.values(state.operators).filter((o) => SHOW_SAMPLES || !o.sample); }

function loadState() {
  if (!fs.existsSync(STATE_FILE)) { state = { operators: {} }; return; }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch (e) { refuseCorrupt(STATE_FILE, e); }
  if (raw && raw.operators) state = raw;
  else if (raw && Array.isArray(raw.creatures)) {
    // migrate the old single-operator shape into the default operator
    state = { operators: {} };
    const op = ensureOp(config.handle, config.displayName);
    op.creatures = raw.creatures || [];
    op.eggs = raw.eggs || {};
  } else refuseCorrupt(STATE_FILE, new Error('no operators in file'));
  state.operators = state.operators || {};
}

let saveTimer = null;
function saveState() {
  rev++;
  if (saveTimer) return;
  saveTimer = setTimeout(flushState, 120);
}
function flushState() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  try { writeAtomic(STATE_FILE, JSON.stringify(state, null, 2)); }
  catch (e) { console.error('[pol] could not write state:', e.message); }
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
  if (isLocal(req)) return ensureOp(config.handle, config.displayName);
  return null;
}

// ---- run lifecycle -------------------------------------------------------
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// run ids come from Claude Code session ids (uuids). Anything else is reduced
// to a safe charset so it can never carry markup into the page.
function cleanRunId(id) {
  if (id == null || typeof id === 'object') return '';
  const s = String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return RESERVED.has(s.toLowerCase()) ? '' : s;
}
function pruneStaleEggs() {
  const now = Date.now(); let changed = false;
  for (const op of Object.values(state.operators)) {
    for (const id of Object.keys(op.eggs)) {
      const e = op.eggs[id];
      if (now - (e.lastSeen || e.startedAt || 0) > EGG_TTL_MS) { delete op.eggs[id]; changed = true; }
    }
  }
  if (changed) saveState();
  return changed;
}
// an egg is matched by its exact run id, never by "whichever is oldest":
// one session's Stop must never hatch or destroy another session's egg
function findEgg(op, id) {
  if (id) return hasOwn(op.eggs, id) ? op.eggs[id] : null;
  // an old hook with no session id: only its own anonymous eggs qualify
  const anon = Object.values(op.eggs).filter((e) => /^egg-\d+$/.test(e.id)).sort((a, b) => b.startedAt - a.startedAt);
  return anon[0] || null;
}
const DOMAIN_KEYS = SPECIES.map((sp) => sp.key);
function cleanTz(v) { const n = Number(v); return v != null && v !== '' && isFinite(n) && Math.abs(n) <= 840 ? Math.round(n) : null; }
function layEgg(op, { id, prompt, domain, tzOffset }) {
  const now = Date.now();
  const eggId = cleanRunId(id) || 'egg-' + now;
  // a new prompt in the same session replaces an egg whose Stop never came
  // (an interrupted turn), so its clock starts now
  // prompts are never stored: older hooks still send one, so classify it and drop it
  op.eggs[eggId] = { id: eggId, startedAt: now, lastSeen: now, domainKey: DOMAIN_KEYS.includes(domain) ? domain : detectDomain(prompt) };
  const tz = cleanTz(tzOffset); if (tz != null) op.eggs[eggId].tzOffset = tz;
  clearDone(op, eggId);
  saveState();
  return op.eggs[eggId];
}
// ---- live status: working / needs your input / done ----------------------
// Notification hook: the session is waiting on you (a permission prompt or a
// question). Only a kind from this list is kept, never the message text.
// Cleared by the next prompt (a fresh egg), a subagent finishing (work moved on)
// or the Stop that hatches it.
const WAIT_KINDS = ['permission', 'question', 'input'];
function notifyEgg(op, { id, kind }) {
  const egg = findEgg(op, cleanRunId(id));
  if (!egg) return null; // idle notices after a run ended have no egg: nothing to show
  const k = WAIT_KINDS.includes(kind) ? kind : 'input';
  if (egg.waiting === k) { egg.lastSeen = Date.now(); return egg; }
  egg.waiting = k; egg.waitingAt = Date.now(); egg.lastSeen = egg.waitingAt;
  saveState();
  return egg;
}
// runs that just ended, kept in memory only (never signed, never on disk), so the
// egg card can say "done" for a short while after the Stop
const DONE_KEEP_MS = 10 * 60 * 1000;
const recentDone = new Map(); // handle -> [{ id, endedAt, domainKey, creatureId, skipped }]
function markDone(op, entry) {
  const now = Date.now();
  const list = (recentDone.get(op.handle) || []).filter((d) => d.id !== entry.id && now - d.endedAt < DONE_KEEP_MS);
  list.unshift(Object.assign({ endedAt: now }, entry));
  recentDone.set(op.handle, list.slice(0, 6));
}
function clearDone(op, id) {
  const list = recentDone.get(op.handle);
  if (list) recentDone.set(op.handle, list.filter((d) => d.id !== id));
}
function doneOf(op) { const now = Date.now(); return (recentDone.get(op.handle) || []).filter((d) => now - d.endedAt < DONE_KEEP_MS); }
function mergeCounts(a, b) {
  if (!a) return b; if (!b) return a;
  const m = (x, y) => { const r = Object.assign({}, x || {}); for (const [k, v] of Object.entries(y || {})) r[k] = (r[k] || 0) + v; return r; };
  const out = { toolCalls: (a.toolCalls || 0) + (b.toolCalls || 0), tools: m(a.tools, b.tools), exts: m(a.exts, b.exts), cmds: m(a.cmds, b.cmds) };
  if (a.toolErrors != null || b.toolErrors != null) out.toolErrors = (a.toolErrors || 0) + (b.toolErrors || 0);
  if (a.git || b.git) out.git = m(a.git, b.git);
  return out;
}
function tickSubagent(op, { id, activity }) {
  const rid = cleanRunId(id);
  const egg = findEgg(op, rid);
  if (!egg) return null;
  egg.subagents = (egg.subagents || 0) + 1;
  egg.lastSeen = Date.now();
  delete egg.waiting; delete egg.waitingAt; // work moved on, so the wait is over
  // subagents' own tool calls live in their own transcripts; count them too
  const sub = cleanActivity(activity);
  if (sub && sub.toolCalls) egg.subActivity = cleanActivity(mergeCounts(egg.subActivity, sub));
  saveState();
  return egg;
}
// a healthy run raises its most recent siblings of the same kind of work (engine.HERD_WINDOW)
function raiseOne(c, gain) {
  c.xp = (c.xp || 0) + gain;
  c.level = levelFor(c.xp);
  if (c.status === 'sick' && c.level >= 2) { c.status = 'healed'; c.hp = c.hpMax; if (!c.traits.includes('Survivor')) c.traits.push('Survivor'); }
}
function raiseHerd(op, justCompleted) {
  const gain = xpGain(justCompleted);
  const sibs = op.creatures.filter((c) => c.id !== justCompleted.id && c.domainKey === justCompleted.domainKey && c.bornAt <= justCompleted.bornAt)
    .sort((a, b) => a.bornAt - b.bornAt).slice(-HERD_WINDOW);
  for (const c of sibs) raiseOne(c, gain);
}
// recompute every creature's level from history under the current rule.
// level, xp and status are derived (unsigned) fields, so signatures are untouched.
function replayHerd(op) {
  const list = op.creatures.slice().sort((a, b) => a.bornAt - b.bornAt);
  const byDom = {};
  for (const c of list) {
    c.xp = 0; c.level = 1;
    // only a real failed run is sick; the seeded 'Restless' temperament is not
    if (c.error) { c.status = 'sick'; c.hp = 38; c.traits = c.traits.filter((t) => t !== 'Survivor'); if (!c.palette.overlay) c.palette.overlay = '#6f8f5a'; }
    else if (c.status !== 'healthy') { c.status = 'healthy'; c.hp = c.hpMax || 100; c.traits = c.traits.filter((t) => t !== 'Survivor'); delete c.palette.overlay; }
  }
  for (const c of list) {
    const sibs = byDom[c.domainKey] || (byDom[c.domainKey] = []);
    if (!c.error) { const gain = xpGain(c); for (const s of sibs.slice(-HERD_WINDOW)) raiseOne(s, gain); }
    sibs.push(c);
  }
}
// derived, unsigned caches: refresh when the formulas change
function refreshDerived() {
  let n = 0;
  for (const op of Object.values(state.operators)) {
    for (const c of op.creatures) {
      const dl = durationLabel(c.durationMs || 0);
      if (c.durationLabel !== dl) { c.durationLabel = dl; n++; }
      if (c.sxv !== Skills.SXV || !c.skillXp) { c.skillXp = Skills.computeSkillXp(c); c.sxv = Skills.SXV; n++; }
    }
  }
  if (state.herdV !== HERD_VERSION) { for (const op of Object.values(state.operators)) replayHerd(op); state.herdV = HERD_VERSION; n++; }
  return n;
}

// only counts, from known vocabularies, capped, so a client cannot bloat state
// or smuggle names: unknown extensions and commands become 'other'
function cleanActivity(a) {
  if (!a || typeof a !== 'object') return null;
  const counts = (o, norm) => {
    const r = {};
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      for (const [k0, v] of Object.entries(o).slice(0, 60)) {
        const n = Math.floor(Number(v)); if (!(n > 0)) continue;
        const k = norm(String(k0)); if (!k || RESERVED.has(k.toLowerCase())) continue;
        r[k] = Math.min((r[k] || 0) + n, 100000);
      }
    }
    return r;
  };
  const tool = (k) => k.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
  const ext = (k) => { k = k.toLowerCase(); return Skills.KNOWN_EXTS.has(k) ? k : 'other'; };
  const cmd = (k) => { k = k.toLowerCase(); return Skills.KNOWN_CMDS.has(k) ? k : 'other'; };
  const toolCalls = Math.max(0, Math.min(100000, Math.floor(Number(a.toolCalls) || 0)));
  const out = { toolCalls, tools: counts(a.tools, tool), exts: counts(a.exts, ext), cmds: counts(a.cmds, cmd) };
  // newer hooks also count failed tool results (a number, never the error text)
  if (a.toolErrors != null && isFinite(Number(a.toolErrors))) out.toolErrors = Math.max(0, Math.min(toolCalls, Math.floor(Number(a.toolErrors) || 0)));
  // and how many git commits and pushes ran (only these two keys, only when any ran)
  if (a.git && typeof a.git === 'object') {
    const g = {};
    for (const k of ['commit', 'push']) { const n = Math.floor(Number(a.git[k])); if (n > 0) g[k] = Math.min(n, 1000); }
    if (Object.keys(g).length) out.git = g;
  }
  return out;
}
// days in a row this operator has run agents, counting today, and whether a run
// now would be today's first: the Devoted path to Mythic
function streakInfo(op, now, tz) {
  const t = tz == null ? undefined : tz;
  const days = new Set(op.creatures.map((c) => Skills.dayIndex(Skills.dayKey(c.bornAt, t))));
  const today = Skills.dayIndex(Skills.dayKey(now, t));
  let n = 1;
  for (let d = today - 1; days.has(d); d--) n++;
  return { streakDays: n, firstOfDay: !days.has(today) };
}
function hatch(op, { id, error, subagents, activity, tzOffset }) {
  const rid = cleanRunId(id);
  const egg = findEgg(op, rid);
  const now = Date.now();
  if (!egg) return { skipped: true, reason: 'no open egg for this run' };
  const startedAt = egg.startedAt;
  if (now - startedAt < MIN_HATCH_MS) { delete op.eggs[egg.id]; markDone(op, { id: egg.id, domainKey: egg.domainKey, creatureId: null, skipped: true }); saveState(); return { skipped: true, reason: 'too quick to hatch' }; }
  let act = cleanActivity(activity);
  if (egg.subActivity) act = cleanActivity(mergeCounts(act || { toolCalls: 0 }, egg.subActivity));
  const tz = cleanTz(tzOffset) != null ? cleanTz(tzOffset) : (egg.tzOffset != null ? egg.tzOffset : null);
  const run = {
    id: egg.id, startedAt, endedAt: now,
    domainKey: egg.domainKey, domainSource: 'prompt', activity: act,
    error: !!error, subagents: subagents != null ? Math.max(0, Math.min(1000, Math.floor(Number(subagents) || 0))) : (egg.subagents || 0),
    tzOffset: tz, ruleVersion: 2, // live hatches use rule 2: rarity from outcomes
    allowMythic: true, ...streakInfo(op, now, tz),
  };
  const creature = computeCreature(run);
  attest(creature, op.handle);
  op.creatures.push(creature);
  if (creature.status === 'healthy') raiseHerd(op, creature);
  delete op.eggs[egg.id];
  markDone(op, { id: egg.id, domainKey: egg.domainKey, creatureId: creature.id, skipped: false });
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
  // machine hours leave out sessions left open for over a day (not real work);
  // they are reported separately so nothing is hidden
  let machineMs = 0, openMs = 0, openCount = 0;
  for (const c of op.creatures) { if (isOpenSession(c)) { openMs += c.durationMs; openCount++; } else machineMs += c.durationMs || 0; }
  // one 'rarest' ranking for every page (variants.js): tier, then Shiny, then Holo / Gold Chrome, then the longer run
  // a session left open keeps its signed tier, but it never counts as your rarest run
  const rarest = op.creatures.reduce((best, c) => (c.bredBy || isOpenSession(c) ? best : !best || Variants.rarer(c, best) < 0 ? c : best), null);
  return {
    total: op.creatures.length,
    machineHours: Math.round(machineMs / 360000) / 10,
    openSessions: { count: openCount, hours: Math.round(openMs / 360000) / 10 },
    rarest: rarest ? { id: rarest.id, name: rarest.fullName, tier: rarest.rarity.tier, shiny: Variants.variantOf(rarest).shiny, edition: Variants.variantOf(rarest).name } : null,
    sick: op.creatures.filter((c) => c.status === 'sick').length,
    eggs: Object.keys(op.eggs).length,
  };
}
function meOf(op) {
  const s = statsOf(op), now = Date.now();
  return {
    handle: op.handle, displayName: op.displayName, accent: op.accent, sample: !!op.sample,
    // score: all-time Power (uncapped); week: the same points from the last 7 days
    score: operatorScore(op.creatures), week: weekScore(op.creatures, now),
    weekRuns: op.creatures.filter((c) => c.bornAt >= now - 7 * 86400000).length,
    runs: op.creatures.length, hours: s.machineHours,
    survivors: op.creatures.filter((c) => c.status === 'healed').length,
    scars: op.creatures.filter((c) => c.features && c.features.scar).length,
    topSpecies: topSpecies(op.creatures), rarest: s.rarest,
  };
}
function board() {
  // ranked by this week's points (a race anyone can win this week), then all-time Power
  const rows = visibleOps().filter((o) => o.creatures.length)
    .map((o) => Object.assign({ you: o.handle === config.handle }, meOf(o)))
    .sort((a, b) => b.week - a.week || b.score - a.score);
  return rows.map((r, i) => Object.assign({ rank: i + 1 }, r));
}
function profile(handle) {
  const op = hasOwn(state.operators, handle) ? state.operators[handle] : null;
  if (op && (SHOW_SAMPLES || !op.sample)) return Object.assign({ you: handle === config.handle }, meOf(op), { creatures: op.creatures.slice().sort((a, b) => b.bornAt - a.bornAt) });
  return null;
}

// ---- skills (computed here once; the page only renders) -------------------
const skillsMemo = new Map();
function skillsOf(op, tz) {
  const now = Date.now();
  const key = op.handle + '|' + op.creatures.length + '|' + (op.creatures.length ? op.creatures[op.creatures.length - 1].id : '') + '|' + tz + '|' + Skills.dayKey(now, tz == null ? undefined : tz) + '|' + rev;
  const hit = skillsMemo.get(op.handle);
  if (hit && hit.key === key) return hit.value;
  const r = Skills.computeOperatorSkills(op.creatures, { tz: tz == null ? undefined : tz, now });
  const goal = goalOf(r.engagement.medianDay);
  const progress = goal.type === 'runs' ? r.engagement.today.runs : r.engagement.today.minutes;
  r.engagement.goal = { type: goal.type, target: goal.target, auto: goal.auto, median: r.engagement.medianDay, progress, met: progress >= goal.target };
  skillsMemo.set(op.handle, { key, value: r });
  return r;
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
  const ops = visibleOps().filter((o) => o.creatures.length);
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
  const opsWith = visibleOps().filter((o) => o.creatures.length);
  const species = new Set();
  for (const o of opsWith) for (const c of o.creatures) species.add(c.speciesName);
  for (const b of breeds) species.add(b.speciesName);
  const duos = breeds.map((b) => ({ pair: b.bredBy, species: b.fullName, tier: b.rarity.tier, chip: b.rarity.chip, domain: b.domain })); // already rarity-desc
  return {
    network: { operators: opsWith.length, species: species.size, breeds: breeds.length, samples: SHOW_SAMPLES ? opsWith.filter((o) => o.sample).length : 0 },
    breeds,
    duos: duos.slice(0, 6),
    operators: opsWith.map((o) => ({ handle: o.handle, accent: o.accent, sample: !!o.sample, you: o.handle === config.handle })),
  };
}

function breedPair(ha, hb) {
  const A = hasOwn(state.operators, ha) ? state.operators[ha] : null, B = hasOwn(state.operators, hb) ? state.operators[hb] : null;
  if (!A || !B || A === B || !A.creatures.length || !B.creatures.length || (!SHOW_SAMPLES && (A.sample || B.sample))) return { none: true, reason: 'need two operators with creatures' };
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
    { id: 'demo4', startedAt: now - 14000, endedAt: now, prompt: 'write the launch email and post copy', error: true },
    { id: 'demo5', startedAt: now - 25 * 60000, endedAt: now, prompt: 'render the remotion video and export frames', subagents: 3, error: false },
  ];
  for (const r of runs) { r.durationMs = r.endedAt - r.startedAt; const c = computeCreature(r); attest(c, op.handle); op.creatures.push(c); }
  replayHerd(op);
  computeBreeds();
  saveState();
}

// ---- http ----------------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  });
}
function serveStatic(req, res) {
  let rel = req.url.split('?')[0];
  try { rel = decodeURIComponent(rel); } catch { res.writeHead(400); return res.end('bad path'); }
  if (rel === '/') rel = '/index.html';
  // the skills math is shared with the browser
  if (rel === '/skills.js') return serveFile(res, path.join(__dirname, 'skills.js'));
  const file = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('no'); }
  serveFile(res, file);
}
// resolves to the parsed object, {} for an empty body, or null when the body is
// not a JSON object (the caller answers 400 instead of acting on garbage)
function readBody(req) {
  return new Promise((resolve) => {
    let b = '', done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    req.on('data', (d) => { b += d; if (b.length > 64 * 1024) { req.destroy(); fin(null); } });
    req.on('end', () => { try { const v = b ? JSON.parse(b) : {}; fin(v && typeof v === 'object' && !Array.isArray(v) ? v : null); } catch { fin(null); } });
    req.on('error', () => fin(null));
  });
}

// ---- request guards ------------------------------------------------------
// Bound to loopback, the API only answers to a loopback Host header, so a web
// page that rebinds its own domain to 127.0.0.1 can neither read nor write.
const LOOPBACK_NAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const LOOPBACK_BIND = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1';
function hostOk(req) {
  if (!LOOPBACK_BIND) return true; // a shared or hosted server answers to its own name; tokens guard it
  const h = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  return LOOPBACK_NAMES.has(h);
}
// A request that changes state must come from this page or from a hook. Browsers
// send Origin on every POST; the hooks send none. Requiring a JSON content type
// also means another site would need a CORS preflight, which this server never grants.
function writeOk(req) {
  const o = req.headers.origin;
  if (o != null) {
    let host = null;
    try { host = new URL(o).host.toLowerCase(); } catch {}
    if (!host || host !== String(req.headers.host || '').toLowerCase()) return { code: 403, error: 'cross-origin request refused' };
  }
  if (String(req.headers['sec-fetch-site'] || '') === 'cross-site') return { code: 403, error: 'cross-site request refused' };
  if (!/^application\/json\s*(;|$)/i.test(String(req.headers['content-type'] || ''))) return { code: 415, error: 'send JSON with Content-Type: application/json' };
  return null;
}
function send(req, res, code, body, headers) {
  const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' }, headers || {});
  if (body.length > 2048 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = zlib.gzipSync(body, { level: 6 }); h['Content-Encoding'] = 'gzip'; h['Vary'] = 'Accept-Encoding';
  }
  res.writeHead(code, h); res.end(body);
}
function json(res, code, obj) { send(res._req, res, code, JSON.stringify(obj)); }
// conditional GET: build the body only when something changed since the
// client's copy (polling an unchanged page costs a few bytes, not ~700KB)
function cached(req, res, tag, build) {
  const etag = 'W/"' + tag + '"';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); return res.end(); }
  send(req, res, 200, JSON.stringify(build()), { ETag: etag });
}

// a tiny per-ip limiter for the open registration endpoint
const regHits = new Map();
function rateLimited(req, max, windowMs) {
  const ip = (req.socket && req.socket.remoteAddress) || '?', now = Date.now();
  const arr = (regHits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now); regHits.set(ip, arr);
  return arr.length > max;
}
const MAX_OPERATORS = Number(process.env.POL_MAX_OPERATORS) || 1000;

// the real thresholds the page needs to say what a running egg will become
const RULES = {
  rarity: RARITY.map((r) => ({ tier: r.tier, maxMs: isFinite(r.maxMs) ? r.maxMs : null })), // rule 1, older creatures
  rarityRule: 2, outcome: Skills.OUTCOME, marathonMs: MARATHON_MS, // rule 2: new creatures
  mythic: { runMs: MYTHIC_RUN_MS, subagents: MYTHIC_SUBAGENTS, streak: MYTHIC_STREAK },
  minHatchMs: MIN_HATCH_MS, openSessionMs: Skills.OPEN_SESSION_MS,
};
function stateView(op, tz) {
  const sk = skillsOf(op, tz);
  const { engagement, ...skills } = sk;
  return {
    rev, api: API_LEVEL, build: BUILD, sxv: Skills.SXV, rules: RULES,
    eggs: Object.values(op.eggs).map((e) => ({ id: e.id, startedAt: e.startedAt, domainKey: e.domainKey, subagents: e.subagents || 0, status: e.waiting ? 'input' : 'working', waiting: e.waiting || null, waitingAt: e.waitingAt || null })),
    done: doneOf(op),
    creatures: op.creatures.slice().sort((a, b) => b.bornAt - a.bornAt),
    stats: statsOf(op), me: meOf(op),
    skills, engagement,
  };
}

const server = http.createServer(async (req, res) => {
  res._req = req;
  const url = req.url.split('?')[0];
  const q = new URLSearchParams(req.url.split('?')[1] || '');
  const tz = cleanTz(q.get('tz'));

  if (url === '/health') return json(res, 200, { ok: true, operators: Object.keys(state.operators).length });
  if (url.startsWith('/api/') && !hostOk(req)) return json(res, 403, { error: 'unexpected Host header' });
  if (req.method === 'POST') { const bad = writeOk(req); if (bad) return json(res, bad.code, { error: bad.error }); }
  if (url === '/api/version') { const disk = codeHash(); return json(res, 200, { api: API_LEVEL, build: BUILD, disk, stale: disk !== BUILD, pid: process.pid, sxv: Skills.SXV, maxLevel: Skills.MAX_LEVEL, skills: Skills.SKILLS.length, telemetry: Telemetry.status(DATA_DIR) }); }

  // onboarding for a new operator on a hosted server -> returns their token
  if (req.method === 'POST' && url === '/api/register') {
    if (rateLimited(req, 5, 60 * 60 * 1000)) return json(res, 429, { error: 'too many registrations, try later' });
    if (Object.keys(state.operators).length >= MAX_OPERATORS) return json(res, 503, { error: 'operator limit reached' });
    const body = await readBody(req);
    if (!body) return json(res, 400, { error: 'body must be a JSON object' });
    if (!body.handle || typeof body.handle !== 'string') return json(res, 400, { error: 'handle required' });
    const h = cleanHandle(body.handle);
    if (!h || RESERVED.has(h)) return json(res, 400, { error: 'handle must use letters, numbers or _' });
    // an existing handle is never handed out again: that would leak its token
    if (hasOwn(state.operators, h)) return json(res, 409, { error: 'handle taken' });
    const op = ensureOp(h, typeof body.displayName === 'string' ? body.displayName : h);
    saveState();
    return json(res, 200, { ok: true, handle: op.handle, token: op.token });
  }

  // your own data: a token, or a request from this machine
  if (url === '/api/state' || url === '/api/skills' || (url === '/api/me' && req.method === 'GET')) {
    const op = resolveOp(req, null);
    if (!op) return json(res, 401, { error: 'token required' });
    const day = Skills.dayKey(Date.now(), tz == null ? undefined : tz);
    if (url === '/api/state') return cached(req, res, `s${rev}-${BOOT}-${op.handle}-${tz}-${day}`, () => stateView(op, tz));
    if (url === '/api/skills') return cached(req, res, `k${rev}-${BOOT}-${op.handle}-${tz}-${day}`, () => { const { engagement, ...skills } = skillsOf(op, tz); return { skills, engagement }; });
    return json(res, 200, meOf(op));
  }
  if (url === '/api/me' && req.method === 'POST') {
    if (!isLocal(req)) return json(res, 403, { error: 'local only' });
    const body = await readBody(req);
    if (!body) return json(res, 400, { error: 'body must be a JSON object' });
    // local rename of the default operator identity
    if (body.handle != null) {
      const newH = cleanHandle(body.handle);
      if (!newH || RESERVED.has(newH)) return json(res, 400, { error: 'handle must use letters, numbers or _' });
      if (newH !== config.handle) {
        if (hasOwn(state.operators, newH)) return json(res, 409, { error: 'handle taken' });
        const old = hasOwn(state.operators, config.handle) ? state.operators[config.handle] : null;
        if (old) { delete state.operators[config.handle]; old.handle = newH; state.operators[newH] = old; }
        config.handle = newH;
        computeBreeds(); // hybrids carry the handle
      }
    }
    if (typeof body.displayName === 'string' && body.displayName.trim()) { config.displayName = body.displayName.trim().slice(0, 40); const op = ensureOp(config.handle); op.displayName = config.displayName; }
    if (body.goal && typeof body.goal === 'object') {
      // 'auto' follows your median day; anything else is a goal you picked
      if (body.goal.type === 'auto') delete config.goal;
      else { config.goal = { type: body.goal.type === 'minutes' ? 'minutes' : 'runs', target: Number(body.goal.target) }; const g = goalOf(); config.goal = { type: g.type, target: g.target }; }
    }
    saveConfig(); saveState();
    const me = ensureOp(config.handle);
    return json(res, 200, { ok: true, me: meOf(me), goal: skillsOf(me, null).engagement.goal });
  }
  if (url === '/api/board') return cached(req, res, `b${rev}-${BOOT}-${Skills.dayKey(Date.now())}`, () => ({ board: board(), samples: SHOW_SAMPLES }));
  if (url === '/api/pubkey') return json(res, 200, { alg: 'ed25519', publicKey: keys.pubPem, fingerprint: pubFingerprint(), signed: Object.values(state.operators).reduce((a, o) => a + o.creatures.length, 0) + Object.keys(state.breeds || {}).length });
  if (url === '/api/verify') return json(res, 200, verifyCreature(findCreatureById(q.get('id'))));
  if (url === '/api/bestiary') return cached(req, res, `x${rev}-${BOOT}`, bestiary);
  if (url === '/api/breed') return json(res, 200, breedPair(q.get('a'), q.get('b')));
  if (url === '/api/profile') {
    if (!isLocal(req) && !opByToken(req.headers['x-pol-token'])) return json(res, 401, { error: 'token required' });
    const p = profile(cleanHandle(q.get('handle') || config.handle));
    return p ? json(res, 200, p) : json(res, 404, { error: 'no such operator' });
  }

  if (req.method === 'POST' && (url === '/api/run-start' || url === '/api/run-subagent' || url === '/api/run-notify' || url === '/api/run-end')) {
    const body = await readBody(req);
    if (!body) return json(res, 400, { error: 'body must be a JSON object' }); // never lay an anonymous egg for garbage
    const op = resolveOp(req, body);
    if (!op) return json(res, 401, { error: 'unknown operator' });
    if (url === '/api/run-start') return json(res, 200, { ok: true, egg: layEgg(op, body) });
    if (url === '/api/run-subagent') return json(res, 200, { ok: true, egg: tickSubagent(op, body) });
    if (url === '/api/run-notify') return json(res, 200, { ok: true, egg: notifyEgg(op, body) });
    const creature = hatch(op, body);
    if (creature && telemetry) telemetry.nudge();
    return json(res, 200, { ok: true, creature });
  }

  if (url.startsWith('/api/dev/') && !isLocal(req)) return json(res, 403, { error: 'local only' });
  if (req.method === 'POST' && url === '/api/dev/seed') { seedDemo(); return json(res, 200, { ok: true }); }
  if (req.method === 'POST' && url === '/api/dev/reset') {
    if (q.get('confirm') !== 'yes') return json(res, 400, { error: 'add ?confirm=yes: this deletes every creature' });
    state = { operators: {}, respread: true, herdV: HERD_VERSION }; ensureOp(config.handle, config.displayName); saveState(); return json(res, 200, { ok: true });
  }
  if (url.startsWith('/api/')) return json(res, 404, { error: 'no such endpoint' });

  return serveStatic(req, res);
});

loadConfig(); // first: migrating an old state file needs the configured handle
loadState();
loadKeys();
ensureOp(config.handle, config.displayName);
if (process.argv.includes('--seed-demo') && !state.operators[config.handle].creatures.length) seedDemo();
if (SHOW_SAMPLES) SAMPLE_OPS.forEach(seedSampleOp);
ensureAttested(); // sign any creature not yet attested (migration + demo)
if (!state.respread) { respreadDomains(); state.respread = true; } // fix the wall of wisps, once
for (const op of Object.values(state.operators)) {
  op.eggs = op.eggs && typeof op.eggs === 'object' ? op.eggs : {};
  for (const e of Object.values(op.eggs)) { delete e.prompt; if (!e.lastSeen) e.lastSeen = e.startedAt; } // older versions kept prompts
}
refreshDerived();
pruneStaleEggs(); // clear any orphaned eggs left by sessions that never sent a Stop
setInterval(pruneStaleEggs, 10 * 60 * 1000).unref();
computeBreeds();
saveState();
// flush pending writes on shutdown
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { if (saveTimer) flushState(); process.exit(0); });

// opt-in weekly counts-only heartbeat for the local operator (off unless you said yes; TELEMETRY.md)
const telemetry = Telemetry.start(DATA_DIR, () => { const o = hasOwn(state.operators, config.handle) ? state.operators[config.handle] : null; return o ? o.creatures : []; });

server.listen(PORT, HOST, () => {
  console.log(`[pol] Proof of Life live at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}${HOST === '127.0.0.1' ? ' (this machine only; set POL_HOST to share)' : ''}`);
  console.log(`[pol] operators: ${visibleOps().length}${SHOW_SAMPLES ? ' (incl. samples)' : ''}, you: @${config.handle} · build ${BUILD}`);
});
