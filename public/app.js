// Proof of Life — one dashboard (Shelf · Proof · Board · Bestiary · Antechamber)

// ---- deterministic RNG (mirror of engine.js) ----
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashString(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
const rngFor = (seed) => mulberry32((seed ^ 0x9e3779b9) >>> 0);

const LEVEL_XP = [0, 100, 250, 500, 900];
const LEVEL_LABELS = ['Newborn', 'Growing', 'Stronger', 'Thriving', 'Fully Raised'];
function levelLabel(c) { if (c.status === 'sick' && (c.level || 1) < 2) return 'Weak & Sick'; return LEVEL_LABELS[Math.min(c.level || 1, LEVEL_LABELS.length) - 1]; }
function xpPct(c) { const l = c.level || 1; if (l >= LEVEL_XP.length) return 1; return Math.max(0, Math.min(1, ((c.xp || 0) - LEVEL_XP[l - 1]) / (LEVEL_XP[l] - LEVEL_XP[l - 1]))); }

// ---- skills: experience by domain, earned from real runs ----
const DOMAIN_LABEL = { cog: 'Engineering', scholar: 'Research', moth: 'Writing', prism: 'Design', lumen: 'Video', hydra: 'Outreach', wisp: 'General' };
const SKILL_TIERS = [0, 150, 400, 800, 1400, 2200, 3200];
const SKILL_TITLES = ['Novice', 'Apprentice', 'Adept', 'Skilled', 'Expert', 'Master', 'Grandmaster'];
const SKILL_COLOR = ['#8b90a0', '#6ee7a5', '#67a8f0', '#b28dff', '#ff7bd0', '#f5c451', '#f5c451'];
const SKILL_TIER_GLYPH = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic', 'Legendary', 'Legendary'];
function skillLevelIdx(xp) { let l = 0; for (let i = 0; i < SKILL_TIERS.length; i++) if (xp >= SKILL_TIERS[i]) l = i; return l; }
function skillPct(xp) { const l = skillLevelIdx(xp); if (l >= SKILL_TIERS.length - 1) return 1; return Math.max(0, Math.min(1, (xp - SKILL_TIERS[l]) / (SKILL_TIERS[l + 1] - SKILL_TIERS[l]))); }
function computeSkills(creatures) {
  const m = {};
  for (const c of creatures) {
    const d = c.domainKey; const s = m[d] || (m[d] = { domain: d, creatures: 0, ms: 0, xp: 0 });
    s.creatures++; s.ms += c.durationMs || 0;
    s.xp += (c.rarity.index + 1) * 20 + Math.min((c.durationMs || 0) / 60000, 60) * 2;
  }
  return Object.values(m).map((s) => { const l = skillLevelIdx(s.xp); s.level = l + 1; s.pct = skillPct(s.xp); return s; }).sort((a, b) => b.xp - a.xp);
}

// ---- color helpers ----
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
function mix(hex, t, a) { const x = hexToRgb(hex), y = hexToRgb(t); return rgbToHex(x[0] + (y[0] - x[0]) * a, x[1] + (y[1] - x[1]) * a, x[2] + (y[2] - x[2]) * a); }
const lighten = (h, a) => mix(h, '#ffffff', a); const darken = (h, a) => mix(h, '#000000', a);
const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

// ---- shape helpers ----
function blobPoints(cx, cy, r, count, wob, rng, sy) { sy = sy || 1; const p = []; for (let i = 0; i < count; i++) { const a = (Math.PI * 2 * i) / count, rr = r * (1 - wob + rng() * wob * 2); p.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * sy }); } return p; }
function smoothClosedPath(pts) { const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); const m0 = mid(pts[pts.length - 1], pts[0]); let d = `M ${m0.x.toFixed(1)} ${m0.y.toFixed(1)} `; for (let i = 0; i < pts.length; i++) { const c = pts[i], n = pts[(i + 1) % pts.length], m = mid(c, n); d += `Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${m.x.toFixed(1)} ${m.y.toFixed(1)} `; } return d + 'Z'; }
const polyPath = (pts) => 'M ' + pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') + ' Z';

// ---- species + rarity (client mirror, for demo creatures) ----
const SPECIES = {
  cog: { name: 'Cog', archetype: 'round', palette: { body: '#7d8aa5', belly: '#aeb9d0', accent: '#f2b545', eye: '#12151d', glow: '#8fa2c9' } },
  scholar: { name: 'Scholar', archetype: 'tall', palette: { body: '#3f9c9c', belly: '#bfeaea', accent: '#efe6c8', eye: '#0e1a1a', glow: '#65d6d6' } },
  moth: { name: 'Moth', archetype: 'winged', palette: { body: '#c98598', belly: '#f3dfe4', accent: '#efe0c4', eye: '#2a1620', glow: '#e6a3b6' } },
  prism: { name: 'Prism', archetype: 'facet', palette: { body: '#63c7f0', belly: '#dff4ff', accent: '#ffffff', eye: '#0b2230', glow: '#7bd6ff' } },
  lumen: { name: 'Lumen', archetype: 'blob', palette: { body: '#e59a3d', belly: '#ffd99a', accent: '#fff2d0', eye: '#2b1608', glow: '#ffb959' } },
  hydra: { name: 'Hydra', archetype: 'round', palette: { body: '#4bbf7a', belly: '#c8f0d8', accent: '#eafff1', eye: '#0d2417', glow: '#67e39a' } },
  wisp: { name: 'Wisp', archetype: 'blob', palette: { body: '#8f7bd6', belly: '#d9cff5', accent: '#efe8ff', eye: '#1a1330', glow: '#a48ff0' } },
};
const TIERC = { Common: '#8b90a0', Uncommon: '#6ee7a5', Rare: '#67a8f0', Epic: '#b28dff', Mythic: '#ff7bd0', Legendary: '#f5c451' };
const TIERI = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Mythic: 4, Legendary: 5 };
function featuresFor(sk, idx, o) { o = o || {}; return { eyes: sk === 'hydra' ? 3 : sk === 'scholar' ? 2 : (idx >= 3 ? 2 : 1), antennae: (sk === 'moth' || sk === 'wisp') ? 2 : (idx >= 1 ? 1 : 0), wings: sk === 'moth' || idx >= 4, horns: (sk === 'cog' || sk === 'hydra') && idx >= 2, spots: Math.min(idx, 4), crown: o.crown != null ? o.crown : idx >= 5, orbiters: o.orbiters || 0, scar: !!o.scar, glow: sk === 'lumen' || idx >= 3 || !!o.glow }; }
function demoCreature(name, sk, tier, o) {
  o = o || {}; const sp = SPECIES[sk] || SPECIES.wisp; const idx = TIERI[tier] != null ? TIERI[tier] : 2;
  const palette = Object.assign({}, sp.palette); let bg = '#141821';
  if ((o.traits || []).includes('Nightshift')) { bg = '#0c0e16'; palette.glow = '#8f7bff'; }
  if (o.status === 'sick') palette.overlay = '#6f8f5a';
  return { seed: hashString(name + '|' + sk + '|' + tier + '|' + (o.salt || '')), fullName: name, speciesKey: sk, speciesName: sp.name, archetype: sp.archetype, rarity: { tier, index: idx, chip: TIERC[tier] || '#8b90a0' }, palette, bg, traits: o.traits || [], features: featuresFor(sk, idx, o), status: o.status || 'healthy', level: o.level || 1, durationLabel: o.durationLabel || '' };
}

// ---- the creature drawing (refined) ----
function creatureInner(c, rng) {
  const p = c.palette, cx = 100, cy = 110, idx = c.rarity.index;
  const baseR = 43 + Math.min(idx, 5) * 3.5;
  const sid = (c.seed >>> 0).toString(36);
  const q = [];
  q.push(`<defs>
    <radialGradient id="bg-${sid}" cx="40%" cy="30%" r="78%"><stop offset="0%" stop-color="${lighten(p.body, 0.44)}"/><stop offset="55%" stop-color="${p.body}"/><stop offset="100%" stop-color="${darken(p.body, 0.38)}"/></radialGradient>
    <radialGradient id="be-${sid}" cx="50%" cy="28%" r="78%"><stop offset="0%" stop-color="${lighten(p.belly, 0.28)}"/><stop offset="100%" stop-color="${darken(p.belly, 0.14)}"/></radialGradient>
    <radialGradient id="gl-${sid}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${p.glow}" stop-opacity="0.5"/><stop offset="100%" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="ey-${sid}" cx="40%" cy="32%" r="72%"><stop offset="0%" stop-color="${lighten(p.eye, 0.5)}"/><stop offset="55%" stop-color="${p.eye}"/><stop offset="100%" stop-color="${darken(p.eye, 0.3)}"/></radialGradient>
  </defs>`);
  if (c.features.glow) q.push(`<circle cx="${cx}" cy="${cy}" r="${baseR + 30}" fill="url(#gl-${sid})"/>`);
  q.push(`<ellipse cx="${cx}" cy="${(cy + baseR * 1.06).toFixed(1)}" rx="${(baseR * 0.8).toFixed(1)}" ry="${(baseR * 0.14).toFixed(1)}" fill="#05070c" opacity="0.4"/>`);
  if (c.features.wings) { q.push(`<ellipse cx="${cx - baseR * 0.72}" cy="${cy}" rx="${baseR * 0.6}" ry="${baseR * 0.96}" fill="${p.accent}" opacity="0.4" transform="rotate(-20 ${cx - baseR * 0.72} ${cy})"/>`); q.push(`<ellipse cx="${cx + baseR * 0.72}" cy="${cy}" rx="${baseR * 0.6}" ry="${baseR * 0.96}" fill="${p.accent}" opacity="0.4" transform="rotate(20 ${cx + baseR * 0.72} ${cy})"/>`); }
  for (let i = 0; i < c.features.orbiters; i++) { const a = (Math.PI * 2 * i) / c.features.orbiters; q.push(`<circle cx="${(cx + Math.cos(a) * (baseR + 24)).toFixed(1)}" cy="${(cy + Math.sin(a) * (baseR + 24)).toFixed(1)}" r="4.5" fill="${p.glow}"/>`); }
  // feet
  q.push(`<ellipse cx="${(cx - baseR * 0.34).toFixed(1)}" cy="${(cy + baseR * 0.9).toFixed(1)}" rx="${(baseR * 0.2).toFixed(1)}" ry="${(baseR * 0.13).toFixed(1)}" fill="${darken(p.body, 0.2)}"/>`);
  q.push(`<ellipse cx="${(cx + baseR * 0.34).toFixed(1)}" cy="${(cy + baseR * 0.9).toFixed(1)}" rx="${(baseR * 0.2).toFixed(1)}" ry="${(baseR * 0.13).toFixed(1)}" fill="${darken(p.body, 0.2)}"/>`);
  // body
  const sy = c.archetype === 'tall' ? 1.22 : 1;
  const wob = c.archetype === 'round' ? 0.05 : c.archetype === 'facet' ? 0.17 : 0.11;
  const pts = blobPoints(cx, cy, baseR, 14, wob, rng, sy);
  const bodyPath = c.archetype === 'facet' ? polyPath(pts) : smoothClosedPath(pts);
  q.push(`<path d="${bodyPath}" fill="url(#bg-${sid})" stroke="${darken(p.body, 0.44)}" stroke-width="1.4"/>`);
  q.push(`<ellipse cx="${(cx - baseR * 0.18).toFixed(1)}" cy="${(cy - baseR * 0.54).toFixed(1)}" rx="${(baseR * 0.44).toFixed(1)}" ry="${(baseR * 0.19).toFixed(1)}" fill="${lighten(p.body, 0.55)}" opacity="0.28"/>`);
  q.push(`<ellipse cx="${cx}" cy="${(cy + baseR * 0.32).toFixed(1)}" rx="${(baseR * 0.54).toFixed(1)}" ry="${(baseR * 0.42).toFixed(1)}" fill="url(#be-${sid})" opacity="0.9"/>`);
  for (let i = 0; i < c.features.spots; i++) { const a = rng() * Math.PI * 2, rr = rng() * baseR * 0.48; q.push(`<circle cx="${(cx + Math.cos(a) * rr).toFixed(1)}" cy="${(cy - baseR * 0.14 + Math.sin(a) * rr * 0.7).toFixed(1)}" r="${(3 + rng() * 3).toFixed(1)}" fill="${darken(p.body, 0.18)}" opacity="0.45"/>`); }
  // eyes
  const n = c.features.eyes, spread = n > 1 ? baseR * 0.44 : 0;
  for (let i = 0; i < n; i++) {
    const ex = cx + (n === 1 ? 0 : -spread + (2 * spread * i) / (n - 1)), ey = cy - baseR * 0.04, er = 10 + Math.min(idx, 5) * 0.5;
    q.push(`<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="${er.toFixed(1)}" fill="url(#ey-${sid})"/>`);
    q.push(`<circle cx="${(ex - er * 0.33).toFixed(1)}" cy="${(ey - er * 0.36).toFixed(1)}" r="${(er * 0.26).toFixed(1)}" fill="#fff" opacity="0.92"/>`);
    q.push(`<circle cx="${(ex + er * 0.3).toFixed(1)}" cy="${(ey + er * 0.32).toFixed(1)}" r="${(er * 0.11).toFixed(1)}" fill="#fff" opacity="0.5"/>`);
  }
  // cheeks
  q.push(`<ellipse cx="${(cx - baseR * 0.44).toFixed(1)}" cy="${(cy + baseR * 0.16).toFixed(1)}" rx="${(baseR * 0.13).toFixed(1)}" ry="${(baseR * 0.08).toFixed(1)}" fill="#ff9db0" opacity="0.26"/>`);
  q.push(`<ellipse cx="${(cx + baseR * 0.44).toFixed(1)}" cy="${(cy + baseR * 0.16).toFixed(1)}" rx="${(baseR * 0.13).toFixed(1)}" ry="${(baseR * 0.08).toFixed(1)}" fill="#ff9db0" opacity="0.26"/>`);
  // mouth
  if (c.status === 'sick') q.push(`<path d="M${cx - 9} ${(cy + baseR * 0.34).toFixed(1)} q9 -6 18 0" stroke="${darken(p.body, 0.5)}" stroke-width="2.2" fill="none" opacity="0.75" stroke-linecap="round"/>`);
  else q.push(`<path d="M${cx - 9} ${(cy + baseR * 0.3).toFixed(1)} q9 8 18 0" stroke="${darken(p.body, 0.5)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
  // antennae / horns / crown / scar / sick
  for (let i = 0; i < c.features.antennae; i++) { const d = i === 0 ? -1 : 1, ax = cx + d * baseR * 0.35, ay = cy - baseR * 0.98, tx = ax + d * 10, ty = ay - 16; q.push(`<path d="M${(cx + d * baseR * 0.3).toFixed(1)} ${(cy - baseR * 0.8).toFixed(1)} Q${ax.toFixed(1)} ${ay.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}" stroke="${darken(p.body, 0.15)}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`); q.push(`<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="4.5" fill="${p.accent}"/>`); }
  if (c.features.horns) { q.push(`<path d="M${(cx - baseR * 0.5).toFixed(1)} ${(cy - baseR * 0.66).toFixed(1)} l6 -18 l8 14 z" fill="${lighten(p.accent, 0.1)}"/>`); q.push(`<path d="M${(cx + baseR * 0.5).toFixed(1)} ${(cy - baseR * 0.66).toFixed(1)} l-6 -18 l-8 14 z" fill="${lighten(p.accent, 0.1)}"/>`); }
  if (c.features.crown) q.push(`<path d="M${cx - 20} ${(cy - baseR - 8).toFixed(1)} l8 -16 l8 12 l8 -16 l8 16 z" fill="${c.rarity.chip}" stroke="${darken(c.rarity.chip, 0.2)}" stroke-width="1"/>`);
  if (c.features.scar) q.push(`<path d="M${(cx - baseR * 0.42).toFixed(1)} ${cy - 8} l${(baseR * 0.8).toFixed(1)} 24" stroke="#e04a4a" stroke-width="2.4" stroke-dasharray="4 3" stroke-linecap="round"/>`);
  if (c.status === 'sick' && p.overlay) { q.push(`<path d="${bodyPath}" fill="${p.overlay}" opacity="0.2"/>`); q.push(`<path d="M${(cx + baseR * 0.55).toFixed(1)} ${(cy - baseR * 0.2).toFixed(1)} q4 8 0 12 q-4 -4 0 -12" fill="#9fd0ff" opacity="0.8"/>`); }
  return q.join('');
}
function creatureSVG(c, size) { return `<svg class="art" viewBox="0 0 200 220" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${creatureInner(c, rngFor(c.seed))}</svg>`; }
let ART = {};
async function loadArt() { try { const m = await (await fetch('/creatures/manifest.json')).json(); ART = (m && m.species) || {}; } catch { ART = {}; } }
function creatureVisual(c, size) { const a = ART[c.speciesKey + '_' + c.rarity.tier.toLowerCase()] || ART[c.speciesKey]; if (!a) return creatureSVG(c, size); return `<svg class="art" viewBox="0 0 200 220" width="${size}" height="${size}"><image href="/creatures/${a}" x="16" y="8" width="168" height="188" preserveAspectRatio="xMidYMid meet"/></svg>`; }

// ---- shared bits ----
const initials = (h) => (h || '?').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
function tileHTML(c) {
  const care = c.status === 'sick' ? `<div class="care">needs care · a few good tasks will heal it</div>` : c.status === 'healed' ? `<div class="care healed">healed ✓</div>` : '';
  return `<div class="tile ${!firstLoad && !known.has(c.id) ? 'new' : ''}" data-id="${c.id}">
    <span class="rchip" style="color:${c.rarity.chip}">${c.rarity.tier}</span>
    ${c.att ? `<span class="verified" title="real · verified">✓</span>` : ''}
    ${creatureVisual(c, 128)}
    <div class="nm">${escapeXml(c.fullName)}</div>
    <div class="sub">${escapeXml(c.speciesName)} · grew from a ${c.durationLabel} task${c.toolCalls ? ' · ' + c.toolCalls + ' tool calls' : ''}</div>
    <div class="lvl"><span>Lv ${c.level || 1} · ${escapeXml(levelLabel(c))}</span><div class="xp"><i style="width:${Math.round(xpPct(c) * 100)}%"></i></div></div>
    ${care}</div>`;
}
function mcardHTML(c, origin) {
  return `<div class="mcard" ${c.id ? `data-id="${c.id}"` : ''}>
    <span class="rchip" style="color:${c.rarity.chip}">${c.rarity.tier}</span>
    ${creatureSVG(c, 118)}
    <div class="nm">${escapeXml(c.fullName)}</div>
    <div class="origin">${escapeXml(origin)}</div></div>`;
}
function findCreature(id) { return latest.creatures.find((c) => c.id === id) || ((bestiaryData && bestiaryData.breeds) || []).find((c) => c.id === id) || null; }

// ---- data ----
let latest = { creatures: [], eggs: [], me: null, stats: { total: 0, machineHours: 0, sick: 0 } };
let boardData = [];
let bestiaryData = null;
let cfState = { a: null, b: null, result: null };
let pubInfo = null;
let known = new Set();
let firstLoad = true;

// ---- icons ----
const IC = {
  shelf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  proof: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21C7 17 3 13.7 3 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 9 2.6c0 4.1-4 7.4-9 11.4z"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="14"/></svg>',
  bestiary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/></svg>',
  antechamber: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15.5" cy="12" r="1"/></svg>',
  skills: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l5-5 4 4 7-8"/><path d="M20 6h-4"/><path d="M20 6v4"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/></svg>',
};

const PRIMARY_KEYS = ['home', 'collection'];
const SECTIONS = [
  { key: 'home', label: 'Home', icon: IC.home, eyebrow: '', title: 'Your Creatures', render: sec_home },
  { key: 'collection', label: 'Collection', icon: IC.shelf, eyebrow: '', title: 'Your Collection', render: sec_collection },
  { key: 'skills', label: 'Skills', icon: IC.skills, eyebrow: 'What you gain', title: 'Your Skills', render: sec_skills },
  { key: 'board', label: 'Leaderboard', icon: IC.board, eyebrow: 'Compare', title: 'Leaderboard', render: sec_board },
  { key: 'bestiary', label: 'Bestiary', icon: IC.bestiary, eyebrow: 'Rare species', title: 'The Bestiary', render: sec_bestiary },
  { key: 'proof', label: 'How it works', icon: IC.proof, eyebrow: '', title: 'How it works', render: sec_proof },
  { key: 'lounge', label: 'Lounge', icon: IC.antechamber, eyebrow: '', title: 'The Lounge', render: sec_antechamber },
];
let current = 'home';
let moreOpen = false;

// ---- egg (a creature growing while Claude works) ----
function eggBox(e) {
  const col = (SPECIES[e.domainKey] || SPECIES.wisp).palette.glow;
  return `<div class="egg" data-start="${e.startedAt}"><div class="shell"><div class="warm" style="background:${col}"></div></div><div><b>a creature is growing</b><div>Claude is working · <span class="timer">0s</span></div></div></div>`;
}

// ---- section: home (the friendly default) ----
function sec_home() {
  const cs = latest.creatures;
  const welcome = welcomed() ? '' : `<div class="welcome"><button class="wx" id="wx" title="dismiss">✕</button><h2>Meet your creatures</h2><p>Every time Claude works on a task for you, a little creature is born. The longer and harder the task, the rarer it is. Just keep using Claude, and come back to watch your collection grow.</p></div>`;
  const growing = latest.eggs.length
    ? `<div class="eggs">${latest.eggs.map(eggBox).join('')}</div>`
    : `<p class="muted" style="margin:2px 0 0">Nothing is hatching right now. Next time Claude works on a task, a new creature starts to grow here.</p>`;
  const newest = cs[0];
  const hero = newest ? `<div class="home-hero">${creatureVisual(newest, 132)}<div><span class="eyebrow">Newest arrival</span><h2 style="font-size:21px;margin:3px 0">${escapeXml(newest.fullName)}</h2><div class="note">${escapeXml(newest.speciesName)} · grew from a ${newest.durationLabel} task${newest.toolCalls ? ' · ' + newest.toolCalls + ' tool calls' : ''}</div><div class="chips" style="margin-top:8px"><span class="chip" style="color:${newest.rarity.chip}">${newest.rarity.tier}</span><span class="trait">Lv ${newest.level || 1} · ${escapeXml(levelLabel(newest))}</span></div></div></div>` : `<p class="muted" style="margin-top:12px">Your first creature will appear here.</p>`;
  const preview = cs.length
    ? `<div class="p-head"><h2>Your creatures</h2><span class="note link" id="seeall">see all ${cs.length} →</span></div><div class="shelf">${cs.slice(0, 8).map(tileHTML).join('')}</div>`
    : `<p class="empty">No creatures yet. The next time Claude does a task for you, your first one is born.</p>`;
  return `${welcome}
    <div class="grid cols-2">
      <div class="panel"><div class="p-head"><h2>Growing now</h2></div>${growing}</div>
      <div class="panel tinted"><div class="stats-row"><div class="stat"><b>${cs.length}</b><span>creatures</span></div><div class="stat"><b>${latest.stats.machineHours}</b><span>hours Claude worked</span></div><div class="stat"><b>${latest.stats.sick}</b><span>need care</span></div></div>${hero}</div>
    </div>
    <div class="panel" style="margin-top:16px">${preview}</div>`;
}

// ---- section: collection (all your creatures) ----
function sec_collection() {
  const cs = latest.creatures;
  if (!cs.length) return `<p class="empty">No creatures yet. The next time Claude does a task for you, your first one is born.</p>`;
  return `<div class="p-head"><h2>Your collection</h2><span class="note">${cs.length} creatures, each grew from a real Claude task</span></div><div class="shelf">${cs.map(tileHTML).join('')}</div>`;
}
function welcomed() { try { return localStorage.getItem('pol_welcomed') === '1'; } catch { return false; } }

// ---- section: proof (the wedge) ----
function sec_proof() {
  const good = demoCreature('Overnight Whale', 'scholar', 'Epic', { salt: 'good' });
  const bad = demoCreature('Flaky Gremlin', 'cog', 'Common', { status: 'sick', scar: true, salt: 'bad' });
  const heroes = `<div class="hero2">
    <div class="hcard"><span class="eyebrow">Successful overnight run · 4+ hours</span>
      <div class="flow" style="margin-top:10px"><div class="egg"><div class="shell"><div class="warm" style="background:#65d6d6"></div></div></div><span class="arrow">→</span>${creatureSVG(good, 96)}</div>
      <div class="rundata">run    #07F9C2A<br>duration  4h 12m<br>status   success ✓</div>
      <div class="verdict">Hatched <b class="tag-rare">RARE</b> · high score potential</div></div>
    <div class="hcard"><span class="eyebrow">Flaky failed run · failed / flaky</span>
      <div class="flow" style="margin-top:10px"><div class="egg"><div class="shell"><div class="warm" style="background:#e8615b"></div></div></div><span class="arrow">→</span>${creatureSVG(bad, 96)}</div>
      <div class="rundata">run    #A30D8E<br>duration  0h 22m<br>status   failed ✗</div>
      <div class="verdict">Hatched <b class="tag-sick">SICK</b> · needs your care</div></div>
  </div>`;

  const ladder = ['Weak & Sick', 'Healing', 'Stronger', 'Thriving', 'Fully Raised'].map((lab, i) => {
    const c = demoCreature('Ladder', 'hydra', 'Rare', { salt: 'L', status: i === 0 ? 'sick' : 'healthy', level: i + 1, crown: i === 4, scar: true });
    return `<div class="rung">${creatureSVG(c, i >= 3 ? 96 : 82)}<div class="rname">Level ${i + 1}</div><div class="rl">${lab}</div></div>`;
  }).join('');

  const how = ['You run Claude Code, nothing else to install', 'Hooks capture the truth of every run', 'A creature is born from what actually happened', 'It carries your scars from failed runs', 'You raise it across future successes', 'No fakery, no buying, only proof'];
  const hooks = `<div class="hooks">
    <div class="hook">UserPromptSubmit</div><span class="arrow">→</span>
    <div class="hook">Stop</div><span class="arrow">→</span>
    <div class="hook">SubagentStop</div><span class="arrow">→</span>
    <div class="hook born">Proof of Life born</div></div>`;

  // survivor spotlight = your highest creature (level then rarity)
  const mine = latest.creatures.slice().sort((a, b) => (b.level || 1) - (a.level || 1) || b.rarity.index - a.rarity.index)[0];
  const survivor = mine ? `<div class="survivor">
    <div style="text-align:center">${creatureVisual(mine, 180)}<div class="mono" style="color:var(--faint);font-size:11px;margin-top:6px">#${escapeXml(mine.att ? mine.att.fp : mine.id.slice(-8).toUpperCase())} ${mine.att ? '<span class="verified inline" title="signed">✓</span>' : ''}</div></div>
    <div><span class="eyebrow">Survivor spotlight</span><h2 style="font-size:22px;margin:4px 0 2px">${escapeXml(mine.fullName)}</h2>
      <div class="note" style="margin:0 0 12px">Lv ${mine.level || 1} · ${escapeXml(levelLabel(mine))} · ${escapeXml(mine.speciesName)}</div>
      <div class="sv-stats">
        <div class="stat"><b>${latest.creatures.length}</b><span>runs survived</span></div>
        <div class="stat"><b>${latest.stats.machineHours}</b><span>machine hours</span></div>
        <div class="stat"><b>${latest.me ? latest.me.score : 0}</b><span>flex score</span></div>
        <div class="stat"><b>${latest.me ? latest.me.scars : 0}</b><span>scars collected</span></div>
      </div>
      <div class="scars-grid">${Array.from({ length: Math.min(12, (latest.me && latest.me.scars) || 0) }).map(() => '<div class="scar-dot">✕</div>').join('') || '<span class="note">no scars yet, clean record</span>'}</div>
      <div class="quote">"Every scar is a story. Every story is proof."</div></div></div>`
    : `<p class="empty">Your survivor spotlight appears once your first creature hatches.</p>`;

  const prov = `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Provenance</h2><span class="note">proof of work life</span></div>
    <div class="stats-row"><div class="stat"><b>${pubInfo ? pubInfo.signed : '—'}</b><span>signed creatures</span></div><div class="stat"><b class="mono" style="font-size:14px">${pubInfo ? escapeXml(pubInfo.fingerprint.slice(0, 12)) : '—'}</b><span>attestor key</span></div><div class="stat"><b>ed25519</b><span>algorithm</span></div></div>
    <p class="note" style="margin-top:12px">Every creature carries an Ed25519 signature over its run's real facts: owner, duration, domain, rarity, seed. Change any one and the signature breaks. Rarity is not claimed, it is cryptographically proven, which is what makes the flex impossible to fake. Open any creature and hit Verify.</p></div>`;

  return `<div class="grid cols-2">
    <div class="panel tinted">${heroes}</div>
    <div class="panel"><div class="p-head"><h2>How it works</h2></div><ul class="bullets">${how.map((h) => `<li><span class="b-ico">◆</span>${escapeXml(h)}</li>`).join('')}</ul><div class="divider"></div><span class="eyebrow">Built on Claude Code hooks</span><div style="margin-top:12px">${hooks}</div></div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="p-head"><h2>Raise it across future successes</h2><span class="note">every good run adds XP to the whole herd</span></div><div class="ladder">${ladder}</div></div>
  <div class="panel" style="margin-top:16px">${survivor}</div>
  ${prov}`;
}

// ---- section: skills ----
function skillBar(s) {
  const title = SKILL_TITLES[s.level - 1], col = SKILL_COLOR[s.level - 1];
  const next = s.level >= SKILL_TITLES.length ? 'mastered' : `${Math.round(SKILL_TIERS[s.level] - s.xp)} xp to ${SKILL_TITLES[s.level]}`;
  const glyph = demoCreature(DOMAIN_LABEL[s.domain] || s.domain, s.domain, SKILL_TIER_GLYPH[s.level - 1], { crown: s.level >= 6, salt: 'sk' });
  return `<div class="skill">
    <div class="skill-glyph">${creatureSVG(glyph, 52)}</div>
    <div class="skill-body">
      <div class="skill-top"><span class="skill-name">${escapeXml(DOMAIN_LABEL[s.domain] || s.domain)} <span class="skill-title" style="color:${col}">${title}</span></span><span class="skill-lvl">Lv ${s.level}</span></div>
      <div class="skill-bar"><i style="width:${Math.round(s.pct * 100)}%;background:linear-gradient(90deg,${SKILL_COLOR[Math.max(0, s.level - 2)]},${col})"></i></div>
      <div class="skill-meta">${s.creatures} creatures · ${(s.ms / 3600000).toFixed(1)}h · ${Math.round(s.xp)} xp · ${next}</div>
    </div></div>`;
}
function sec_skills() {
  const cs = latest.creatures;
  if (!cs.length) return `<p class="empty">Run some agents and your skills will start filling in.</p>`;
  const skills = computeSkills(cs);
  const totalXp = Math.round(skills.reduce((a, s) => a + s.xp, 0));
  const operatorLevel = skills.reduce((a, s) => a + s.level, 0);
  const top = skills[0];
  const header = `<div class="grid cols-2">
    <div class="panel tinted"><span class="eyebrow">Experience</span>
      <div class="stats-row" style="margin-top:12px">
        <div class="stat"><b>${totalXp}</b><span>total xp</span></div>
        <div class="stat"><b>${operatorLevel}</b><span>operator level</span></div>
        <div class="stat"><b>${cs.length}</b><span>runs</span></div>
        <div class="stat"><b>${latest.stats.machineHours}</b><span>machine hrs</span></div></div>
      <p class="note" style="margin-top:12px">Every run pours experience into the skill it exercised. Your rarest and longest runs give the most. Level a skill from Novice to Grandmaster.</p></div>
    <div class="panel"><span class="eyebrow">Signature skill</span>
      <div style="display:flex;gap:16px;align-items:center;margin-top:10px">${creatureSVG(demoCreature(DOMAIN_LABEL[top.domain], top.domain, SKILL_TIER_GLYPH[top.level - 1], { crown: top.level >= 6, salt: 'sig' }), 104)}
        <div><h2 style="font-size:22px">${escapeXml(DOMAIN_LABEL[top.domain])}</h2><div class="note" style="margin-top:4px">${SKILL_TITLES[top.level - 1]} · Lv ${top.level}</div><div class="note">${top.creatures} creatures · ${Math.round(top.xp)} xp</div></div></div></div>
  </div>`;
  return header + `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Skills</h2><span class="note">experience by domain, earned from real runs</span></div><div class="skills">${skills.map(skillBar).join('')}</div></div>`;
}

// ---- section: board ----
function sec_board() {
  const rows = boardData.map((r) => `<div class="brow ${r.you ? 'you' : ''}" data-handle="${escapeXml(r.handle)}">
    <div class="rank">${r.rank}</div><div class="ava" style="background:${r.accent || '#67e39a'}">${initials(r.handle)}</div>
    <div class="who"><b>@${escapeXml(r.handle)}</b><span>${r.runs} runs · ${r.hours} hrs · ${escapeXml(r.topSpecies || '—')}</span></div>
    <div class="surv">${r.survivors || 0}<span>survivors</span></div>
    <div class="score" style="color:${r.you ? 'var(--green)' : 'var(--ink)'}">${r.score.toFixed(1)}</div></div>`).join('');
  return `<div class="section-lead">The flex is machine hours, not money. Standing is minted from the compute you actually commanded, and it cannot be bought.</div><div class="board">${rows}</div><p class="note">Sample operators seed the board until the network is live. Your row is real. Highest buildable score is 10.</p>`;
}

// ---- section: bestiary (real, computed cross-breeding) ----
function crossfeedPanel() {
  const ops = (bestiaryData && bestiaryData.operators) || [];
  const opt = (sel) => ops.map((o) => `<option value="${o.handle}" ${o.handle === sel ? 'selected' : ''}>@${o.handle}${o.sample ? '' : ' (you)'}</option>`).join('');
  const r = cfState.result;
  let out;
  if (r && r.creature) {
    const c = r.creature;
    out = `${creatureSVG(c, 104)}<div class="nm" style="font-family:var(--serif);margin-top:4px">${escapeXml(c.fullName)}</div><span class="rchip" style="color:${c.rarity.chip};position:static;display:inline-block;margin-top:6px">${c.rarity.tier}</span><div class="note" style="margin-top:6px">${escapeXml(c.speciesName)}<br>bred from ${escapeXml(r.domain)} work</div>`;
  } else {
    out = `<div class="note" style="padding:24px 8px">${r ? escapeXml(r.reason || 'no shared work yet') : 'pick two operators'}</div>`;
  }
  return `<div class="crossfeed">
    <div class="cf-op"><select id="cfa">${opt(cfState.a)}</select><span>operator A</span></div>
    <div class="cf-plus">+</div>
    <div class="cf-op"><select id="cfb">${opt(cfState.b)}</select><span>operator B</span></div>
    <div class="cf-plus">→</div>
    <div class="cf-new">${out}</div></div>`;
}
async function doCrossfeed() {
  cfState.a = document.getElementById('cfa').value;
  cfState.b = document.getElementById('cfb').value;
  try { cfState.result = await (await fetch(`/api/breed?a=${encodeURIComponent(cfState.a)}&b=${encodeURIComponent(cfState.b)}`)).json(); } catch { cfState.result = { none: true, reason: 'error' }; }
  renderActive();
}
function sec_bestiary() {
  const bd = bestiaryData;
  if (!bd) return `<p class="empty">summoning the menagerie…</p>`;
  const net = `<div class="net">
    <div class="n"><b>${bd.network.operators}</b><span>operators</span></div>
    <div class="n"><b>${bd.network.species}</b><span>species discovered</span></div>
    <div class="n"><b>${bd.network.breeds}</b><span>cross-fed breeds</span></div>
    <p class="note" style="margin:2px 0 0">No single tool vendor can bolt on a shared registry across vendors. That is the moat.</p></div>`;
  const menagerie = (bd.breeds.map((c) => mcardHTML(c, 'bred by @' + c.bredBy[0] + ' + @' + c.bredBy[1])).join('') + latest.creatures.slice(0, 3).map((c) => mcardHTML(c, 'you · solo · ' + c.durationLabel + ' run')).join('')) || '<p class="note">No creatures yet.</p>';
  const duos = bd.duos.map((d) => `<div class="ritual"><div><b>${escapeXml(d.species)}</b><span>@${escapeXml(d.pair[0])} + @${escapeXml(d.pair[1])} · ${escapeXml(d.domain)} work</span></div><span class="rchip" style="color:${d.chip};position:static">${d.tier}</span></div>`).join('') || '<p class="note">none yet</p>';
  const principles = [['Co-created', 'Rare species need two operators whose real work collided.'], ['Shared & open', 'One public menagerie, all operators, one registry.'], ['Impossible to fabricate', 'Every parent is Ed25519-signed; a hybrid needs two real signed histories.'], ['Defensible', 'The network gets richer with every operator who joins.']];
  return `<div class="section-lead">Every creature enters one public menagerie where the flex is species, not productivity. The rarest forms exist only when two operators who ran the same domain cross-feed, minting a hybrid neither could make alone. Every number here is computed live from real hook-verified runs.</div>
  <div class="grid cols-2">
    <div class="panel"><div class="p-head"><h2>Cross-feed breeding</h2><span class="note">two operators who share a domain</span></div>${crossfeedPanel()}</div>
    <div class="panel tinted"><div class="p-head"><h2>Network effect</h2></div>${net}</div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="p-head"><h2>The menagerie</h2><span class="note">${bd.breeds.length} cross-fed species · rarest first</span></div><div class="menagerie">${menagerie}</div></div>
  <div class="grid cols-2" style="margin-top:16px">
    <div class="panel"><div class="p-head"><h2>Top breeding duos</h2></div><div class="rituals">${duos}</div></div>
    <div class="panel"><div class="p-head"><h2>Why it is a moat</h2></div><div class="principles" style="margin-top:0;grid-template-columns:1fr 1fr">${principles.map(([b, s]) => `<div class="principle"><b>${b}</b><span>${s}</span></div>`).join('')}</div></div>
  </div>`;
}

// ---- section: antechamber ----
function sec_antechamber() {
  const open = latest.eggs.length > 0;
  const conc = demoCreature('The Concierge', 'scholar', 'Legendary', { crown: true, salt: 'concierge' });
  const hour = new Date().getHours();
  const part = hour < 5 ? 'These are the deep hours. Only the devoted are still running.' : hour < 12 ? 'Good morning. The machines are just waking.' : hour < 18 ? 'Good afternoon. A steady day of work behind you.' : 'Good evening. The fire is lit and the seats are warm.';
  const top = latest.me && latest.me.topSpecies && latest.me.topSpecies !== '—' ? `Mostly ${latest.me.topSpecies.toLowerCase()} work today, I see.` : 'Your first run of the evening, perhaps.';
  const line = open ? `${part} You have ${latest.creatures.length} in your menagerie. ${top} Your agents are running, so the door is open. Sit, the usual seat by the fire.` : `${part} But your agents are still. The door stays shut until the machines are thinking again. Come back mid-run.`;
  const rituals = [['The Sit', '0:00', 'A breath before the wait. Nothing asked of you.'], ['The Quiet Hour', 'mid-run', 'Ambient calm while a long job grinds.'], ['The Debrief', 'on hatch', 'The concierge remarks on what you just made.'], ['After Hours', '3am', 'A rare lounge state only insomniac shippers ever see.']];
  return `<div class="section-lead">Not a place to be productive. A candlelit room that opens only while your agents are genuinely running, where a concierge who knows your day receives you. Rest, ritual, and belonging instead of one more thing to learn.</div>
  <div class="grid cols-2">
    <div class="lounge ${open ? '' : 'closed'}">
      <div class="doorstate">${open ? '● the door is open' : '○ the door is closed'}</div>
      ${creatureSVG(conc, 168)}
      <div class="concierge-name">Barnaby, the Concierge</div>
      <div class="concierge-line">"${line}"</div>
    </div>
    <div>
      <div class="panel"><div class="p-head"><h2>Lounge access</h2></div>
        <div class="net"><div class="n"><b>${latest.eggs.length}</b><span>agents running now</span></div><div class="n"><b>${latest.creatures.length}</b><span>nights on record</span></div><div class="n"><b>${latest.me ? latest.me.score : 0}</b><span>your standing</span></div></div></div>
      <div class="panel" style="margin-top:16px"><div class="p-head"><h2>Tonight's rituals</h2></div><div class="rituals">${rituals.map(([b, t, s]) => `<div class="ritual"><div><b>${b}</b><span>${s}</span></div><div class="t">${t}</div></div>`).join('')}</div></div>
    </div>
  </div>`;
}

// ---- topbar + nav ----
function topRight() {
  const running = latest.eggs.length;
  return `<div class="pill ${running ? '' : 'idle'}"><span class="live"></span>${running ? 'Claude is working' : 'idle'}</div><div class="pill"><b>${latest.creatures.length}</b> creatures</div>`;
}
function renderActive() {
  const sec = SECTIONS.find((s) => s.key === current);
  document.getElementById('tb-eyebrow').textContent = sec.eyebrow || '';
  document.getElementById('tb-title').textContent = sec.title;
  document.getElementById('tb-right').innerHTML = topRight();
  const stage = document.getElementById('stage');
  stage.innerHTML = sec.render();
  stage.querySelectorAll('.tile[data-id], .mcard[data-id]').forEach((el) => el.addEventListener('click', () => openModal(findCreature(el.dataset.id))));
  stage.querySelectorAll('.brow[data-handle]').forEach((el) => el.addEventListener('click', () => openProfile(el.dataset.handle)));
  const cfa = stage.querySelector('#cfa'), cfb = stage.querySelector('#cfb');
  if (cfa) cfa.addEventListener('change', doCrossfeed);
  if (cfb) cfb.addEventListener('change', doCrossfeed);
  const wx = stage.querySelector('#wx'); if (wx) wx.onclick = () => { try { localStorage.setItem('pol_welcomed', '1'); } catch {} renderActive(); };
  const seeall = stage.querySelector('#seeall'); if (seeall) seeall.onclick = () => setSection('collection');
  latest.creatures.forEach((c) => known.add(c.id));
}
function setSection(key) {
  current = key;
  if (!PRIMARY_KEYS.includes(key)) moreOpen = true; // reveal the More group if landing on an advanced page
  buildRail();
  location.hash = key;
  renderActive();
}
function buildRail() {
  const item = (s) => `<button class="rbtn ${s.key === current ? 'active' : ''}" data-key="${s.key}">${s.icon}<span class="rlabel">${s.label}</span></button>`;
  const primary = SECTIONS.filter((s) => PRIMARY_KEYS.includes(s.key)).map(item).join('');
  const advanced = SECTIONS.filter((s) => !PRIMARY_KEYS.includes(s.key)).map(item).join('');
  document.getElementById('rail').innerHTML = primary +
    `<button class="more-toggle" id="moreToggle">More <span class="chev">${moreOpen ? '▴' : '▾'}</span></button>` +
    `<div class="more-items" ${moreOpen ? '' : 'hidden'}>${advanced}</div>`;
  document.querySelectorAll('.rbtn').forEach((b) => b.addEventListener('click', () => setSection(b.dataset.key)));
  document.getElementById('moreToggle').addEventListener('click', () => { moreOpen = !moreOpen; buildRail(); });
  document.getElementById('mark').innerHTML = creatureSVG(demoCreature('mark', 'hydra', 'Epic', { crown: false, salt: 'mk' }), 32) + '<span class="mark-txt">Proof of Life</span>';
}

// ---- profiles (open in a modal) ----
async function openProfile(handle) {
  try {
    const p = await (await fetch('/api/profile?handle=' + encodeURIComponent(handle))).json();
    if (p.error) return;
    const link = `${location.origin}/#u/${p.handle}`;
    const grid = p.creatures && p.creatures.length ? `<div class="shelf" style="margin-top:12px">${p.creatures.slice(0, 6).map(tileHTML).join('')}</div>` : `<p class="note">${p.you ? 'No creatures yet.' : 'Sample operator. Real creatures appear once the network is live.'}</p>`;
    document.getElementById('modal-card').innerHTML = `<div class="ava big" style="background:${p.accent || '#67e39a'};margin:0 auto">${initials(p.handle)}</div>
      <h3>@${escapeXml(p.handle)} ${p.you ? '<span class="chip" style="color:var(--green)">you</span>' : '<span class="chip" style="color:var(--violet)">sample</span>'}</h3>
      <div class="stats-row" style="justify-content:center;margin:14px 0">
        <div class="stat"><b>${p.score.toFixed(1)}</b><span>flex</span></div><div class="stat"><b>${p.runs}</b><span>runs</span></div><div class="stat"><b>${p.hours}</b><span>hrs</span></div><div class="stat"><b>${p.survivors || 0}</b><span>survivors</span></div></div>
      <div class="pshare"><input id="plink" readonly value="${link}"/><button class="primary" id="copy">Copy link</button>${p.you ? '<button id="edit">Edit</button>' : ''}</div>${grid}
      <div class="btns" style="margin-top:14px"><button id="close">Close</button></div>`;
    document.getElementById('modal').hidden = false;
    document.getElementById('close').onclick = () => (document.getElementById('modal').hidden = true);
    const cp = document.getElementById('copy'); cp.onclick = () => { navigator.clipboard.writeText(link); cp.textContent = 'Copied'; setTimeout(() => (cp.textContent = 'Copy link'), 1400); };
    const ed = document.getElementById('edit'); if (ed) ed.onclick = editIdentity;
    document.getElementById('modal-card').querySelectorAll('.tile[data-id]').forEach((t) => t.addEventListener('click', () => openModal((p.creatures || []).find((c) => c.id === t.dataset.id))));
  } catch (e) {}
}
async function editIdentity() {
  const handle = prompt('Your handle (letters, numbers, underscore):', (latest.me && latest.me.handle) || ''); if (handle == null) return;
  const displayName = prompt('Display name:', (latest.me && latest.me.displayName) || '') || undefined;
  await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle, displayName }) });
  document.getElementById('modal').hidden = true; poll(true);
}

// ---- modal (creature) + toast + card ----
function openModal(c) {
  if (!c) return;
  const rows = [['species', c.speciesName], ['rarity', c.rarity.tier], ['level', `Lv ${c.level || 1} · ${levelLabel(c)}`], ['forged from', c.bredBy ? 'cross-feed · ' + c.domain + ' work' : (c.durationLabel + ' run')], ['traits', c.traits.length ? c.traits.join(', ') : 'none'], ['status', c.status === 'healthy' ? 'healthy' : c.status === 'healed' ? 'healed survivor' : 'sick · needs care'], [c.bredBy ? 'bred by' : 'born', c.bredBy ? '@' + c.bredBy.join(' + @') : new Date(c.bornAt).toLocaleString()]].map(([k, v]) => `<div class="row"><span>${k}</span><span>${escapeXml(v)}</span></div>`).join('');
  const att = `<div class="att"><div class="att-row"><span>attestation</span><span class="mono">${c.att ? c.att.fp + ' · ed25519' : 'unsigned'}</span></div><button id="verify" class="ghost">Verify signature</button><div id="vres" class="vres"></div></div>`;
  document.getElementById('modal-card').innerHTML = creatureVisual(c, 176) + `<h3>${escapeXml(c.fullName)}</h3><div class="rows">${rows}</div>${att}<div class="btns"><button class="primary" id="dl">Save card</button><button id="close">Close</button></div>`;
  document.getElementById('modal').hidden = false;
  document.getElementById('close').onclick = () => (document.getElementById('modal').hidden = true);
  document.getElementById('dl').onclick = () => downloadCard(c);
  const vb = document.getElementById('verify');
  if (vb) vb.onclick = async () => {
    const vres = document.getElementById('vres'); vres.className = 'vres'; vres.textContent = 'checking signature…';
    try {
      const r = await (await fetch('/api/verify?id=' + encodeURIComponent(c.id))).json();
      vres.className = 'vres ' + (r.valid ? 'ok' : 'bad');
      vres.innerHTML = r.valid ? `✓ Verified · signed by attestor ${escapeXml(r.signer || '')}` : `✗ Invalid signature${r.reason ? ' · ' + escapeXml(r.reason) : ''}`;
    } catch { vres.className = 'vres bad'; vres.textContent = 'verify request failed'; }
  };
}
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') e.target.hidden = true; });
// any stuck overlay clears on Escape, and the toast dismisses on click
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { document.getElementById('modal').hidden = true; document.getElementById('toast').hidden = true; } });
document.getElementById('toast').addEventListener('click', () => { document.getElementById('toast').hidden = true; });
let toastTimer = null;
function showToast(c) {
  const el = document.getElementById('toast');
  el.innerHTML = creatureVisual(c, 46) + `<div class="t-txt"><b>${escapeXml(c.fullName)}</b><div>a ${c.rarity.tier} ${c.speciesName} hatched</div></div>`;
  el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 5000);
}
function buildCardSVG(c) {
  const W = 640, H = 800, chip = c.rarity.chip, traits = c.traits.length ? c.traits.join('   ·   ') : 'no traits', bgTop = c.bg === '#0c0e16' ? '#1a1836' : '#20263a';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="bgg" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="${bgTop}"/><stop offset="100%" stop-color="${c.bg}"/></radialGradient></defs><rect width="${W}" height="${H}" rx="28" fill="url(#bgg)"/><rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="22" fill="none" stroke="${chip}" stroke-opacity="0.55" stroke-width="2"/><g transform="translate(170,64) scale(1.5)">${creatureInner(c, rngFor(c.seed))}</g><text x="${W / 2}" y="516" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#f4f2ff">${escapeXml(c.fullName)}</text><text x="${W / 2}" y="552" text-anchor="middle" font-family="system-ui" font-size="18" fill="${chip}">${escapeXml(c.rarity.tier)}   ·   ${escapeXml(c.speciesName)}   ·   Lv ${c.level || 1}</text><text x="${W / 2}" y="596" text-anchor="middle" font-family="system-ui" font-size="16" fill="#9aa3bd">forged from a ${escapeXml(c.durationLabel)} agent run</text><text x="${W / 2}" y="626" text-anchor="middle" font-family="system-ui" font-size="14" fill="#7f88a3">${escapeXml(traits)}</text><text x="${W / 2}" y="726" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="#6b7594">proof of life</text><text x="${W / 2}" y="750" text-anchor="middle" font-family="system-ui" font-size="12" fill="#5f6780">minted from real machine hours</text></svg>`;
}
function downloadCard(c) {
  const img = new Image(), url = URL.createObjectURL(new Blob([buildCardSVG(c)], { type: 'image/svg+xml' }));
  img.onload = () => { const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 1600; const ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0, 640, 800); URL.revokeObjectURL(url); const a = document.createElement('a'); a.download = c.fullName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'; a.href = cv.toDataURL('image/png'); a.click(); };
  img.src = url;
}

// ---- loop ----
let lastSig = '';
async function poll(force) {
  try {
    const [st, bd, be] = await Promise.all([fetch('/api/state').then((r) => r.json()), fetch('/api/board').then((r) => r.json()), fetch('/api/bestiary').then((r) => r.json())]);
    // toast on genuinely new creature
    if (!firstLoad) for (const c of st.creatures) if (!known.has(c.id)) showToast(c);
    latest = st; boardData = bd.board || []; bestiaryData = be;
    if (!cfState.a && be.breeds && be.breeds.length) { cfState.a = be.breeds[0].bredBy[0]; cfState.b = be.breeds[0].bredBy[1]; cfState.result = { creature: be.breeds[0], domain: be.breeds[0].domain }; }
    if (!pubInfo) fetch('/api/pubkey').then((r) => r.json()).then((p) => { pubInfo = p; if (current === 'proof' && document.getElementById('modal').hidden) renderActive(); }).catch(() => {});
    document.getElementById('railme').innerHTML = `<span class="av" style="background:${(st.me && st.me.accent) || '#67e39a'}">${st.me ? initials(st.me.handle) : '?'}</span><span>you</span>`;
    const sig = `${current}|${st.creatures.length}|${st.eggs.length}|${st.me ? st.me.score : 0}|${boardData.length}|${be.network ? be.network.breeds : 0}`;
    if ((force || sig !== lastSig) && document.getElementById('modal').hidden) { lastSig = sig; renderActive(); }
    firstLoad = false;
  } catch (e) {}
}
function tickTimers() {
  document.querySelectorAll('.egg[data-start]').forEach((el) => { const s = Math.round((Date.now() - Number(el.dataset.start)) / 1000), t = el.querySelector('.timer'); if (t) t.textContent = s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'; });
}
function readHash() { const h = location.hash.replace('#', ''); if (h.startsWith('u/')) { setSection('board'); openProfile(h.slice(2)); } else if (SECTIONS.find((s) => s.key === h)) setSection(h); else setSection('home'); }

buildRail();
loadArt().then(() => poll(true)).then(readHash);
setInterval(() => poll(false), 1600);
setInterval(tickTimers, 1000);
