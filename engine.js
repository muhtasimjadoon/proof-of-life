// Proof of Life — creature engine
// Turns a real agent run into a one-of-one creature, minted from what you
// actually did. Pure, deterministic: the same run always hatches the same
// creature (everything is derived from a seed built out of the run's signals).
// No dependencies. Shared by the server; the browser only draws what this emits.

'use strict';

const Skills = require('./skills.js');

// ---- deterministic randomness -------------------------------------------

function hashString(str) {
  // xfnv1a -> 32-bit seed
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- taxonomy ------------------------------------------------------------

// Species map to the kinds of work you actually run. Each carries a palette
// and a body archetype the renderer knows how to draw.
const SPECIES = [
  { key: 'cog',     name: 'Cog',     archetype: 'round',  keys: ['code', 'build', 'fix', 'bug', 'deploy', 'refactor', 'server', 'api', 'test', 'compile', 'install', 'npm', 'node', 'docker'],
    palette: { body: '#7d8aa5', belly: '#aeb9d0', accent: '#f2b545', eye: '#12151d', glow: '#8fa2c9' } },
  { key: 'scholar', name: 'Scholar', archetype: 'tall',   keys: ['research', 'search', 'find', 'analyz', 'analyse', 'read', 'study', 'audit', 'review', 'compare', 'investigat'],
    palette: { body: '#3f9c9c', belly: '#bfeaea', accent: '#efe6c8', eye: '#0e1a1a', glow: '#65d6d6' } },
  { key: 'moth',    name: 'Moth',    archetype: 'winged', keys: ['write', 'post', 'content', 'email', 'copy', 'caption', 'blog', 'draft', 'script', 'newsletter'],
    palette: { body: '#c98598', belly: '#f3dfe4', accent: '#efe0c4', eye: '#2a1620', glow: '#e6a3b6' } },
  { key: 'prism',   name: 'Prism',   archetype: 'facet',  keys: ['design', 'figma', 'brand', 'ui', 'logo', 'layout', 'carousel', 'mockup', 'visual', 'poster'],
    palette: { body: '#63c7f0', belly: '#dff4ff', accent: '#ffffff', eye: '#0b2230', glow: '#7bd6ff' } },
  { key: 'lumen',   name: 'Lumen',   archetype: 'blob',   keys: ['video', 'render', 'remotion', 'ffmpeg', 'clip', 'reel', 'animation', 'motion', 'frame'],
    palette: { body: '#e59a3d', belly: '#ffd99a', accent: '#fff2d0', eye: '#2b1608', glow: '#ffb959' } },
  { key: 'hydra',   name: 'Hydra',   archetype: 'round',  keys: ['outreach', 'linkedin', 'lead', 'agency', 'crm', 'prospect', 'dm', 'connect', 'pipeline', 'sales'],
    palette: { body: '#4bbf7a', belly: '#c8f0d8', accent: '#eafff1', eye: '#0d2417', glow: '#67e39a' } },
  { key: 'wisp',    name: 'Wisp',    archetype: 'blob',   keys: [],
    palette: { body: '#8f7bd6', belly: '#d9cff5', accent: '#efe8ff', eye: '#1a1330', glow: '#a48ff0' } },
];

const RARITY = [
  { tier: 'Common',    chip: '#8b8f9a', maxMs: 20 * 1000 },
  { tier: 'Uncommon',  chip: '#57c26b', maxMs: 90 * 1000 },
  { tier: 'Rare',      chip: '#4f9df0', maxMs: 5 * 60 * 1000 },
  { tier: 'Epic',      chip: '#a970ff', maxMs: 20 * 60 * 1000 },
  { tier: 'Legendary', chip: '#f5b93b', maxMs: Infinity },
];

// Names are stored on each creature when it hatches (and are not part of the
// signed message), so widening these pools only changes creatures hatched from
// now on: 46 heads x 42 tails, and about 1 in 3 gets a middle syllable, so a
// collection of thousands rarely repeats a name.
const NAME_HEAD = ['Bri', 'Quo', 'Nix', 'Zub', 'Mel', 'Fen', 'Tup', 'Vor', 'Wob', 'Squ', 'Grum', 'Pil', 'Dax', 'Yel', 'Muk', 'Ozz',
  'Bix', 'Cram', 'Dob', 'Flin', 'Gax', 'Hob', 'Jib', 'Kip', 'Lum', 'Mox', 'Nub', 'Pog', 'Rook', 'Sni', 'Tiv', 'Ulo',
  'Vex', 'Wib', 'Yop', 'Zat', 'Blu', 'Clo', 'Dri', 'Fiz', 'Glim', 'Huz', 'Ib', 'Jot', 'Krel', 'Plo'];
const NAME_MID = ['a', 'o', 'u', 'el', 'ar', 'im', 'op', 'ub', 'en', 'ag', 'oo', 'az', 'eb', 'ot'];
const NAME_TAIL = ['bble', 'xel', 'tik', 'mo', 'zul', 'nub', 'rix', 'wop', 'dle', 'zzt', 'gg', 'lisk', 'per', 'quat', 'omph',
  'bit', 'dorf', 'fizz', 'gle', 'kin', 'lo', 'mop', 'nik', 'pip', 'rog', 'sy', 'tch', 'vin', 'wick', 'zle',
  'bo', 'chi', 'dut', 'fle', 'grub', 'ka', 'let', 'mash', 'nox', 'puff', 'rum', 'tor'];

// ---- classification ------------------------------------------------------

// keywords match at the start of a word ('analyz' -> 'analyzing'); short ones
// (<= 3 letters: 'ui', 'dm', 'api') must be the whole word, so 'admin' is not
// outreach, 'guide' is not design and 'already' is not research.
const KEY_RE = new Map();
function keyRe(k) {
  let re = KEY_RE.get(k);
  if (!re) { re = k.length <= 3 ? new RegExp('(^|[^a-z0-9])' + k + '($|[^a-z0-9])') : new RegExp('(^|[^a-z0-9])' + k); KEY_RE.set(k, re); }
  return re;
}
function detectDomain(text) {
  const t = String(text || '').toLowerCase();
  let best = null, bestHits = 0;
  for (const sp of SPECIES) {
    let hits = 0;
    for (const k of sp.keys) if (keyRe(k).test(t)) hits++;
    if (hits > bestHits) { bestHits = hits; best = sp.key; }
  }
  // no keyword matched: it is general work (Wisp), never a random guess
  return best || 'wisp';
}

// What the agent actually did beats what you asked it. activity is the
// summary the Stop hook reads from the transcript: { toolCalls, tools, exts, cmds }.
// Returns null when the run used no tools, so the prompt guess stands.
const CODE_EXT = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.c', '.cc', '.cpp', '.h', '.cs', '.swift', '.sh', '.ps1', '.sql', '.json', '.yml', '.yaml', '.toml', '.css', '.scss', '.html', '.vue', '.svelte'];
const TEXT_EXT = ['.md', '.mdx', '.txt', '.docx', '.rtf'];
const DESIGN_EXT = ['.fig', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.psd', '.ai', '.sketch'];
const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.gif', '.mp3', '.wav'];
const CODE_CMDS = ['npm', 'npx', 'node', 'git', 'python', 'python3', 'pip', 'cargo', 'go', 'make', 'docker', 'tsc', 'pnpm', 'yarn', 'bun', 'pytest', 'jest', 'dotnet', 'mvn', 'gradle', 'pkg-test'];
const VIDEO_CMDS = ['ffmpeg', 'ffprobe', 'remotion', 'higgs'];

function domainFromActivity(activity) {
  if (!activity || !activity.toolCalls) return null;
  const tools = activity.tools || {}, exts = activity.exts || {}, cmds = activity.cmds || {};
  const s = { cog: 0, scholar: 0, moth: 0, prism: 0, lumen: 0, hydra: 0, wisp: 0 };
  for (const [name, n] of Object.entries(tools)) {
    const t = name.toLowerCase();
    if (/^(agent|task|workflow|skill)$/.test(t)) s.wisp += 0.5 * n; // orchestration: general
    else if (/linkedin|aimfox|mail|gmail|slack|whatsapp|crm|send_message|hubspot|outreach/.test(t)) s.hydra += 3 * n;
    else if (/figma|canva|design|penpot/.test(t)) s.prism += 3 * n;
    else if (/remotion|video|higgsfield|youtube/.test(t)) s.lumen += 3 * n;
    else if (/websearch|webfetch|research|search|fetch/.test(t)) s.scholar += 2 * n;
    else if (/^(read|grep|glob)$/.test(t)) s.scholar += 0.5 * n;
    else if (/chrome|browser|computer|windows|click|screenshot/.test(t)) s.wisp += 1 * n;
  }
  for (const [ext, n] of Object.entries(exts)) {
    if (CODE_EXT.includes(ext)) s.cog += 1.5 * n;
    else if (TEXT_EXT.includes(ext)) s.moth += 1.5 * n;
    else if (DESIGN_EXT.includes(ext)) s.prism += 1.5 * n;
    else if (VIDEO_EXT.includes(ext)) s.lumen += 1.5 * n;
  }
  for (const [cmd, n] of Object.entries(cmds)) {
    if (CODE_CMDS.includes(cmd)) s.cog += 1 * n;
    else if (VIDEO_CMDS.includes(cmd)) s.lumen += 2 * n;
    else if (cmd === 'curl' || cmd === 'wget') s.scholar += 0.5 * n;
  }
  let best = null, bestScore = 0;
  for (const k of Object.keys(s)) if (s[k] > bestScore) { bestScore = s[k]; best = k; }
  return best;
}

// Mythic, the top tier. A solo operator reaches it only from real run data,
// decided at hatch and signed with the rest of the run (so it can only ever be
// earned by new runs; every older creature keeps the tier it was signed with):
//   Legion:  rule 2 (new creatures): a run that dispatched 10 or more subagents,
//            did not fail and got enough done to earn Legendary. Rule 1 (older
//            creatures): a run of 2 hours or more with 10+ subagents.
//   Devoted: the first run of the 30th (60th, 90th...) day in a row you ran agents
// Cross-feeding with another operator also breeds Mythics (see breedCreature).
const MYTHIC = { tier: 'Mythic', chip: '#ff7bd0', index: 5 };
const MYTHIC_RUN_MS = 2 * 60 * 60 * 1000;
const MYTHIC_SUBAGENTS = 10;
const MYTHIC_STREAK = 30;
function mythicReason(run, durationMs, outcome) {
  if (!run || run.error) return null;
  // rule 2: Legion is 10+ subagents on a run whose outcome earns Legendary (run length plays no part)
  if (run.ruleVersion === 2) { if ((run.subagents || 0) >= MYTHIC_SUBAGENTS && Skills.outcomeTier(outcome) >= 4) return 'Legion'; }
  else if (durationMs >= MYTHIC_RUN_MS && durationMs <= Skills.OPEN_SESSION_MS && (run.subagents || 0) >= MYTHIC_SUBAGENTS) return 'Legion';
  const d = Number(run.streakDays) || 0;
  if (run.firstOfDay && d >= MYTHIC_STREAK && d % MYTHIC_STREAK === 0) return 'Devoted';
  return null;
}

// rule 2: run length drives only this trait (a session left open over a day never earns it)
const MARATHON_MS = 20 * 60 * 1000;

function rarityFor(durationMs) {
  for (let i = 0; i < RARITY.length; i++) {
    if (durationMs <= RARITY[i].maxMs) return { index: i, ...RARITY[i] };
  }
  return { index: RARITY.length - 1, ...RARITY[RARITY.length - 1] };
}

function durationLabel(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24), rh = h % 24;
  return `${d}d` + (rh ? ` ${rh}h` : '') + (rm ? ` ${rm}m` : '');
}

// a run longer than this is a session left open, not work: it still exists and
// stays signed, but stats and skills do not count it as machine time
const OPEN_SESSION_MS = Skills.OPEN_SESSION_MS;
function isOpenSession(c) { return !!c && !c.bredBy && (c.durationMs || 0) > OPEN_SESSION_MS; }

// local hour of a timestamp. tzOffset follows Date#getTimezoneOffset (UTC - local,
// minutes); the hooks send the operator's own offset so a UTC host still knows
// when the operator's night was. Without one, the server's local time is used.
function localHour(ms, tzOffset) {
  if (tzOffset == null || !isFinite(tzOffset)) return new Date(ms).getHours();
  return new Date(ms - tzOffset * 60000).getUTCHours();
}

function speciesByKey(key) {
  return SPECIES.find((s) => s.key === key) || SPECIES[SPECIES.length - 1];
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

// ---- the mint ------------------------------------------------------------

// run = { id, startedAt, endedAt, durationMs, domainKey|prompt, subagents, error }
function computeCreature(run) {
  const durationMs = run.durationMs != null
    ? run.durationMs
    : Math.max(0, (run.endedAt || Date.now()) - (run.startedAt || Date.now()));
  const actDomain = domainFromActivity(run.activity);
  const domainKey = actDomain || run.domainKey || detectDomain(run.prompt);
  const domainSource = actDomain ? 'activity' : (run.domainSource || 'prompt');
  const toolCalls = run.activity && run.activity.toolCalls != null ? run.activity.toolCalls : null;
  const species = speciesByKey(domainKey);
  // rule 2 (live hatches from 2026-10-10 on): rarity from what the run got done.
  // Older creatures keep rule 1 (run length) and are never re-minted.
  const v2 = run.ruleVersion === 2;
  const outcome = v2 ? (Skills.outcomeOf(run.activity) || Skills.outcomeOf({ toolCalls: 0 })) : null;
  // only a live hatch may mint a Mythic: migrations, samples and demos never do
  const mythic = run.allowMythic ? mythicReason(run, durationMs, outcome) : null;
  const rarity = mythic ? Object.assign({ maxMs: Infinity }, MYTHIC)
    : v2 ? Object.assign({ index: Skills.outcomeTier(outcome) }, RARITY[Skills.outcomeTier(outcome)])
    : rarityFor(durationMs);
  const bornAt = run.endedAt || Date.now();
  const tzo = run.tzOffset != null && isFinite(run.tzOffset) ? Math.max(-840, Math.min(840, Math.round(run.tzOffset))) : null;
  const hour = localHour(bornAt, tzo);
  const subagents = run.subagents || 0;
  const error = !!run.error;

  // Seed is fully determined by the run — same run, same creature, forever.
  const seedStr = [run.id || '', durationMs, domainKey, rarity.index, subagents, error ? 'x' : 'o', bornAt].join('|');
  const seed = hashString(seedStr);
  const rng = mulberry32(seed);

  // traits read off the real signals of the run
  const traits = [];
  if (mythic) traits.push(mythic);               // Legion (2h+, 10+ subagents) or Devoted (30 days in a row)
  if (hour < 5) traits.push('Nightshift');       // ran while the world slept
  if (v2 ? durationMs >= MARATHON_MS && durationMs <= OPEN_SESSION_MS : rarity.index >= 3) traits.push('Marathon'); // a long run
  if (subagents >= 5) traits.push('Swarm');       // you commanded a fleet
  if (error) traits.push('Scarred');              // it survived a failure

  // born sick only from a real failed run. 'Restless' is a seeded temperament,
  // never a failure, so it no longer makes a creature sick.
  let status = 'healthy';
  let hpMax = 100;
  let hp = 100;
  if (error) { status = 'sick'; hp = 38; }
  else if (seed % 12 === 0) traits.push('Restless');

  const idx = rarity.index;
  const features = {
    eyes: species.key === 'hydra' ? 3 : species.key === 'scholar' ? 2 : (idx >= 3 ? 2 : 1),
    antennae: (species.key === 'moth' || species.key === 'wisp') ? 2 : (idx >= 1 ? 1 : 0),
    wings: species.archetype === 'winged' || idx >= 4,
    horns: (species.key === 'cog' || species.key === 'hydra') && idx >= 2,
    spots: idx,
    crown: idx >= 4 || traits.includes('Marathon'),
    orbiters: traits.includes('Swarm') ? Math.min(6, subagents) : 0,
    scar: error,
    glow: species.key === 'lumen' || traits.includes('Nightshift') || idx >= 3,
  };

  const epithet = traits[0] ? traits[0] + ' ' : '';
  const head = pick(NAME_HEAD, rng), mid = rng() < 0.34 ? pick(NAME_MID, rng) : '';
  const name = head + mid + pick(NAME_TAIL, rng);

  // palette: nightshift darkens and iridesces the base
  const palette = Object.assign({}, species.palette);
  let bg = '#161a24';
  if (traits.includes('Nightshift')) {
    bg = '#0c0e16';
    palette.glow = '#8f7bff';
  }
  if (status === 'sick') {
    palette.overlay = '#6f8f5a'; // sallow tint until healed
  }

  const c = {
    id: run.id ? run.id + ':' + bornAt : 'c' + seed.toString(36) + bornAt.toString(36),
    seed,
    level: 1,
    xp: 0,
    name,
    fullName: `${name} the ${epithet}${species.name}`,
    speciesKey: species.key,
    speciesName: species.name,
    archetype: species.archetype,
    rarity: { tier: rarity.tier, index: rarity.index, chip: rarity.chip },
    palette,
    bg,
    traits,
    features,
    status,
    hp,
    hpMax,
    subagents,
    error,
    bornAt,
    durationMs,
    durationLabel: durationLabel(durationMs),
    domainKey,
    domainSource,
    toolCalls,
  };
  if (v2) { c.ruleVersion = 2; c.outcome = outcome; } // ruleVersion is signed; outcome is derived from the signed activity
  // the cleaned activity counts (no file names, no args) so skills can be
  // recomputed if the formulas change; signed as a hash, see server.js
  if (run.activity && typeof run.activity === 'object') c.activity = run.activity;
  if (tzo != null) c.tzo = tzo;
  c.skillXp = Skills.computeSkillXp(c);
  c.sxv = Skills.SXV;
  return c;
}

// ---- leveling: raise a creature across future successful runs -----------
// A creature keeps growing every time you finish another good run of the SAME
// kind of work. 60 levels on a slowing curve (Lv 2 after one run, Lv 60 after
// about 400 runs of its kind), so a collection spreads across every stage
// instead of bunching up at the top. Level and xp are derived, never signed.
const MAX_CREATURE_LEVEL = 60;
const LEVEL_XP = Array.from({ length: MAX_CREATURE_LEVEL }, (_, i) => (i ? 10 * i * i + 40 : 0)); // min xp for level (index + 1)
// growth stages, by level (public/variants.js draws the same ones)
const STAGES = [{ name: 'Hatchling', from: 1 }, { name: 'Juvenile', from: 6 }, { name: 'Adult', from: 15 }, { name: 'Elder', from: 28 }, { name: 'Exalted', from: 40 }];
const LEVEL_LABELS = STAGES.map((s) => s.name);
const HERD_WINDOW = 400; // a run raises up to this many earlier siblings of its kind

function levelFor(xp) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1;
  return lvl;
}
function levelLabel(creature) {
  if (creature.status === 'sick' && (creature.level || 1) < 2) return 'Weak & Sick';
  const L = creature.level || 1; let name = STAGES[0].name;
  for (const s of STAGES) if (L >= s.from) name = s.name;
  return name;
}
function xpToNext(creature) {
  const lvl = creature.level || 1;
  if (lvl >= LEVEL_XP.length) return { have: creature.xp || 0, need: LEVEL_XP[LEVEL_XP.length - 1], pct: 1 };
  const floor = LEVEL_XP[lvl - 1], ceil = LEVEL_XP[lvl];
  const have = (creature.xp || 0) - floor;
  const need = ceil - floor;
  return { have, need, pct: Math.max(0, Math.min(1, have / need)) };
}
function xpGain(justCompleted) {
  return 50 + (justCompleted.rarity.index * 25); // a rarer run raises the herd more
}

// Power: an uncapped number for the Board. Every run adds points for what it got
// done (its outcome score, log-scaled), never for how long it ran; a healed
// survivor adds a little. See Skills.runPoints. weekScore is the same points from the last 7 days.
function operatorScore(creatures) {
  let s = 0;
  for (const c of creatures) s += Skills.runPoints(c);
  return s;
}
function weekScore(creatures, now) {
  const from = (now || Date.now()) - 7 * 86400000;
  let s = 0;
  for (const c of creatures) if (c.bornAt >= from) s += Skills.runPoints(c);
  return s;
}

// ---- cross-breeding: a hybrid neither operator could make alone -----------
// Deterministic from BOTH parents + the shared domain, so the same two operators
// working the same domain always produce the same species — and one operator
// can never mint it alone (the network effect: it needs two operators).
function _rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function _hex(r, g, b) { return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
function blend(a, b, t) { const x = _rgb(a), y = _rgb(b); return _hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }

// Mythic is the top tier everywhere (it used to sit below Legendary here)
const SIX = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const SIX_CHIP = { Common: '#8b90a0', Uncommon: '#6ee7a5', Rare: '#67a8f0', Epic: '#b28dff', Mythic: '#ff7bd0', Legendary: '#f5c451' };
const HYB_A = ['Chrono', 'Void', 'Echo', 'Gloam', 'Ember', 'Cinder', 'Umbra', 'Aether', 'Rune', 'Moss', 'Hollow', 'Glass', 'Iron', 'Dusk', 'Ashen', 'Verdant', 'Cobalt', 'Wyrm', 'Frost'];
const HYB_B = ['Sprout', 'Mender', 'Wyrm', 'Guardian', 'Sprite', 'Hag', 'Wraith', 'Moth', 'Seraph', 'Golem', 'Djinn', 'Whelp', 'Kin', 'Warden', 'Bloom', 'Fang', 'Oracle', 'Husk'];
function sixIndex(tierName) { const i = SIX.indexOf(tierName); return i < 0 ? 2 : i; }

function breedCreature(a, b, handleA, handleB, domain) {
  const pair = [handleA, handleB].sort();
  const seed = hashString(pair.join('&') + '|' + domain + '|' + a.seed + '|' + b.seed);
  const rng = mulberry32(seed);
  // a cross-fed hybrid is always Mythic: no single operator can make one
  const idx = 5;
  const tier = SIX[idx];
  const name = HYB_A[Math.floor(rng() * HYB_A.length)] + ' ' + HYB_B[Math.floor(rng() * HYB_B.length)];
  const strong = sixIndex(a.rarity.tier) >= sixIndex(b.rarity.tier) ? a : b;
  const palette = {
    body: blend(a.palette.body, b.palette.body, 0.5),
    belly: blend(a.palette.belly, b.palette.belly, 0.5),
    accent: strong.palette.accent,
    eye: blend(a.palette.eye, b.palette.eye, 0.5),
    glow: blend(a.palette.glow, b.palette.glow, 0.5),
  };
  return {
    id: 'breed:' + pair.join('+') + ':' + domain,
    seed, level: 1, xp: 0,
    name, fullName: name,
    speciesKey: strong.speciesKey,
    speciesName: `${a.speciesName} × ${b.speciesName}`,
    archetype: strong.archetype,
    rarity: { tier, index: idx, chip: SIX_CHIP[tier] },
    palette, bg: '#141821',
    traits: ['Cross-fed'],
    features: { eyes: idx >= 4 ? 2 : 1, antennae: 1, wings: true, horns: false, spots: Math.min(idx, 4), crown: idx >= 4, orbiters: idx >= 5 ? 4 : 0, scar: false, glow: true },
    status: 'healthy',
    bredBy: pair,
    domain,
    parents: [a.speciesName, b.speciesName],
    durationLabel: '',
  };
}

// A name nobody on the shelf has yet, for a creature whose name is taken. The
// same seed always walks the same sequence, so a rename is reproducible; past
// the first tries every candidate gets a middle syllable (about 27,000 more
// names). Names are not part of the signed message, so this never touches a
// signature.
function uniqueName(seed, taken) {
  for (let k = 1; k <= 400; k++) {
    const rng = mulberry32((seed ^ Math.imul(k, 0x9e3779b1)) >>> 0);
    const n = pick(NAME_HEAD, rng) + (k > 8 || rng() < 0.5 ? pick(NAME_MID, rng) : '') + pick(NAME_TAIL, rng);
    if (!taken.has(n)) return n;
  }
  const base = pick(NAME_HEAD, mulberry32(seed)) + pick(NAME_TAIL, mulberry32(seed + 1));
  let i = 2;
  while (taken.has(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

module.exports = {
  uniqueName,
  // skills (see skills.js; the browser loads the same file as /skills.js)
  Skills,
  xpFor: Skills.xpFor,
  skillLevelFor: Skills.skillLevelFor,
  skillTitle: Skills.skillTitle,
  SKILLS: Skills.SKILLS,
  SKILL_BANDS: Skills.SKILL_BANDS,
  computeSkillXp: Skills.computeSkillXp,
  computeOperatorSkills: Skills.computeOperatorSkills,
  OPEN_SESSION_MS,
  isOpenSession,
  localHour,
  LEVEL_XP,
  MAX_CREATURE_LEVEL,
  STAGES,
  HERD_WINDOW,
  computeCreature,
  detectDomain,
  domainFromActivity,
  rarityFor,
  durationLabel,
  SPECIES,
  RARITY,
  hashString,
  mulberry32,
  levelFor,
  levelLabel,
  xpToNext,
  xpGain,
  operatorScore,
  weekScore,
  runPoints: Skills.runPoints,
  MYTHIC,
  MYTHIC_RUN_MS,
  MYTHIC_SUBAGENTS,
  MYTHIC_STREAK,
  MARATHON_MS,
  outcomeOf: Skills.outcomeOf,
  outcomeTier: Skills.outcomeTier,
  mythicReason,
  LEVEL_LABELS,
  breedCreature,
};
