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

const NAME_HEAD = ['Bri', 'Quo', 'Nix', 'Zub', 'Mel', 'Fen', 'Tup', 'Vor', 'Wob', 'Squ', 'Grum', 'Pil', 'Dax', 'Yel', 'Muk', 'Ozz'];
const NAME_TAIL = ['bble', 'xel', 'tik', 'mo', 'zul', 'nub', 'rix', 'wop', 'dle', 'zzt', 'gg', 'lisk', 'per', 'quat', 'omph'];

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
const CODE_CMDS = ['npm', 'npx', 'node', 'git', 'python', 'python3', 'pip', 'cargo', 'go', 'make', 'docker', 'tsc', 'pnpm', 'yarn', 'bun', 'pytest', 'jest', 'dotnet', 'mvn', 'gradle'];
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
  const rarity = rarityFor(durationMs);
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
  if (hour < 5) traits.push('Nightshift');       // ran while the world slept
  if (rarity.index >= 3) traits.push('Marathon'); // a long, hard run
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
  const name = pick(NAME_HEAD, rng) + pick(NAME_TAIL, rng);

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
// kind of work (only its 20 most recent siblings are raised, so levels mean
// something instead of everything maxing out).
const LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]; // min xp for level (index + 1)
const LEVEL_LABELS = ['Newborn', 'Growing', 'Stronger', 'Thriving', 'Seasoned', 'Veteran', 'Elder', 'Ancient', 'Exalted', 'Fully Raised'];
const HERD_WINDOW = 20;

function levelFor(xp) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) lvl = i + 1;
  return lvl;
}
function levelLabel(creature) {
  if (creature.status === 'sick' && (creature.level || 1) < 2) return 'Weak & Sick';
  return LEVEL_LABELS[Math.min(creature.level || 1, LEVEL_LABELS.length) - 1];
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

// a single 0-10 flex number for the Proof of Life Board
function operatorScore(creatures) {
  if (!creatures.length) return 0;
  const hours = creatures.reduce((a, c) => a + (isOpenSession(c) ? 0 : (c.durationMs || 0)), 0) / 3600000;
  const rarity = creatures.reduce((a, c) => a + c.rarity.index, 0);
  const survivors = creatures.filter((c) => c.status === 'healed').length;
  const legendary = creatures.filter((c) => c.rarity.index >= 4).length;
  const raw = hours * 0.5 + rarity * 0.3 + survivors * 0.8 + legendary * 1.2 + creatures.length * 0.15;
  return Math.round((10 * raw / (raw + 9)) * 10) / 10; // diminishing curve, asymptotes to 10
}

// ---- cross-breeding: a hybrid neither operator could make alone -----------
// Deterministic from BOTH parents + the shared domain, so the same two operators
// working the same domain always produce the same species — and one operator
// can never mint it alone (that is the un-fakeable, network-effect moat).
function _rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function _hex(r, g, b) { return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
function blend(a, b, t) { const x = _rgb(a), y = _rgb(b); return _hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); }

const SIX = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic', 'Legendary'];
const SIX_CHIP = { Common: '#8b90a0', Uncommon: '#6ee7a5', Rare: '#67a8f0', Epic: '#b28dff', Mythic: '#ff7bd0', Legendary: '#f5c451' };
const HYB_A = ['Chrono', 'Void', 'Echo', 'Gloam', 'Ember', 'Cinder', 'Umbra', 'Aether', 'Rune', 'Moss', 'Hollow', 'Glass', 'Iron', 'Dusk', 'Ashen', 'Verdant', 'Cobalt', 'Wyrm', 'Frost'];
const HYB_B = ['Sprout', 'Mender', 'Wyrm', 'Guardian', 'Sprite', 'Hag', 'Wraith', 'Moth', 'Seraph', 'Golem', 'Djinn', 'Whelp', 'Kin', 'Warden', 'Bloom', 'Fang', 'Oracle', 'Husk'];
function sixIndex(tierName) { const i = SIX.indexOf(tierName); return i < 0 ? 2 : i; }

function breedCreature(a, b, handleA, handleB, domain) {
  const pair = [handleA, handleB].sort();
  const seed = hashString(pair.join('&') + '|' + domain + '|' + a.seed + '|' + b.seed);
  const rng = mulberry32(seed);
  const idx = Math.min(5, Math.max(sixIndex(a.rarity.tier), sixIndex(b.rarity.tier)) + 1);
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

module.exports = {
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
  LEVEL_LABELS,
  breedCreature,
};
