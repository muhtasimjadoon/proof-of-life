// Proof of Life — skills
// Turns real creatures (each one a real agent run) into operator skills on a
// 1-120 curve. Pure and deterministic: the server computes, the browser can load
// the same file (/skills.js -> window.POLSkills) for the curve math.
// Zero dependencies. Every number comes from a stored creature; nothing is
// estimated or projected.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./public/variants.js'));
  else root.POLSkills = factory(root.POLVariants);
})(typeof self !== 'undefined' ? self : this, function (Variants) {
  'use strict';

  // bump when any formula below changes: cached creature.skillXp is recomputed
  const SXV = 2;

  // ---- the curve: 1..120, hybrid power x exponential ------------------------
  // Levels 1-99 are exactly where they always were; 100-120 continue the same
  // formula, so nobody's existing xp changes level.
  const MAX_LEVEL = 120;
  function xpFor(L) {
    if (L <= 1) return 0;
    return Math.round(4.5 * Math.pow(L - 1, 1.9) * Math.pow(1.02, L - 1));
  }
  const XP_CURVE = [0, 0]; // XP_CURVE[L] = total xp needed to reach level L
  for (let L = 2; L <= MAX_LEVEL; L++) XP_CURVE[L] = xpFor(L);
  const STAR_XP = 150000; // past Lv 120, every extra 150k xp is one prestige star
  const MAX_STARS = 5;

  function skillLevelFor(xp) {
    xp = Math.max(0, xp || 0);
    let lo = 1, hi = MAX_LEVEL;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (XP_CURVE[mid] <= xp) lo = mid; else hi = mid - 1; }
    return lo;
  }
  function starsFor(xp) {
    const over = (xp || 0) - XP_CURVE[MAX_LEVEL];
    return over < 0 ? 0 : Math.min(MAX_STARS, Math.floor(over / STAR_XP));
  }
  // progress inside the current level (or toward the next star at the cap)
  function progressFor(xp) {
    xp = Math.max(0, xp || 0);
    const level = skillLevelFor(xp);
    if (level < MAX_LEVEL) {
      const lo = XP_CURVE[level], hi = XP_CURVE[level + 1];
      return { level, pct: (xp - lo) / (hi - lo), toNext: hi - xp, nextAt: hi };
    }
    const stars = starsFor(xp);
    if (stars >= MAX_STARS) return { level, pct: 1, toNext: 0, nextAt: null };
    const lo = XP_CURVE[MAX_LEVEL] + stars * STAR_XP, hi = lo + STAR_XP;
    return { level, pct: (xp - lo) / STAR_XP, toNext: hi - xp, nextAt: hi };
  }

  // ---- title bands: one distinct hue per band, so progress reads at a glance ----
  const SKILL_BANDS = [
    { key: 'novice',       name: 'Novice',       from: 1,   to: 9,   color: '#8b90a0' },
    { key: 'apprentice',   name: 'Apprentice',   from: 10,  to: 19,  color: '#7ddc6a' },
    { key: 'journeyman',   name: 'Journeyman',   from: 20,  to: 29,  color: '#2fd3b5' },
    { key: 'adept',        name: 'Adept',        from: 30,  to: 39,  color: '#4aa8ff' },
    { key: 'expert',       name: 'Expert',       from: 40,  to: 49,  color: '#7f7cff' },
    { key: 'master',       name: 'Master',       from: 50,  to: 59,  color: '#c06cff' },
    { key: 'grandmaster',  name: 'Grandmaster',  from: 60,  to: 69,  color: '#ff5fb4' },
    { key: 'virtuoso',     name: 'Virtuoso',     from: 70,  to: 79,  color: '#ff6a5c' },
    { key: 'legend',       name: 'Legend',       from: 80,  to: 89,  color: '#ff9a2e' },
    { key: 'mythic',       name: 'Mythic',       from: 90,  to: 98,  color: '#ff8ad8', gradient: ['#ff7bd0', '#b28dff', '#67a8f0', '#6ee7a5'] },
    { key: 'paragon',      name: 'Paragon',      from: 99,  to: 99,  color: '#f5c451', ring: 'gold', glyph: 'laurel' },
    { key: 'ascendant',    name: 'Ascendant',    from: 100, to: 109, color: '#ffe3a0', gradient: ['#fff6d6', '#f5c451', '#ffe3a0'], ring: 'gold' },
    { key: 'transcendent', name: 'Transcendent', from: 110, to: 119, color: '#9ff3ff', gradient: ['#e8fdff', '#7bd6ff', '#b28dff'] },
    { key: 'apex',         name: 'Apex',         from: 120, to: 120, color: '#ffffff', gradient: ['#ff7bd0', '#f5c451', '#7bf0ff', '#b28dff'], ring: 'gold' },
  ];
  function bandFor(level) {
    for (let i = SKILL_BANDS.length - 1; i >= 0; i--) if (level >= SKILL_BANDS[i].from) return SKILL_BANDS[i];
    return SKILL_BANDS[0];
  }
  function skillTitle(level) { return bandFor(level).name; }
  function nextBandFor(level) {
    const b = bandFor(level), i = SKILL_BANDS.indexOf(b);
    const n = SKILL_BANDS[i + 1];
    return n ? { key: n.key, name: n.name, level: n.from, xp: XP_CURVE[n.from], color: n.color } : null;
  }

  const TOTAL_BANDS = [
    { key: 'initiate',  name: 'Initiate',  from: 0 },
    { key: 'operator',  name: 'Operator',  from: 100 },
    { key: 'veteran',   name: 'Veteran',   from: 250 },
    { key: 'elite',     name: 'Elite',     from: 450 },
    { key: 'archon',    name: 'Archon',    from: 700 },
    { key: 'sovereign', name: 'Sovereign', from: 1000 },
    { key: 'titan',     name: 'Titan',     from: 1500 },
    { key: 'eternal',   name: 'Eternal',   from: 2200 },
  ];
  function totalBandFor(total) {
    for (let i = TOTAL_BANDS.length - 1; i >= 0; i--) if (total >= TOTAL_BANDS[i].from) return TOTAL_BANDS[i];
    return TOTAL_BANDS[0];
  }
  function nextTotalBand(total) { return TOTAL_BANDS.find((b) => b.from > total) || null; }

  // ---- the skills -----------------------------------------------------------
  // group: work (a run's xp is split across these by what it did),
  //        craft (bonuses on top of the run), habits (computed across days),
  //        style (how and when you run agents)
  // tracked: needs the tool activity a run carries, so it starts at the first such run
  // unlock: the one real thing that starts it, shown while it is locked
  const SKILLS = [
    { key: 'engineering',   name: 'Engineering',   group: 'work',  species: 'cog',     signal: 'code files and build commands' },
    { key: 'debugging',     name: 'Debugging',     group: 'work',  species: 'cog',     signal: 'code runs that read or search, then edit', tracked: true, unlock: 'A run that reads or searches code and then edits it.' },
    { key: 'testing',       name: 'Testing',       group: 'work',  species: 'cog',     signal: 'test runners and test tools', tracked: true, unlock: 'A run that calls a test runner: jest, vitest, pytest, mocha, playwright or cypress.' },
    { key: 'shipping',      name: 'Shipping',      group: 'work',  species: 'cog',     signal: 'git, deploy and remote commands', tracked: true, unlock: 'A run that uses git, gh, docker, vercel, wrangler, ssh or another deploy command.' },
    { key: 'data',          name: 'Data',          group: 'work',  species: 'scholar', signal: 'data files and query tools', tracked: true, unlock: 'A run that touches CSV, SQL, parquet or notebook files, or a database tool.' },
    { key: 'research',      name: 'Research',      group: 'work',  species: 'scholar', signal: 'web search and fetch' },
    { key: 'writing',       name: 'Writing',       group: 'work',  species: 'moth',    signal: 'docs and text files' },
    { key: 'design',        name: 'Design',        group: 'work',  species: 'prism',   signal: 'design tools and image files' },
    { key: 'video',         name: 'Video',         group: 'work',  species: 'lumen',   signal: 'video tools, media files, ffmpeg' },
    { key: 'outreach',      name: 'Outreach',      group: 'work',  species: 'hydra',   signal: 'messaging, CRM and LinkedIn tools' },
    { key: 'automation',    name: 'Automation',    group: 'work',  species: 'wisp',    signal: 'browser and computer-use tools, plus unclassified runs' },
    { key: 'toolsmith',     name: 'Toolsmith',     group: 'craft', species: 'cog',     signal: 'distinct tools and MCP servers per run', tracked: true, unlock: 'Any run that uses tools, once this server records tool activity.' },
    { key: 'orchestration', name: 'Orchestration', group: 'craft', species: 'wisp',    signal: 'subagents dispatched' },
    { key: 'endurance',     name: 'Endurance',     group: 'craft', species: 'lumen',   signal: 'run length (capped at 4h per run)' },
    { key: 'resilience',    name: 'Resilience',    group: 'craft', species: 'hydra',   signal: 'runs that failed, and comebacks within 30 min', unlock: 'A run that ends in an error, then a good run of the same kind within 30 minutes.' },
    { key: 'consistency',   name: 'Consistency',   group: 'habits', species: 'scholar', signal: 'active days and streaks' },
    { key: 'polymath',      name: 'Polymath',      group: 'habits', species: 'prism',   signal: '3+ kinds of work in one day', unlock: 'Three different kinds of work in one day.' },
    { key: 'nightowl',      name: 'Night Owl',     group: 'habits', species: 'moth',    signal: 'runs finished between 10pm and 5am', unlock: 'A run that finishes between 10pm and 5am.' },
    { key: 'focus',         name: 'Focus',         group: 'style', species: 'scholar', signal: 'deep runs of 20 minutes or more that finished clean', unlock: 'One run of 20 minutes or more that does not fail.' },
    { key: 'velocity',      name: 'Velocity',      group: 'style', species: 'wisp',    signal: 'runs per active day, past the first two', unlock: 'Three or more runs in one day.' },
    { key: 'precision',     name: 'Precision',     group: 'style', species: 'prism',   signal: 'runs with no failed tool call, and clean streaks', tracked: true, unlock: 'A run where no tool call fails. Counted from runs that report tool errors.' },
    { key: 'earlybird',     name: 'Early Bird',    group: 'style', species: 'moth',    signal: 'runs finished between 5am and 9am', unlock: 'A run that finishes between 5am and 9am.' },
    { key: 'weekend',       name: 'Weekend Warrior', group: 'style', species: 'hydra', signal: 'runs finished on Saturday or Sunday', unlock: 'A run that finishes on a Saturday or Sunday.' },
    { key: 'explorer',      name: 'Explorer',      group: 'style', species: 'wisp',    signal: 'tools and MCP servers you used for the first time', tracked: true, unlock: 'Use a tool or MCP server your agents have never used before.' },
    { key: 'multitasker',   name: 'Multitasker',   group: 'style', species: 'hydra',   signal: 'runs that overlapped other runs', unlock: 'Two agent runs going at the same time.' },
    { key: 'terminal',      name: 'Terminal',      group: 'style', species: 'cog',     signal: 'shell commands your agents ran', tracked: true, unlock: 'A run that uses the shell (Bash or PowerShell).' },
    { key: 'reviewer',      name: 'Reviewer',      group: 'style', species: 'scholar', signal: 'runs that read and searched a lot and changed nothing', tracked: true, unlock: 'A run with 6 or more reads or searches and no edits.' },
    { key: 'collector',     name: 'Collector',     group: 'style', species: 'prism',   signal: 'Dex slots filled: species, rarities, colorways, Shinies' },
  ];
  const SKILL_KEYS = SKILLS.map((s) => s.key);
  const WORK_KEYS = SKILLS.filter((s) => s.group === 'work').map((s) => s.key);
  const LEGACY_WORK = { cog: 'engineering', scholar: 'research', moth: 'writing', prism: 'design', lumen: 'video', hydra: 'outreach', wisp: 'automation' };

  // ---- known signal vocabularies (also the privacy allow-list for hooks) ----
  const EXT = {
    data:   ['.csv', '.tsv', '.sql', '.parquet', '.xlsx', '.xls', '.ipynb', '.sqlite', '.db'],
    code:   ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.swift', '.sh', '.bash', '.ps1', '.json', '.yml', '.yaml', '.toml', '.css', '.scss', '.html', '.vue', '.svelte', '.lua', '.dart', '.ex', '.exs', '.zig', '.r'],
    text:   ['.md', '.mdx', '.txt', '.docx', '.rtf', '.rst', '.tex'],
    design: ['.fig', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.psd', '.ai', '.sketch', '.avif'],
    video:  ['.mp4', '.mov', '.webm', '.gif', '.mp3', '.wav', '.m4a', '.mkv'],
  };
  const CMD = {
    test:  ['jest', 'vitest', 'pytest', 'mocha', 'playwright', 'cypress', 'phpunit', 'ava', 'tap', 'pkg-test'],
    ship:  ['git', 'gh', 'docker', 'vercel', 'wrangler', 'netlify', 'fly', 'flyctl', 'kubectl', 'ssh', 'scp', 'rsync', 'terraform', 'helm'],
    data:  ['sqlite3', 'psql', 'duckdb', 'jq', 'mysql', 'csvkit'],
    code:  ['npm', 'npx', 'node', 'python', 'python3', 'pip', 'pip3', 'cargo', 'go', 'make', 'tsc', 'pnpm', 'yarn', 'bun', 'deno', 'dotnet', 'mvn', 'gradle', 'rustc', 'gcc', 'javac', 'uv'],
    video: ['ffmpeg', 'ffprobe', 'remotion', 'higgs', 'higgsfield', 'yt-dlp'],
    web:   ['curl', 'wget'],
  };
  // everything else a shell runs: allowed heads that carry no skill (still private-safe)
  const CMD_NEUTRAL = ['cd', 'ls', 'dir', 'cat', 'echo', 'grep', 'rg', 'find', 'sed', 'awk', 'head', 'tail', 'wc', 'mkdir', 'rm', 'cp', 'mv', 'touch', 'chmod', 'sleep', 'kill', 'ps', 'pwd', 'export', 'set', 'powershell', 'pwsh', 'cmd', 'bash', 'sh', 'start', 'open', 'code', 'tar', 'unzip', 'zip', 'diff', 'sort', 'xargs', 'tee', 'test', 'for', 'if', 'while', 'netstat', 'taskkill', 'tasklist', 'where', 'which'];
  const KNOWN_EXTS = new Set([].concat(...Object.values(EXT)));
  const KNOWN_CMDS = new Set([].concat(...Object.values(CMD), CMD_NEUTRAL));

  // tool-name families, checked in order
  const TOOL_RULES = [
    { re: /linkedin|aimfox|gmail|mail|slack|whatsapp|crm|send_message|hubspot|outreach|telegram|discord/, skill: 'outreach', w: 3 },
    { re: /figma|canva|penpot|design/, skill: 'design', w: 3 },
    { re: /remotion|video|higgsfield|youtube/, skill: 'video', w: 3 },
    { re: /sqlite|postgres|supabase|bigquery|duckdb|database|spreadsheet|sheets|airtable/, skill: 'data', w: 3 },
    { re: /test/, skill: 'testing', w: 3 },
    { re: /websearch|webfetch|research|search|fetch/, skill: 'research', w: 2 },
    { re: /chrome|browser|computer|windows|click|screenshot|playwright|puppeteer/, skill: 'automation', w: 1 },
  ];
  const EDIT_TOOL = /^(edit|write|multiedit|notebookedit)$/i;
  const READ_TOOL = /^(read|grep|glob)$/i;
  const SHELL_TOOL = /^(bash|powershell)$/i;
  // every real signal earns at least this much per hit (capped), on top of its
  // share of the run: a run that ran git three times always feeds Shipping
  const SIGNAL_FLOOR = 5, SIGNAL_CAP = 60;

  function emptyMap() { const m = {}; for (const k of SKILL_KEYS) m[k] = 0; return m; }
  function hasActivity(c) { return !!(c && c.activity && typeof c.activity === 'object'); }
  function minutesOf(c) { return Math.min(Math.max(0, (c.durationMs || 0) / 60000), 240); }
  function isOpen(c) { return (c.durationMs || 0) > OPEN_SESSION_MS; }
  // a run whose tool errors are known (newer hooks report the count, never the text)
  function cleanKnown(c) { return hasActivity(c) && c.activity.toolErrors != null; }
  function isClean(c) { return !c.error && cleanKnown(c) && (c.activity.toolErrors | 0) === 0; }
  const RB = [0, 10, 25, 60, 120, 200]; // Common..Mythic rarity bonus
  function runXpOf(c) {
    const m = minutesOf(c);
    const ri = c.rarity ? Math.max(0, Math.min(5, c.rarity.index | 0)) : 0;
    return Math.round(10 + 30 * Math.log2(1 + m) + RB[ri]);
  }
  // the local hour a creature was born, in its own recorded timezone when known
  function localDate(ms, tzOffsetMin) {
    // tzOffsetMin follows Date#getTimezoneOffset (minutes, UTC - local)
    if (tzOffsetMin == null || !isFinite(tzOffsetMin)) return new Date(ms);
    const d = new Date(ms - tzOffsetMin * 60000);
    return { getHours: () => d.getUTCHours(), getFullYear: () => d.getUTCFullYear(), getMonth: () => d.getUTCMonth(), getDate: () => d.getUTCDate(), getDay: () => d.getUTCDay() };
  }
  function localOf(c, tz) { return localDate(c.bornAt, c.tzo != null ? c.tzo : tz); }
  function hourOf(c, tz) { return localOf(c, tz).getHours(); }
  function dayKey(ms, tz) { const d = localDate(ms, tz); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dayIndex(key) { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }

  // score each work skill from a run's activity counts
  function workScores(a) {
    const tools = a.tools || {}, exts = a.exts || {}, cmds = a.cmds || {};
    const s = {}, hits = {};
    for (const k of WORK_KEYS) { s[k] = 0; hits[k] = 0; }
    const add = (k, w, n) => { s[k] += w * n; hits[k] += n; };
    let codeExt = 0;
    for (const [ext, n] of Object.entries(exts)) if (EXT.code.includes(ext)) codeExt += n;
    let edits = 0;
    for (const [name, n] of Object.entries(tools)) if (EDIT_TOOL.test(name)) edits += n;
    const debugRun = codeExt > 0 && edits > 0;
    for (const [name, n] of Object.entries(tools)) {
      const t = name.toLowerCase();
      if (READ_TOOL.test(t)) { add(debugRun ? 'debugging' : 'research', 0.5, n); continue; }
      for (const r of TOOL_RULES) if (r.re.test(t)) { add(r.skill, r.w, n); break; }
    }
    for (const [ext, n] of Object.entries(exts)) {
      if (EXT.data.includes(ext)) add('data', 1.5, n);
      else if (EXT.code.includes(ext)) add('engineering', 1.5, n);
      else if (EXT.text.includes(ext)) add('writing', 1.5, n);
      else if (EXT.design.includes(ext)) add('design', 1.5, n);
      else if (EXT.video.includes(ext)) add('video', 1.5, n);
    }
    for (const [cmd, n] of Object.entries(cmds)) {
      if (CMD.test.includes(cmd)) add('testing', 1, n);
      else if (CMD.ship.includes(cmd)) add('shipping', 1, n);
      else if (CMD.data.includes(cmd)) add('data', 1, n);
      else if (CMD.code.includes(cmd)) add('engineering', 1, n);
      else if (CMD.video.includes(cmd)) add('video', 2, n);
      else if (CMD.web.includes(cmd)) add('research', 0.5, n);
    }
    return { s, hits };
  }

  // per-creature xp (everything that needs only this one creature)
  function computeSkillXp(c) {
    const out = {};
    if (!c || c.bredBy) return out;
    const runXp = runXpOf(c);
    const m = minutesOf(c);
    const put = (k, v) => { v = Math.round(v); if (v > 0) out[k] = (out[k] || 0) + v; };
    if (hasActivity(c)) {
      const { s, hits } = workScores(c.activity);
      const total = Object.values(s).reduce((a, b) => a + b, 0);
      if (total > 0) {
        // every skill the run really exercised gets its share plus a per-signal floor
        for (const k of WORK_KEYS) if (s[k] > 0) put(k, runXp * s[k] / total + Math.min(SIGNAL_CAP, SIGNAL_FLOOR * hits[k]));
      } else put('automation', runXp); // tools ran but none we classify: general
      const tools = c.activity.tools || {}, names = Object.keys(tools);
      const mcp = new Set(names.filter((t) => t.startsWith('mcp__')).map((t) => t.split('__')[1]));
      put('toolsmith', Math.min(120, 8 * names.length + 4 * mcp.size));
      let shell = 0, reads = 0, edits = 0;
      for (const [name, n] of Object.entries(tools)) { if (SHELL_TOOL.test(name)) shell += n; if (READ_TOOL.test(name)) reads += n; if (EDIT_TOOL.test(name)) edits += n; }
      const heads = Object.keys(c.activity.cmds || {}).filter((h) => h !== 'other').length;
      if (shell) put('terminal', Math.min(160, 6 * shell) + 4 * heads);
      if (reads >= 6 && edits === 0) put('reviewer', Math.min(150, 20 + 4 * reads));
    } else {
      // pre-tracking creature: all of the run goes to the skill its domain maps to.
      // respread creatures had a domain assigned by hash, so they count as general.
      const k = c.domainSource === 'respread' ? 'automation' : (LEGACY_WORK[c.domainKey] || 'automation');
      put(k, runXp);
    }
    put('endurance', Math.max(0, m - 3) * 4);
    const subs = Math.max(0, Math.min(20, c.subagents || 0));
    put('orchestration', 25 * subs);
    if (c.error) put('resilience', 150); // only a real failed run; never the seeded 'Restless' temperament
    // a deep run: 20+ minutes that did not fail (a session left open for a day is not focus)
    if (!c.error && m >= 20 && !isOpen(c)) put('focus', (100 + 2 * (m - 20)) * (isClean(c) ? 1.5 : 1));
    return out;
  }

  // the skills that depend on the local clock take the timezone
  function clockXp(c, tz) {
    const d = localOf(c, tz), h = d.getHours(), dow = d.getDay(), r = runXpOf(c), g = {};
    if (h >= 0 && h <= 4) g.nightowl = Math.round(r * 0.4);
    else if (h >= 22) g.nightowl = Math.round(r * 0.2);
    if (h >= 5 && h <= 8) g.earlybird = Math.round(r * 0.4);
    if (dow === 0 || dow === 6) g.weekend = Math.round(r * 0.3);
    return g;
  }

  function creatureGains(c, tz) {
    const g = (c.skillXp && c.sxv === SXV) ? Object.assign({}, c.skillXp) : computeSkillXp(c);
    for (const [k, v] of Object.entries(clockXp(c, tz))) g[k] = (g[k] || 0) + v;
    return g;
  }

  // ---- points: one honest, uncapped number per run (Power and the weekly race) ----
  const TIER_POINTS = { Common: 1, Uncommon: 3, Rare: 8, Epic: 20, Legendary: 50, Mythic: 120 };
  function runPoints(c) {
    if (!c || c.bredBy || !c.rarity || isOpen(c)) return 0;
    const m = minutesOf(c);
    return Math.round(2 + 5 * Math.log2(1 + m) + (TIER_POINTS[c.rarity.tier] || 0) + (c.status === 'healed' ? 5 : 0));
  }

  // ---- operator view: every skill, levels, recent gains, milestones ---------
  // opts: { tz: minutes (Date#getTimezoneOffset), now: ms }
  function computeOperatorSkills(creatures, opts) {
    opts = opts || {};
    const tz = opts.tz;
    const now = opts.now || Date.now();
    const list = (creatures || []).filter((c) => c && !c.bredBy && c.bornAt).slice().sort((a, b) => a.bornAt - b.bornAt);

    // per run: its own gains, plus what it earned against the rest of your history
    const perCreature = new Map();
    for (const c of list) perCreature.set(c.id, creatureGains(c, tz));
    const addTo = (c, k, v) => { v = Math.round(v); if (v > 0) { const g = perCreature.get(c.id); g[k] = (g[k] || 0) + v; } };

    // Multitasker: runs that started while other runs were still going
    const honest = list.filter((c) => !isOpen(c) && (c.durationMs || 0) > 0);
    const byStart = honest.map((c) => ({ c, s: c.bornAt - c.durationMs, e: c.bornAt })).sort((a, b) => a.s - b.s);
    let active = [], overlapRuns = 0, peak = 1;
    for (const r of byStart) {
      active = active.filter((x) => x.e > r.s);
      if (active.length) { addTo(r.c, 'multitasker', 20 * Math.min(6, active.length)); overlapRuns++; }
      active.push(r); peak = Math.max(peak, active.length);
    }
    // Precision: clean runs, with a bonus that grows along an unbroken clean streak
    let streakRuns = 0, bestClean = 0, knownRuns = 0, cleanRuns = 0;
    for (const c of list) {
      if (!cleanKnown(c)) continue;
      knownRuns++;
      if (isClean(c)) { streakRuns++; cleanRuns++; bestClean = Math.max(bestClean, streakRuns); addTo(c, 'precision', 12 + Math.min(36, 3 * (streakRuns - 1))); }
      else streakRuns = 0;
    }
    // Explorer: the first time your agents used each tool and each MCP server
    const seenTools = new Set(), seenMcp = new Set();
    for (const c of list) {
      if (!hasActivity(c)) continue;
      for (const name of Object.keys(c.activity.tools || {})) {
        if (!seenTools.has(name)) { seenTools.add(name); addTo(c, 'explorer', 60); }
        if (name.startsWith('mcp__')) { const srv = name.split('__')[1]; if (srv && !seenMcp.has(srv)) { seenMcp.add(srv); addTo(c, 'explorer', 200); } }
      }
    }
    // Collector: the first creature to fill each Dex slot
    const dexSeen = new Set(), dexFirst = {};
    if (Variants) {
      for (const c of list) for (const id of Variants.slotsOf(c)) {
        if (dexSeen.has(id)) continue;
        dexSeen.add(id); dexFirst[id] = c.id;
        const kind = id.split(':')[0];
        addTo(c, 'collector', kind === 'my' ? 1000 : kind === 's' ? 600 : kind === 'm' ? 400 : 30 + 15 * (Variants.TIER_RANK[id.split(':')[3]] || 0));
      }
    }

    // events: { at, gains, creatureId? }
    const events = [];
    for (const c of list) events.push({ at: c.bornAt, gains: perCreature.get(c.id), creatureId: c.id });
    // comebacks: a failed run followed within 30 min by a success in the same domain
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.error) continue;
      for (let j = i + 1; j < list.length && list[j].bornAt - c.bornAt <= 30 * 60000; j++) {
        const n = list[j];
        if (!n.error && n.domainKey === c.domainKey) { events.push({ at: n.bornAt, gains: { resilience: 100 }, creatureId: n.id, kind: 'comeback' }); break; }
      }
    }
    // per day: consistency (streak-weighted), polymath (3+ kinds of work), velocity
    const days = new Map();
    for (const c of list) {
      const k = dayKey(c.bornAt, tz);
      let d = days.get(k);
      if (!d) { d = { key: k, idx: dayIndex(k), last: 0, domains: new Set(), runs: 0, minutes: 0, points: 0 }; days.set(k, d); }
      d.last = Math.max(d.last, c.bornAt);
      if (c.domainSource !== 'respread') d.domains.add(c.domainKey);
      d.runs++;
      if (!isOpen(c)) d.minutes += (c.durationMs || 0) / 60000; // a session left open is not machine time
      d.points += runPoints(c);
    }
    const dayList = [...days.values()].sort((a, b) => a.idx - b.idx);
    let streak = 0, prev = null, bestStreak = 0;
    for (const d of dayList) {
      streak = prev != null && d.idx === prev + 1 ? streak + 1 : 1;
      prev = d.idx; d.streak = streak; bestStreak = Math.max(bestStreak, streak);
      const g = { consistency: 100 + 20 * Math.min(streak - 1, 30) };
      if (d.domains.size >= 3) g.polymath = 60 * (d.domains.size - 2);
      if (d.runs > 2) g.velocity = 15 * (Math.min(d.runs, 80) - 2);
      events.push({ at: d.last, gains: g, kind: 'day', day: d.key });
    }
    events.sort((a, b) => a.at - b.at);

    // replay: totals, last gains, 7-day series, milestones
    const xp = emptyMap(), legacyXp = emptyMap(), count = emptyMap(), lastGain = {};
    const todayIdx = dayIndex(dayKey(now, tz));
    const week = {}; for (const k of SKILL_KEYS) week[k] = [0, 0, 0, 0, 0, 0, 0];
    const milestones = [];
    const levelNow = {}; for (const k of SKILL_KEYS) levelNow[k] = 1;
    const starsNow = {}; for (const k of SKILL_KEYS) starsNow[k] = 0;
    let totalLevel = SKILL_KEYS.length, totalBand = totalBandFor(totalLevel).key;
    const byId = new Map(list.map((c) => [c.id, c]));
    const groupOf = {}; for (const s of SKILLS) groupOf[s.key] = s.group;
    for (const e of events) {
      const di = todayIdx - dayIndex(dayKey(e.at, tz));
      for (const [k, v] of Object.entries(e.gains)) {
        if (!(k in xp) || !v) continue;
        xp[k] += v;
        if (e.kind == null) {
          count[k]++;
          const c = byId.get(e.creatureId);
          if (c && !hasActivity(c) && groupOf[k] === 'work') legacyXp[k] += v;
        }
        lastGain[k] = { xp: v, at: e.at, creatureId: e.creatureId || null, kind: e.kind || 'run' };
        if (di >= 0 && di < 7) week[k][6 - di] += v;
        const L = skillLevelFor(xp[k]);
        if (L !== levelNow[k]) {
          const from = bandFor(levelNow[k]), to = bandFor(L);
          totalLevel += L - levelNow[k];
          levelNow[k] = L;
          if (to !== from) milestones.push({ kind: 'band', skill: k, name: skillName(k), band: to.name, color: to.color, level: L, at: e.at, text: `${skillName(k)} reached ${to.name}` });
        }
        const st = starsFor(xp[k]);
        if (st > starsNow[k]) { starsNow[k] = st; milestones.push({ kind: 'star', skill: k, name: skillName(k), stars: st, at: e.at, text: `${skillName(k)} earned prestige star ${st}` }); }
      }
      const tb = totalBandFor(totalLevel);
      if (tb.key !== totalBand) { totalBand = tb.key; milestones.push({ kind: 'total', band: tb.name, totalLevel, at: e.at, text: `Total level ${totalLevel}: ${tb.name}` }); }
    }
    // creature milestones
    const firstLeg = list.find((c) => c.rarity && c.rarity.tier === 'Legendary');
    if (firstLeg) milestones.push({ kind: 'legendary', at: firstLeg.bornAt, creatureId: firstLeg.id, text: `First Legendary: ${firstLeg.fullName}` });
    const firstMyth = list.find((c) => c.rarity && c.rarity.tier === 'Mythic');
    if (firstMyth) milestones.push({ kind: 'mythic', at: firstMyth.bornAt, creatureId: firstMyth.id, text: `First Mythic: ${firstMyth.fullName}` });
    if (Variants) {
      const firstShiny = list.find((c) => Variants.variantOf(c).shiny);
      if (firstShiny) milestones.push({ kind: 'shiny', at: firstShiny.bornAt, creatureId: firstShiny.id, text: `First Shiny: ${firstShiny.fullName}` });
    }
    const longest = honest.reduce((b, c) => (!b || c.durationMs > b.durationMs ? c : b), null);
    if (longest) milestones.push({ kind: 'longest', at: longest.bornAt, creatureId: longest.id, durationMs: longest.durationMs, text: `Longest run: ${longest.durationLabel || Math.round(longest.durationMs / 60000) + 'm'}` });
    for (const d of dayList) if (d.streak === 7) { milestones.push({ kind: 'streak', at: d.last, days: 7, text: '7-day streak' }); break; }
    milestones.sort((a, b) => b.at - a.at);

    // first creature that carried activity: specialist skills are tracked from here
    const firstAct = list.find(hasActivity);
    const since = firstAct ? firstAct.bornAt : null;
    const firstErrKnown = list.find(cleanKnown);

    // top contributing creatures per skill
    const top = {}; for (const k of SKILL_KEYS) top[k] = [];
    for (const c of list) {
      const g = perCreature.get(c.id);
      for (const [k, v] of Object.entries(g)) if (top[k]) top[k].push([v, c.bornAt, c.id]);
    }

    // a real, checkable line per skill where one number says more than the level
    const bestDayRuns = dayList.reduce((b, d) => Math.max(b, d.runs), 0);
    const dexTotal = Variants ? Variants.dexSlots().length : 0;
    const facts = {
      precision: knownRuns ? `${Math.round((100 * cleanRuns) / knownRuns)}% of ${knownRuns} tracked runs clean · best streak ${bestClean}` : null,
      explorer: seenTools.size ? `${seenTools.size} tools · ${seenMcp.size} MCP servers` : null,
      multitasker: overlapRuns ? `${overlapRuns} overlapping runs · ${peak} at once at most` : null,
      velocity: bestDayRuns ? `best day ${bestDayRuns} runs` : null,
      collector: dexTotal ? `${dexSeen.size} of ${dexTotal} Dex slots` : null,
    };

    const out = SKILLS.map((s) => {
      const p = progressFor(xp[s.key]);
      const band = bandFor(p.level);
      const locked = xp[s.key] === 0;
      const t = top[s.key].sort((a, b) => b[0] - a[0] || b[1] - a[1]).slice(0, 5).map(([v, , id]) => ({ creatureId: id, xp: v }));
      return {
        key: s.key, name: s.name, group: s.group, species: s.species, signal: s.signal,
        xp: xp[s.key], level: p.level, title: band.name,
        band: { key: band.key, name: band.name, color: band.color, from: band.from, to: band.to, gradient: band.gradient || null, ring: band.ring || null },
        nextBand: nextBandFor(p.level),
        stars: starsFor(xp[s.key]), pct: Math.max(0, Math.min(1, p.pct)), toNext: p.toNext, nextAt: p.nextAt,
        creatures: count[s.key], legacyXp: legacyXp[s.key],
        lastGain: lastGain[s.key] || null,
        week: week[s.key],
        top: t,
        locked, unlock: s.unlock || 'Keep running agents: this one fills in from your runs.',
        tracked: !!s.tracked,
        tracking: locked, // older pages read this name
        since: s.tracked ? (s.key === 'precision' ? (firstErrKnown ? firstErrKnown.bornAt : null) : since) : null,
        fact: facts[s.key] || null,
      };
    });
    const total = out.reduce((a, s) => a + s.level, 0);
    const recent = list.slice(-12).reverse().map((c) => ({ creatureId: c.id, bornAt: c.bornAt, gains: perCreature.get(c.id) }));

    // engagement (days are local to tz)
    const todayKey = dayKey(now, tz);
    const today = days.get(todayKey);
    let cur = 0;
    const lastDay = dayList[dayList.length - 1];
    if (lastDay && (lastDay.idx === todayIdx || lastDay.idx === todayIdx - 1)) cur = lastDay.streak;
    const weekAgo = now - 7 * 86400000;
    // the same 'rarest' ranking as every other page (variants.js): tier, then Shiny, then the Legendary editions
    const rarestWeek = honest.filter((c) => c.bornAt >= weekAgo && !c.bredBy)
      .reduce((b, c) => (!b || Variants.rarer(c, b) < 0 ? c : b), null);
    const weekGains = out.map((s) => ({ key: s.key, name: s.name, xp: s.week.reduce((a, b) => a + b, 0) }))
      .filter((s) => s.xp > 0).sort((a, b) => b.xp - a.xp).slice(0, 3);
    // your own typical day: the median of your last 28 active days (not counting today)
    const past = dayList.filter((d) => d.idx < todayIdx).slice(-28).map((d) => d.runs).sort((a, b) => a - b);
    const medianDay = past.length ? (past.length % 2 ? past[(past.length - 1) / 2] : Math.round((past[past.length / 2 - 1] + past[past.length / 2]) / 2)) : 0;
    // personal records, for when there is no one else on the Board
    const bestDay = dayList.reduce((b, d) => (!b || d.points > b.points ? d : b), null);
    let bestWeek = null;
    for (const d of dayList) {
      const inWin = dayList.filter((x) => x.idx > d.idx - 7 && x.idx <= d.idx);
      const pts = inWin.reduce((a, x) => a + x.points, 0);
      if (!bestWeek || pts > bestWeek.points) bestWeek = { points: pts, runs: inWin.reduce((a, x) => a + x.runs, 0), to: d.key, from: inWin[0].key, toIdx: d.idx };
    }
    // the race chart: points per local day, the 7 days of your best week and the last 7 days (today last)
    const ptsByIdx = new Map(dayList.map((d) => [d.idx, d.points]));
    const dayPts = (endIdx) => { const out = []; for (let i = 6; i >= 0; i--) out.push(ptsByIdx.get(endIdx - i) || 0); return out; };
    if (bestWeek) { bestWeek.days = dayPts(bestWeek.toIdx); delete bestWeek.toIdx; }
    const lastDays = dayPts(todayIdx);
    const mostSubs = honest.reduce((b, c) => (!b || (c.subagents || 0) > (b.subagents || 0) ? c : b), null);
    const thisWeekPts = list.filter((c) => c.bornAt >= weekAgo).reduce((a, c) => a + runPoints(c), 0);

    return {
      version: SXV,
      list: out,
      totalLevel: total,
      maxTotalLevel: SKILL_KEYS.length * MAX_LEVEL,
      maxLevel: MAX_LEVEL,
      bands: SKILL_BANDS.map((b) => ({ key: b.key, name: b.name, from: b.from, color: b.color })),
      totalBand: totalBandFor(total),
      nextTotalBand: nextTotalBand(total),
      totalXp: out.reduce((a, s) => a + s.xp, 0),
      recent,
      milestones: milestones.slice(0, 40),
      trackingSince: since,
      dex: { found: [...dexSeen], first: dexFirst, total: dexTotal },
      engagement: {
        streak: cur,
        bestStreak,
        todayActive: !!today,
        today: { runs: today ? today.runs : 0, minutes: today ? Math.round(today.minutes) : 0 },
        rarestWeek: rarestWeek ? { creatureId: rarestWeek.id, fullName: rarestWeek.fullName, tier: rarestWeek.rarity.tier, durationMs: rarestWeek.durationMs, durationLabel: rarestWeek.durationLabel, bornAt: rarestWeek.bornAt } : null,
        weekGains,
        activeDays: dayList.length,
        medianDay,
        records: {
          bestDay: bestDay ? { day: bestDay.key, runs: bestDay.runs, minutes: Math.round(bestDay.minutes), points: bestDay.points } : null,
          bestWeek,
          thisWeek: thisWeekPts,
          lastDays,
          bestStreak,
          longestRun: longest ? { creatureId: longest.id, durationMs: longest.durationMs, durationLabel: longest.durationLabel } : null,
          mostSubagents: mostSubs && mostSubs.subagents ? { creatureId: mostSubs.id, subagents: mostSubs.subagents } : null,
          bestCleanStreak: knownRuns ? bestClean : null,
        },
      },
    };
  }
  function skillName(k) { const s = SKILLS.find((x) => x.key === k); return s ? s.name : k; }

  // a run longer than this almost certainly is a session left open, not work
  const OPEN_SESSION_MS = 24 * 60 * 60 * 1000;

  return {
    SXV, MAX_LEVEL, XP_CURVE, STAR_XP, MAX_STARS,
    xpFor, skillLevelFor, starsFor, progressFor, skillTitle, bandFor, nextBandFor, totalBandFor, nextTotalBand,
    SKILL_BANDS, TOTAL_BANDS, SKILLS, SKILL_KEYS, WORK_KEYS, LEGACY_WORK,
    EXT, CMD, CMD_NEUTRAL, KNOWN_EXTS, KNOWN_CMDS,
    runXpOf, workScores, computeSkillXp, computeOperatorSkills, dayKey, dayIndex, OPEN_SESSION_MS,
    TIER_POINTS, runPoints,
  };
});
