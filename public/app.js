// Proof of Life — one dashboard (Shelf · Proof · Board · Bestiary · Antechamber)

// ---- deterministic RNG (mirror of engine.js) ----
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashString(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
const rngFor = (seed) => mulberry32((seed ^ 0x9e3779b9) >>> 0);

const LEVEL_XP = Array.from({ length: 60 }, (_, i) => (i ? 10 * i * i + 40 : 0)); // the same curve as engine.js
// one growth vocabulary everywhere: the stage names from variants.js (Hatchling, Juvenile, Adult, Elder, Exalted)
function levelLabel(c) { return stageOf(c).name; }
const lvLine = (c) => `Lv ${c.level || 1} · ${stageOf(c).name}`;
function xpPct(c) { const l = c.level || 1; if (l >= LEVEL_XP.length) return 1; return Math.max(0, Math.min(1, ((c.xp || 0) - LEVEL_XP[l - 1]) / (LEVEL_XP[l] - LEVEL_XP[l - 1]))); }

// ---- skills: computed server-side from real runs (skills.js), rendered here ----
const DOMAIN_LABEL = { cog: 'Engineering', scholar: 'Research', moth: 'Writing', prism: 'Design', lumen: 'Video', hydra: 'Outreach', wisp: 'General' };
const fmtN = (n) => Math.round(n || 0).toLocaleString('en-US');

// ---- color helpers ----
function hexToRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
function mix(hex, t, a) { const x = hexToRgb(hex), y = hexToRgb(t); return rgbToHex(x[0] + (y[0] - x[0]) * a, x[1] + (y[1] - x[1]) * a, x[2] + (y[2] - x[2]) * a); }
const lighten = (h, a) => mix(h, '#ffffff', a); const darken = (h, a) => mix(h, '#000000', a);
const lum = (h) => { const [r, g, b] = hexToRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
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
// Mythic is the top tier everywhere
const TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const TIERC = { Common: '#8b90a0', Uncommon: '#6ee7a5', Rare: '#67a8f0', Epic: '#b28dff', Legendary: '#f5c451', Mythic: '#ff7bd0' };
const TIERI = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 };
function featuresFor(sk, idx, o) { o = o || {}; return { eyes: sk === 'hydra' ? 3 : sk === 'scholar' ? 2 : (idx >= 3 ? 2 : 1), antennae: (sk === 'moth' || sk === 'wisp') ? 2 : (idx >= 1 ? 1 : 0), wings: sk === 'moth' || idx >= 4, horns: (sk === 'cog' || sk === 'hydra') && idx >= 2, spots: Math.min(idx, 4), crown: o.crown != null ? o.crown : idx >= 4, orbiters: o.orbiters || 0, scar: !!o.scar, glow: sk === 'lumen' || idx >= 3 || !!o.glow }; }
// a drawn-only creature for the rules pages and skill glyphs. o.vo pins its variant
// (colorway 'classic', accessory, expression...); demo creatures are grown adults by default
function demoCreature(name, sk, tier, o) {
  o = o || {}; const sp = SPECIES[sk] || SPECIES.wisp; const idx = TIERI[tier] != null ? TIERI[tier] : 2;
  const palette = Object.assign({}, sp.palette); let bg = '#141821';
  if ((o.traits || []).includes('Nightshift')) { bg = '#0c0e16'; palette.glow = '#8f7bff'; }
  if (o.status === 'sick') palette.overlay = '#6f8f5a';
  return { seed: hashString(name + '|' + sk + '|' + tier + '|' + (o.salt || '')), fullName: name, speciesKey: sk, speciesName: sp.name, archetype: sp.archetype, rarity: { tier, index: idx, chip: TIERC[tier] || '#8b90a0' }, palette, bg, traits: o.traits || [], features: featuresFor(sk, idx, o), status: o.status || 'healthy', level: o.level || 15, durationLabel: o.durationLabel || '', vo: o.vo || null, demo: true };
}

// ==== ART START: creature renderer (pure, deterministic; the contact-sheet harness slices this block) ====
// One fixed stage (viewBox 0 0 200 220, ground y=196, body radius R=56 for every tier).
// Each species returns its own silhouette + anchors; vinylStack() shades any silhouette as a glossy
// designer toy. On top of that, three things change the look, all read off the creature:
//   the collectible variant (variants.js: colorway, pattern, accessory, expression, eyes, Shiny),
//   the growth stage (its level: hatchling, juvenile, adult, elder),
//   and a visible upgrade at every rarity (pattern+accessory, metal trim+glowing eyes, glowing
//   markings+aura, a full material swap with a species crown, an animated iridescent body).
// Everything comes from seed, tier, traits, status, level and parents, so signatures are untouched.
// Ids end in __I__, which creatureSVG swaps for a per-drawing suffix: two copies of one creature
// on a page never share an id, so neither can borrow (or lose) the other's gradients.
const F = (n) => String(Math.round(n * 10) / 10);
const PV = typeof POLVariants !== 'undefined' ? POLVariants : null;
const ART_PAL = {
  cog: { body: '#6d7a94', belly: '#ffb53d', accent: '#f2b545', glow: '#8fa2c9', iris: '#ffb53d' },
  scholar: { body: '#2f8f8c', belly: '#cdeee8', accent: '#f5c451', glow: '#65d6d6', iris: '#ffcf4a' },
  moth: { body: '#cf87a0', belly: '#f6e7d3', accent: '#f6e7d3', glow: '#e6a3b6', iris: '#ff9ec4' },
  prism: { body: '#5cc4ef', belly: '#bfe9ff', accent: '#ffffff', glow: '#7bd6ff', iris: '#9be8ff' },
  lumen: { body: '#e59a3d', belly: '#ffd99a', accent: '#fff2d0', glow: '#ffb959', iris: '#ffb24a' },
  hydra: { body: '#3fbf74', belly: '#c4ffd9', accent: '#eafff1', glow: '#67e39a', iris: '#9dffbf' },
  wisp: { body: '#8f7bd6', belly: '#d9cff5', accent: '#efe8ff', glow: '#a48ff0', iris: '#c8b8ff' },
};
const NAME2KEY = { Cog: 'cog', Scholar: 'scholar', Moth: 'moth', Prism: 'prism', Lumen: 'lumen', Hydra: 'hydra', Wisp: 'wisp' };
const ST = (a) => a.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
const LG = (id, v, s, x) => `<linearGradient id="${id}" x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}"${x || ''}>${ST(s)}</linearGradient>`;
const RG = (id, v, s) => `<radialGradient id="${id}" cx="${v[0]}" cy="${v[1]}" r="${v[2]}"${v[3] != null ? ` fx="${v[3]}" fy="${v[4]}"` : ''}>${ST(s)}</radialGradient>`;
const pathOf = (pts, close) => 'M' + pts.map((p) => F(p[0]) + ' ' + F(p[1])).join('L') + (close ? 'Z' : '');
const star4 = (x, y, s) => `M${F(x)} ${F(y - s)}Q${F(x)} ${F(y)} ${F(x + s)} ${F(y)}Q${F(x)} ${F(y)} ${F(x)} ${F(y + s)}Q${F(x)} ${F(y)} ${F(x - s)} ${F(y)}Q${F(x)} ${F(y)} ${F(x)} ${F(y - s)}Z`;
const star5 = (x, y, r) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; p.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return pathOf(p, true); };
const heartP = (x, y, s) => `M${F(x)} ${F(y + s * 0.9)}C${F(x - s * 1.25)} ${F(y + s * 0.05)} ${F(x - s * 0.95)} ${F(y - s * 0.95)} ${F(x)} ${F(y - s * 0.35)}C${F(x + s * 0.95)} ${F(y - s * 0.95)} ${F(x + s * 1.25)} ${F(y + s * 0.05)} ${F(x)} ${F(y + s * 0.9)}Z`;
const dropP = (x, y, s) => `M${F(x)} ${F(y)}C${F(x + s * 0.55)} ${F(y + s * 0.75)} ${F(x + s * 0.55)} ${F(y + s * 1.25)} ${F(x)} ${F(y + s * 1.25)}C${F(x - s * 0.55)} ${F(y + s * 1.25)} ${F(x - s * 0.55)} ${F(y + s * 0.75)} ${F(x)} ${F(y)}Z`;
const leafP = (x, y, len, ang, w) => { const a = (ang * Math.PI) / 180, ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, nx = -Math.sin(a) * len * (w || 0.32), ny = Math.cos(a) * len * (w || 0.32), mx = (x + ex) / 2, my = (y + ey) / 2; return `M${F(x)} ${F(y)}Q${F(mx + nx)} ${F(my + ny)} ${F(ex)} ${F(ey)}Q${F(mx - nx)} ${F(my - ny)} ${F(x)} ${F(y)}Z`; };

// static gradients shared by every creature on a page (fixed ids; buildCardSVG inlines them itself)
const HOLO = [[0, '#ff7bd0'], [0.14, '#ffd36b'], [0.28, '#7dffb0'], [0.42, '#6ad8ff'], [0.56, '#b08cff'], [0.7, '#ff7bd0'], [0.84, '#ffd36b'], [1, '#7dffb0']];
const PL_DEFS = [
  RG('pl-cs', ['50%', '50%', '50%'], [[0, '#000', 0.6], [0.6, '#000', 0.25], [1, '#000', 0]]),
  LG('pl-ao', [0, 0, 0, 1], [[0, '#000', 0], [0.58, '#000', 0], [1, '#000', 0.45]]),
  LG('pl-sp', [0, 0, 0, 1], [[0, '#fff', 0.85], [1, '#fff', 0]]),
  RG('pl-shade', ['36%', '26%', '88%', '32%', '22%'], [[0, '#fff', 0.42], [0.22, '#fff', 0.14], [0.55, '#fff', 0], [0.82, '#000', 0.16], [1, '#000', 0.4]]),
  RG('pl-blush', ['50%', '50%', '50%'], [[0, '#ff7d9c', 0.6], [1, '#ff7d9c', 0]]),
  LG('pl-plinth', [0, 0, 0, 1], [[0, '#2c3242'], [1, '#12141b']]),
  LG('pl-gold', [0, 0, 0, 1], [[0, '#fff3b0'], [0.45, '#f5c451'], [0.55, '#c98a12'], [1, '#7a4e06']]),
  LG('pl-gear', [0, 0, 0, 1], [[0, '#fbe0a6'], [0.48, '#f2b545'], [0.5, '#c6943a'], [1, '#795b23']]),
  RG('pl-win', ['50%', '40%', '70%'], [[0, '#fff2c4'], [0.4, '#ffb53d'], [1, '#7a4a0e']]),
  RG('pl-led', ['50%', '50%', '50%'], [[0, '#ff5a4e', 0.55], [1, '#ff5a4e', 0]]),
  LG('pl-beak', [0, 0, 0, 1], [[0, '#f6e7b8'], [1, '#c99a3e']]),
  RG('pl-owl', ['50%', '50%', '50%'], [[0, '#120c04'], [0.38, '#120c04'], [0.43, '#ffcf4a'], [0.8, '#e28a12'], [1, '#5a3306']]),
  RG('pl-collar', ['50%', '30%', '75%'], [[0, '#fffaf0'], [1, '#e8d2b8']]),
  LG('pl-bronze', [0, 0, 0, 1], [[0, '#d9a35a'], [0.5, '#8a5a24'], [1, '#3d2410']]),
  LG('pl-flame', [0, 1, 0, 0], [[0, '#fff'], [0.45, '#ffe066'], [1, '#ff9a1f']]),
  RG('pl-glow-w', ['50%', '50%', '50%'], [[0, '#fff', 0.55], [1, '#fff', 0]]),
  RG('pl-myth', ['50%', '50%', '50%'], [[0, '#ff7bd0', 0.35], [1, '#ff7bd0', 0]]),
  LG('pl-tape', [0, 0, 0, 1], [[0, '#f6dcb5'], [1, '#e2bd8a']]),
  '<pattern id="pl-hz" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#1c1f27"/><rect width="4" height="8" fill="#f2b545"/></pattern>',
  // materials: gold chrome, mirror chrome, holo foil, Mythic iridescence, the sheen that sweeps them
  LG('pl-mgold', [0, 0, 0.3, 1], [[0, '#fff8d2'], [0.16, '#ffd96e'], [0.33, '#c4871a'], [0.47, '#fff0a6'], [0.6, '#e2a532'], [0.8, '#8c5a0a'], [1, '#4a2d03']]),
  LG('pl-mchrome', [0, 0, 0.3, 1], [[0, '#ffffff'], [0.16, '#e6ebf2'], [0.34, '#8994a6'], [0.48, '#f8fafd'], [0.62, '#a3aec0'], [0.82, '#4c5465'], [1, '#1d2029']]),
  LG('pl-holo', [0, 0, 1, 0.25], HOLO),
  // the Holo body: a saturated rainbow at a steep angle, repeating every ~60px so every body shows the full spectrum
  `<linearGradient id="pl-holob" gradientUnits="userSpaceOnUse" x1="52" y1="70" x2="104" y2="128" spreadMethod="reflect">${ST([[0, '#ff6fc8'], [0.2, '#ffd25e'], [0.4, '#6dffa8'], [0.6, '#52d0ff'], [0.8, '#9d7bff'], [1, '#ff6fc8']])}</linearGradient>`,
  LG('pl-irid', [0, 0, 1, 0.3], [[0, '#ff8ad8'], [0.2, '#8ae8ff'], [0.4, '#c8a2ff'], [0.6, '#9dffcf'], [0.8, '#ffd98a'], [1, '#ff8ad8']]),
  LG('pl-sheen', [0, 0, 1, 0], [[0, '#fff', 0], [0.42, '#fff', 0], [0.5, '#fff', 0.85], [0.58, '#fff', 0], [1, '#fff', 0]]),
  LG('pl-trim-s', [0, 0, 1, 1], [[0, '#ffffff'], [0.3, '#cdd5e1'], [0.55, '#6b7587'], [0.78, '#eef2f7'], [1, '#808a9c']]),
  LG('pl-trim-g', [0, 0, 1, 1], [[0, '#fff6c8'], [0.3, '#f5c451'], [0.55, '#8a5a0c'], [0.78, '#ffe39a'], [1, '#a8740a']]),
  LG('pl-acc-gloss', [0, 0, 0, 1], [[0, '#fff', 0.55], [0.4, '#fff', 0.08], [0.7, '#000', 0], [1, '#000', 0.22]]),
  RG('pl-lens', ['38%', '30%', '75%'], [[0, '#ffffff', 0.9], [0.25, '#bfe9ff', 0.75], [1, '#1d3a5c', 0.9]]),
  RG('pl-shell', ['40%', '25%', '85%'], [[0, '#fffdf6'], [0.55, '#f3ead6'], [1, '#bfa77c']]),
  RG('pl-elder', ['50%', '50%', '50%'], [[0, '#ffe9a8', 0.45], [0.55, '#ffe9a8', 0.12], [1, '#ffe9a8', 0]]),
  LG('pl-leaf', [0, 0, 1, 1], [[0, '#fff3b0'], [0.5, '#f5c451'], [1, '#a8740a']]),
  LG('pl-flm', [0, 1, 0, 0], [[0, '#ff5a2a'], [0.6, '#ffb23d'], [1, '#ffe7a0']]),
].join('');
function ensurePlDefs() {
  if (typeof document === 'undefined' || !document.body || document.getElementById('pl-defs')) return;
  document.body.insertAdjacentHTML('afterbegin', `<svg id="pl-defs" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${PL_DEFS}</defs></svg>`);
}

// growth stages: proportions, eye size and how far head ornaments have grown in
const STAGE_LOOK = {
  hatchling: { k: 0.84, eye: 1.2, orn: 0 },
  juvenile: { k: 0.92, eye: 1.1, orn: 0.72 },
  adult: { k: 1, eye: 1, orn: 1 },
  elder: { k: 1, eye: 1, orn: 1 },
};
function artCtx(c, rng) {
  const sk = ART_PAL[c.speciesKey] ? c.speciesKey : 'wisp';
  const T = c.rarity && TIERI[c.rarity.tier] != null ? c.rarity.tier : 'Common', ti = TIERI[T], rk = Math.min(4, ti);
  const tr = c.traits || [];
  const v = PV ? PV.variantOf(c) : null;
  const sk0 = PV ? PV.stageOf(c).key : 'adult', stage = sk0 === 'exalted' ? 'elder' : sk0, look = STAGE_LOOK[stage] || STAGE_LOOK.adult;
  const night = tr.includes('Nightshift'), sick = c.status === 'sick', healed = c.status === 'healed' || tr.includes('Survivor');
  const pk = (c.parents || []).map((n) => NAME2KEY[String(n).trim()]).filter(Boolean);
  const hybrid = pk.length === 2;
  const other = hybrid ? (pk.find((k) => k !== sk) || null) : null;
  const cw = v ? v.colorway : null;
  const pal = Object.assign({}, ART_PAL[sk], cw ? { body: cw.body, iris: cw.iris, glow: cw.glow, trim: cw.trim } : { trim: ART_PAL[sk].accent });
  const j = (rng() - 0.5) * 0.1; pal.body = j > 0 ? lighten(pal.body, j) : darken(pal.body, -j);
  if (hybrid) pal.body = mix(ART_PAL[pk[0]].body, ART_PAL[pk[1]].body, 0.5);
  if (night) pal.glow = '#8f7bff';
  const mat = v ? v.material : T === 'Mythic' ? 'iridescent' : T === 'Legendary' ? 'gold' : 'vinyl';
  const sid = (c.seed >>> 0).toString(36) + sk[0] + T[0] + (sick ? 's' : '') + (night ? 'n' : '') + (hybrid ? 'x' + pk[0][0] + pk[1][0] : '') + '__I__';
  let rimC = T === 'Common' ? lighten(pal.glow, 0.2) : T === 'Uncommon' ? mix(lighten(pal.glow, 0.35), '#6ee7a5', 0.5) : lighten(pal.glow, 0.35);
  if (night) rimC = '#a99bff';
  if (T === 'Legendary') rimC = '#ffd76a';
  if (T === 'Mythic') rimC = '#ff9be0';
  if (mat === 'chrome') rimC = '#ffffff';
  const irisOf = (k) => (night ? '#a99bff' : hybrid ? ART_PAL[k].iris : pal.iris);
  let iris = irisOf(hybrid ? pk[0] : sk), iris2 = irisOf(hybrid ? pk[1] : sk);
  if (T === 'Legendary' && !night) { iris = '#ffcf4a'; iris2 = '#ffcf4a'; }
  if (sick) { iris = mix(iris, '#888888', 0.6); iris2 = mix(iris2, '#888888', 0.6); }
  const tilt = (rng() - 0.5) * 5;
  const ex = sick ? 'sick' : v ? v.expression.key : 'calm';
  let lid = Math.max(night ? 0.22 : 0, sick ? 0.45 : 0);
  if (!sick) lid = Math.max(lid, { sleepy: 0.52, smug: 0.34, determined: 0.14 }[ex] || 0);
  return {
    c, rng, v, sk, T, ti, rk, R: 56, sid, pal, mat, night, sick, healed, hybrid, pk, other, rimC, iris, iris2, tr, tilt, lid, ex,
    stage, exalted: sk0 === 'exalted', look, eyeK: look.eye, eyeStyle: v ? v.eyes.key : 'classic', glowEyes: ti >= 2 && !sick,
    wink: ex === 'wink' ? (v ? v.flip : 1) : 0, lidAng: ex === 'determined' ? 16 : ex === 'smug' ? -9 : 0,
    flip: v ? v.flip : 1, defs: [],
  };
}
// a second, independent random stream for one purpose (patterns, sparkles...)
const sub = (A, salt) => mulberry32(hashString(salt + ':' + (A.c.seed >>> 0)));

// ---- shared drawing helpers ----
function bodyFill(A) {
  if (A.mat === 'gold') return 'url(#pl-mgold)';
  if (A.mat === 'holo') return 'url(#pl-holob)';
  if (A.mat === 'chrome') return 'url(#pl-mchrome)';
  return `url(#bd-${A.sid})`;
}
function vinylStack(A, K, o) {
  o = o || {};
  const s = A.sid, R = A.R, b = A.pal.body, u = (x) => `<use href="#b-${s}" ${x}/>`, metal = A.mat === 'gold' || A.mat === 'chrome';
  let q = u(`fill="none" stroke="${o.outline && !metal ? o.outline : metal ? (A.mat === 'gold' ? '#4a2d03' : '#1d2029') : darken(b, 0.6)}" stroke-width="4.5" stroke-linejoin="round"`);
  const foil = metal || A.mat === 'holo';
  q += o.inner != null && !foil ? o.inner : u(`fill="${bodyFill(A)}"`);
  if (foil && o.inner != null) q += metal ? `<g opacity=".35" style="mix-blend-mode:multiply">${o.inner}</g>` : `<g opacity=".6" style="mix-blend-mode:soft-light">${o.inner}</g>`;
  if (A.hybrid && o.inner == null) q += u('fill="url(#pl-shade)"');
  if (o.pattern) q += o.pattern;
  if (A.mat === 'holo') {
    // Holo: an angled rainbow foil body (bodyFill), shaded for volume, a moving foil glint and a crisp diagonal spec band
    q += u('fill="url(#pl-shade)"');
    q += `<g clip-path="url(#cl-${s})"><rect class="pl-foil" x="-170" y="0" width="540" height="220" fill="url(#pl-holo)" opacity=".35" style="mix-blend-mode:overlay"/>`;
    q += `<g transform="rotate(-32 100 ${F(K.sy)})"><rect x="${F(K.sx - R * 0.62)}" y="${F(K.sy - R * 2)}" width="${F(R * 0.2)}" height="${F(R * 4)}" fill="#fff" opacity=".62"/><rect x="${F(K.sx - R * 0.34)}" y="${F(K.sy - R * 2)}" width="${F(R * 0.07)}" height="${F(R * 4)}" fill="#fff" opacity=".8"/><rect x="${F(K.sx + R * 0.38)}" y="${F(K.sy - R * 2)}" width="${F(R * 0.12)}" height="${F(R * 4)}" fill="#fff" opacity=".28"/></g></g>`;
  }
  if (A.mat === 'iridescent') {
    // a full animated iridescence (Mythic)
    const irid = true;
    q += `<g clip-path="url(#cl-${s})"><rect class="pl-foil" x="-170" y="0" width="540" height="220" fill="url(#pl-${irid ? 'irid' : 'holo'})" opacity="${irid ? 0.9 : 0.62}" style="mix-blend-mode:${irid ? 'color' : 'hard-light'}"/><rect class="pl-foil pl-slow" x="-170" y="0" width="540" height="220" fill="url(#pl-${irid ? 'irid' : 'holo'})" opacity="${irid ? 0.4 : 0.3}" style="mix-blend-mode:${irid ? 'overlay' : 'color'}"/></g>`;
  }
  if (!o.noAO) q += u('fill="url(#pl-ao)"');
  q += u(`fill="none" stroke="url(#rim-${s})" stroke-width="7" clip-path="url(#cl-${s})"`);
  // metal trim from Rare up: a bright inner bevel just inside the outline (gold from Epic)
  if (A.ti >= 2 && A.mat === 'vinyl') q += u(`fill="none" stroke="url(#pl-trim-${A.ti >= 3 ? 'g' : 's'})" stroke-width="5.5" clip-path="url(#cl-${s})" opacity=".9"`);
  if (metal || A.mat === 'holo' || A.mat === 'iridescent') q += `<g clip-path="url(#cl-${s})"><g class="pl-sheen"><rect x="-120" y="0" width="200" height="220" fill="url(#pl-sheen)" opacity="${metal ? 0.75 : 0.5}" transform="skewX(-18)"/></g></g>`;
  const sp = K.spec || { x: K.sx - R * 0.3, y: K.sy - R * 0.52 }, hot = K.hot || { x: K.sx - R * 0.58, y: K.sy - R * 0.2 };
  if (!o.noSpec) q += `<ellipse cx="${F(sp.x)}" cy="${F(sp.y)}" rx="${F(R * 0.36)}" ry="${F(R * 0.15)}" transform="rotate(-24 ${F(sp.x)} ${F(sp.y)})" fill="url(#pl-sp)"${o.gloss ? '' : ' opacity=".9"'}/>`;
  if (o.gloss) q += `<ellipse cx="${F(K.sx + R * 0.45)}" cy="${F(K.sy + R * 0.12)}" rx="${F(R * 0.13)}" ry="${F(R * 0.06)}" transform="rotate(-62 ${F(K.sx + R * 0.45)} ${F(K.sy + R * 0.12)})" fill="#fff" opacity=".45"/>`;
  q += `<circle cx="${F(hot.x)}" cy="${F(hot.y)}" r="${F(R * 0.055)}" fill="#fff" opacity=".9"/>`;
  q += `<path d="M${F(K.sx - R * 0.86)} ${F(K.sy + R * 0.22)}Q${F(K.sx - R * 0.74)} ${F(K.sy + R * 0.8)} ${F(K.sx - R * 0.12)} ${F(K.sy + R * 0.92)}" fill="none" stroke="${lighten(b, 0.3)}" stroke-opacity=".35" stroke-width="1.5" stroke-linecap="round" clip-path="url(#cl-${s})"/>`;
  return q;
}

// ---- patterns (Uncommon and up), clipped to the body ----
function patternSVG(A, K) {
  const p = A.v && A.v.pattern; if (!p) return '';
  const R = A.R, cy = K.cy, rng = sub(A, 'pattern'), b = A.pal.body;
  // two inks with real contrast against the body: a pale one and a deep one (white and ink on foil and metal)
  const shiny = A.mat === 'gold' || A.mat === 'chrome' || A.mat === 'holo';
  const light = A.mat === 'gold' ? '#fff6d0' : shiny ? '#ffffff' : lighten(b, 0.62), deep = A.mat === 'gold' ? '#7a4a06' : A.mat === 'holo' ? '#2b1d5c' : darken(b, 0.45);
  const alt = shiny ? light : mix(A.pal.trim || light, '#ffffff', 0.25);
  let q = '';
  if (p.key === 'spots') {
    for (let i = 0; i < 8; i++) { const x = 100 + (rng() * 2 - 1) * R * 0.9, y = cy + (rng() * 2 - 1) * R * 0.85, r = R * (0.1 + rng() * 0.1); q += `<ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(r)}" ry="${F(r * 0.86)}" fill="${i % 3 ? deep : alt}" opacity="${i % 3 ? 0.62 : 0.85}"/>`; }
  } else if (p.key === 'stripes') {
    const ang = -24 + rng() * 10; let s2 = '';
    for (let i = -3; i <= 3; i++) s2 += `<rect x="${F(100 + i * R * 0.46 - R * 0.12)}" y="${F(cy - R * 1.6)}" width="${F(R * 0.24)}" height="${F(R * 3.2)}"/>`;
    q += `<g fill="${deep}" opacity=".55" transform="rotate(${F(ang)} 100 ${F(cy)})">${s2}</g>`;
  } else if (p.key === 'panel') {
    // Two-Tone: the lower body in a second, much paler tone with a clean wavy seam
    const y0 = cy + R * (0.1 + rng() * 0.12), amp = R * 0.06; let d = `M${F(100 - R * 1.6)} ${F(y0)}`;
    for (let i = 0; i < 6; i++) { const x1 = 100 - R * 1.6 + (i + 0.5) * (R * 3.2) / 6, x2 = 100 - R * 1.6 + (i + 1) * (R * 3.2) / 6; d += `Q${F(x1)} ${F(y0 + (i % 2 ? amp : -amp))} ${F(x2)} ${F(y0)}`; }
    const fillD = d + `L${F(100 + R * 1.6)} ${F(cy + R * 2)}L${F(100 - R * 1.6)} ${F(cy + R * 2)}Z`;
    q += `<path d="${fillD}" fill="${alt}" opacity=".78"/><path d="${d}" fill="none" stroke="${deep}" stroke-opacity=".6" stroke-width="2.2"/>`;
  } else if (p.key === 'freckles') {
    for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { const x = 100 + sd * R * (0.42 + rng() * 0.32), y = K.eyeY + R * (0.18 + rng() * 0.28); q += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(1.8 + rng() * 1.5)}" fill="${deep}" opacity=".85"/>`; }
    for (let i = 0; i < 7; i++) { const x = 100 + (rng() * 2 - 1) * R * 0.8, y = cy + R * (0.25 + rng() * 0.6); q += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(1.4 + rng() * 1.6)}" fill="${light}" opacity=".85"/>`; }
  } else if (p.key === 'zigzag') {
    const y0 = cy + R * (0.3 + rng() * 0.15), amp = R * 0.13, n = 8; let d = '';
    for (let i = 0; i <= n; i++) d += (i ? 'L' : 'M') + F(100 - R * 1.2 + (i * R * 2.4) / n) + ' ' + F(y0 + (i % 2 ? -amp : amp));
    q += `<path d="${d}" fill="none" stroke="${deep}" stroke-width="${F(R * 0.2)}" stroke-linejoin="round" opacity=".5"/><path d="${d}" fill="none" stroke="${alt}" stroke-width="${F(R * 0.12)}" stroke-linejoin="round" opacity=".92"/>`;
  } else if (p.key === 'stars') {
    for (let i = 0; i < 7; i++) { const x = 100 + (rng() * 2 - 1) * R * 0.85, y = cy + (rng() * 2 - 1) * R * 0.8, s2 = R * (0.08 + rng() * 0.07); q += `<path d="${star4(x, y, s2)}" fill="${i % 2 ? alt : light}" stroke="${deep}" stroke-opacity=".35" stroke-width=".8" opacity=".95"/>`; }
  }
  return `<g clip-path="url(#cl-${A.sid})">${q}</g>`;
}

// ---- eyes: style, glow, lids, wink ----
const irisFor = (A, x) => (A.hybrid && x > 100.5 ? `ir2-${A.sid}` : `ir-${A.sid}`);
const sideOf = (x) => (x < 99.5 ? -1 : x > 100.5 ? 1 : 0);
function drawEye(A, e) {
  const er = e.er, b = A.pal.body, lidC = e.lidC || lighten(b, 0.04), side = sideOf(e.x), ink = darken(b, 0.66);
  // a winking eye is shut in a happy arc (a lone center eye squints instead)
  if (A.wink && side === A.wink && !e.noWink) return `<g transform="translate(${F(e.x)} ${F(e.y)})"><path d="M${F(-er * 0.86)} ${F(er * 0.18)}Q0 ${F(-er * 0.78)} ${F(er * 0.86)} ${F(er * 0.18)}" fill="none" stroke="${ink}" stroke-width="${F(Math.max(2.4, er * 0.26))}" stroke-linecap="round"/></g>`;
  const style = e.style || A.eyeStyle;
  let g = `<g transform="translate(${F(e.x)} ${F(e.y)})">`;
  if (A.glowEyes && !e.noGlow) g += `<circle class="pl-pulse" r="${F(er * 1.75)}" fill="url(#eg-${A.sid})"/>`;
  g += `<g class="pl-eye"${e.delay ? ` style="animation-delay:${F(e.delay)}s"` : ''}>`;
  let rx = er, ry = er;
  if (e.kind === 'dark') {
    rx = er * 0.8;
    g += `<ellipse rx="${F(rx + 2)}" ry="${F(er + 2)}" fill="#fff6d8" opacity=".55"/><ellipse rx="${F(rx)}" ry="${F(er)}" fill="${style === 'star' ? '#3a1a04' : '#2b1608'}"/>`;
    if (style === 'star') g += `<path d="${star5(0, er * 0.12, er * 0.5)}" fill="#ffd36b"/>`;
    if (style === 'galaxy') for (let i = 0; i < 5; i++) g += `<circle cx="${F(Math.cos(i * 1.3) * er * 0.45)}" cy="${F(Math.sin(i * 1.3) * er * 0.55)}" r="${F(er * 0.07)}" fill="#ffd6f4"/>`;
    g += `<ellipse cx="${F(-rx * 0.3)}" cy="${F(-er * 0.42)}" rx="${F(er * 0.28)}" ry="${F(er * 0.2)}" transform="rotate(-22 ${F(-rx * 0.3)} ${F(-er * 0.42)})" fill="#fff2d0"/><circle cx="${F(rx * 0.35)}" cy="${F(er * 0.35)}" r="${F(er * 0.11)}" fill="#fff2d0" opacity=".75"/>`;
  } else {
    const tall = e.kind === 'tall';
    if (tall) { rx = er * 0.72; ry = er * 1.05; }
    const sh = (a, attrs) => (tall ? `<ellipse rx="${F(rx + a)}" ry="${F(ry + a)}" ${attrs}/>` : `<circle r="${F(er + a)}" ${attrs}/>`);
    if (e.kind === 'lens') g += sh(4.5, `fill="${darken(b, 0.55)}"`) + sh(2.4, `fill="none" stroke="${A.ti >= 2 ? 'url(#pl-trim-' + (A.ti >= 3 ? 'g' : 's') + ')' : lighten(b, 0.28)}" stroke-width="1.8"`);
    else g += sh(3, `fill="${darken(b, 0.45)}" opacity=".5"`);
    g += sh(0, `fill="url(#${e.iris || irisFor(A, e.x)})"`);
    if (e.kind === 'lens') { let bl = ''; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3 + 0.3; bl += `M${F(Math.cos(a) * er * 0.42)} ${F(Math.sin(a) * er * 0.42)}L${F(Math.cos(a + 0.5) * er * 0.9)} ${F(Math.sin(a + 0.5) * er * 0.9)}`; } g += `<path d="${bl}" stroke="#000" stroke-opacity=".28" stroke-width="1.1"/>`; }
    if (style === 'slit') g += `<ellipse rx="${F(er * 0.15)}" ry="${F(ry * 0.74)}" fill="#05060a" opacity=".92"/>`;
    else if (style === 'ring') g += `<circle r="${F(er * 0.6)}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="${F(Math.max(0.8, er * 0.1))}"/><circle cy="${F(er * 0.05)}" r="${F(er * 0.28)}" fill="#05060a" opacity=".9"/>`;
    else if (style === 'star') g += `<path d="${star5(0, er * 0.08, er * 0.56)}" fill="#fff4c2" stroke="#a8740a" stroke-width=".9" stroke-linejoin="round"/>`;
    else if (style === 'galaxy') { g += `<circle r="${F(er * 0.82)}" fill="#2a0e3c" opacity=".55"/>`; for (let i = 0; i < 6; i++) g += `<circle cx="${F(Math.cos(i * 1.05 + 0.4) * er * 0.5)}" cy="${F(Math.sin(i * 1.05 + 0.4) * er * 0.5)}" r="${F(er * (i % 2 ? 0.06 : 0.09))}" fill="${i % 2 ? '#8ae8ff' : '#ffd6f4'}"/>`; }
    else if (e.pupil) g += `<circle cy="${F(er * 0.06)}" r="${F(er * 0.36)}" fill="#05060a" opacity=".9"/>`;
    const mx = -rx * 0.34, my = -ry * 0.4;
    g += `<ellipse cx="${F(mx)}" cy="${F(my)}" rx="${F(er * 0.36)}" ry="${F(er * 0.27)}" transform="rotate(-22 ${F(mx)} ${F(my)})" fill="#fff" opacity=".95"/>`;
    if (style === 'sparkle' || e.star || A.ti >= 2) g += `<path d="${star4(rx * 0.4, ry * 0.3, er * 0.24)}" fill="#fff" opacity=".9"/>`;
    else g += `<circle cx="${F(rx * 0.4)}" cy="${F(ry * 0.3)}" r="${F(er * 0.13)}" fill="#fff" opacity=".75"/>`;
    if (style === 'sparkle') g += `<circle cx="${F(-rx * 0.05)}" cy="${F(ry * 0.5)}" r="${F(er * 0.09)}" fill="#fff" opacity=".85"/>`;
    g += `<path d="M${F(-rx * 0.6)} ${F(ry * 0.45)}Q0 ${F(ry * 0.82)} ${F(rx * 0.6)} ${F(ry * 0.45)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.2"/>`;
  }
  let lid = e.lid != null ? e.lid : A.lid;
  if (A.wink && side === 0 && !e.noWink) lid = Math.max(lid, 0.5);
  if (lid > 0) {
    const ex = e.kind === 'lens' ? er + 1 : rx + 1, ey = e.kind === 'dark' || e.kind === 'tall' ? ry + 1 : er + 1;
    const y0 = -ey + 2 * ey * lid, w = ex * Math.sqrt(Math.max(0, 1 - (y0 / ey) * (y0 / ey)));
    const rot = side ? -side * A.lidAng : 0;
    g += `<g${rot ? ` transform="rotate(${F(rot)})"` : ''}><path d="M${F(-w)} ${F(y0)}A${F(ex)} ${F(ey)} 0 ${lid > 0.5 ? 1 : 0} 1 ${F(w)} ${F(y0)}Z" fill="${lidC}"/><path d="M${F(-w - 0.5)} ${F(y0)}Q0 ${F(y0 + 2.2)} ${F(w + 0.5)} ${F(y0)}" fill="none" stroke="${darken(b, 0.6)}" stroke-width="1.8" stroke-linecap="round"/></g>`;
  }
  return g + '</g></g>';
}

// ---- attitude: brows, mouths, whiskers ----
// eyes: [{x, y, er}] for the brows to sit over. Elders grow bushy white brows.
function browsSVG(A, eyes, up) {
  const ex = A.ex, elder = A.stage === 'elder';
  if (A.sick || (!elder && (ex === 'calm' || ex === 'sick'))) return '';
  // elders grow bushy, tapered brows (snow white once Exalted) that keep the shape of the expression.
  // On a pale body they go silver-grey with a darker edge, so they never read as a strip of tape.
  const pale = lum(A.mat === 'gold' ? '#e8b64a' : A.pal.body) > 0.62;
  const ink = elder ? (pale ? (A.exalted ? '#c9ccd8' : mix(A.pal.body, '#5d6274', 0.55)) : A.exalted ? '#f6f2e8' : mix(A.pal.body, '#fffaf0', 0.62)) : darken(A.pal.body, 0.62);
  const edge = darken(A.pal.body, 0.6);
  let q = '';
  for (const e of eyes) {
    const side = sideOf(e.x), er = e.er, w = er * 0.86;
    let tilt = 0, lift = 0, curve = 0.2;
    if (ex === 'grin' || ex === 'tongue') { lift = 0.14; curve = 0.34; }
    else if (ex === 'determined') { tilt = 0.36; curve = 0.04; }
    else if (ex === 'smug') { if (side === A.flip || side === 0) { lift = 0.24; curve = 0.32; } else { tilt = -0.08; curve = 0.04; } }
    else if (ex === 'sleepy') { tilt = -0.2; lift = -0.12; curve = 0.08; }
    else if (ex === 'wink') { if (side === A.wink) { lift = -0.12; tilt = 0.12; } else { lift = 0.18; curve = 0.32; } }
    const y = e.y - er * (up || 1.45) - lift * er;
    let y1 = y, y2 = y; // outer-left end, right end
    if (side < 0) { y2 += tilt * er; y1 -= tilt * er * 0.35; } else if (side > 0) { y1 += tilt * er; y2 -= tilt * er * 0.35; }
    const x1 = e.x - w, x2 = e.x + w, cx = e.x, cyq = (y1 + y2) / 2 - curve * er;
    const d = `M${F(x1)} ${F(y1)}Q${F(cx)} ${F(cyq)} ${F(x2)} ${F(y2)}`;
    if (elder) {
      // a tapered crescent, thick in the middle, with a few hairs flicking out at the outer end
      const th = Math.max(3.2, er * 0.36), dir = side < 0 ? -1 : 1, ox = dir < 0 ? x1 : x2, oy = dir < 0 ? y1 : y2;
      const shape = `M${F(x1)} ${F(y1)}Q${F(cx)} ${F(cyq - th * 1.25)} ${F(x2)} ${F(y2)}Q${F(cx)} ${F(cyq + th * 0.35)} ${F(x1)} ${F(y1)}Z`;
      let hair = ''; for (let k = 0; k < 3; k++) { const t = 0.25 + k * 0.25, hx = x1 + (x2 - x1) * t, hy = (y1 + (y2 - y1) * t) - th * 0.55 - curve * er * 0.8; hair += `M${F(hx)} ${F(hy + 1.2)}q${F(dir * 1.6)} -2.6 ${F(dir * 3.6)} -3.4`; }
      hair += `M${F(ox)} ${F(oy)}q${F(dir * 3.4)} .4 ${F(dir * 5)} 3.6`;
      q += `<path d="${shape}" fill="${ink}" stroke="${edge}" stroke-opacity=".55" stroke-width="1.1" stroke-linejoin="round"/><path d="${hair}" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/>`;
    } else q += `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${F(Math.max(2.4, er * 0.27))}" stroke-linecap="round"/>`;
  }
  return q;
}
function whiskersSVG(A, y, dx) {
  if (A.stage !== 'elder') return '';
  let d = '';
  for (const s of [-1, 1]) for (const k of [-1, 1]) d += `M${F(100 + s * dx)} ${F(y + k * 2.2)}q${F(s * 7)} ${F(k * 0.6 - 1)} ${F(s * 14)} ${F(k * 3.2)}`;
  return `<path d="${d}" fill="none" stroke="#fbf6ea" stroke-opacity=".85" stroke-width="1.3" stroke-linecap="round"/>`;
}
// generic mouths for every expression; a species keeps its own mouth when calm
const TONGUE = '#ff6f93';
function mouthSVG(A, x, y, w, o) {
  o = o || {};
  const ex = A.ex, line = o.line || darken(A.pal.body, 0.66), hole = o.hole || '#2a1218';
  if (ex === 'grin') {
    const d = `M${F(x - w)} ${F(y)}L${F(x + w)} ${F(y)}Q${F(x + w * 0.92)} ${F(y + w * 1.02)} ${F(x)} ${F(y + w * 1.02)}Q${F(x - w * 0.92)} ${F(y + w * 1.02)} ${F(x - w)} ${F(y)}Z`;
    return `<path d="${d}" fill="${hole}" stroke="${line}" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="${F(x)}" cy="${F(y + w * 0.78)}" rx="${F(w * 0.46)}" ry="${F(w * 0.2)}" fill="${TONGUE}"/><path d="M${F(x - w * 0.9)} ${F(y + 0.9)}L${F(x + w * 0.9)} ${F(y + 0.9)}L${F(x + w * 0.78)} ${F(y + w * 0.36)}L${F(x - w * 0.78)} ${F(y + w * 0.36)}Z" fill="#fffaf0"/><path d="M${F(x - w * 0.4)} ${F(y + 1)}v${F(w * 0.33)}M${F(x)} ${F(y + 1)}v${F(w * 0.35)}M${F(x + w * 0.4)} ${F(y + 1)}v${F(w * 0.33)}" stroke="#cfc6b8" stroke-width=".9"/>`;
  }
  if (ex === 'tongue') {
    const d = `M${F(x - w * 0.82)} ${F(y)}Q${F(x)} ${F(y + w * 0.9)} ${F(x + w * 0.82)} ${F(y)}Z`;
    return `<path d="${d}" fill="${hole}" stroke="${line}" stroke-width="1.7" stroke-linejoin="round"/><path d="M${F(x - w * 0.36)} ${F(y + w * 0.3)}L${F(x + w * 0.36)} ${F(y + w * 0.3)}L${F(x + w * 0.36)} ${F(y + w * 0.82)}Q${F(x + w * 0.36)} ${F(y + w * 1.22)} ${F(x)} ${F(y + w * 1.22)}Q${F(x - w * 0.36)} ${F(y + w * 1.22)} ${F(x - w * 0.36)} ${F(y + w * 0.82)}Z" fill="${TONGUE}" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/><path d="M${F(x)} ${F(y + w * 0.5)}v${F(w * 0.42)}" stroke="#c94a6c" stroke-width="1" stroke-linecap="round"/>`;
  }
  if (ex === 'smug') {
    const s = A.flip;
    return `<path d="M${F(x - s * w * 0.78)} ${F(y + w * 0.12)}Q${F(x - s * w * 0.05)} ${F(y + w * 0.46)} ${F(x + s * w * 0.82)} ${F(y - w * 0.26)}" fill="none" stroke="${line}" stroke-width="2.3" stroke-linecap="round"/><path d="M${F(x + s * w * 0.72)} ${F(y - w * 0.42)}q${F(s * 3)} ${F(w * 0.18)} ${F(s * 2.2)} ${F(w * 0.5)}" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`;
  }
  if (ex === 'determined') {
    return `<rect x="${F(x - w * 0.82)}" y="${F(y - w * 0.2)}" width="${F(w * 1.64)}" height="${F(w * 0.56)}" rx="${F(w * 0.16)}" fill="#fffaf0" stroke="${line}" stroke-width="1.7"/><path d="M${F(x - w * 0.82)} ${F(y + w * 0.08)}H${F(x + w * 0.82)}M${F(x - w * 0.41)} ${F(y - w * 0.2)}v${F(w * 0.56)}M${F(x)} ${F(y - w * 0.2)}v${F(w * 0.56)}M${F(x + w * 0.41)} ${F(y - w * 0.2)}v${F(w * 0.56)}" stroke="${line}" stroke-width=".9" opacity=".75"/>`;
  }
  if (ex === 'sleepy') {
    return `<ellipse cx="${F(x)}" cy="${F(y + w * 0.16)}" rx="${F(w * 0.3)}" ry="${F(w * 0.36)}" fill="${hole}" stroke="${line}" stroke-width="1.4"/><path d="${dropP(x + w * 0.42, y + w * 0.2, w * 0.4)}" fill="#bfe6ff" opacity=".9"/>`;
  }
  if (ex === 'wink') {
    const s = A.flip;
    return `<path d="M${F(x - w * 0.78)} ${F(y - w * 0.04)}Q${F(x)} ${F(y + w * 0.8)} ${F(x + w * 0.8)} ${F(y - w * 0.16)}" fill="none" stroke="${line}" stroke-width="2.3" stroke-linecap="round"/><path d="M${F(x + s * w * 0.12)} ${F(y + w * 0.3)}q${F(s * w * 0.2)} ${F(w * 0.55)} ${F(s * w * 0.46)} ${F(w * 0.06)}" fill="${TONGUE}" stroke="${line}" stroke-width="1.2"/>`;
  }
  return '';
}
const usesOwnMouth = (A) => A.ex === 'calm';
function blushAt(A, y, dx) {
  const R = A.R; dx = dx || R * 0.46;
  return `<ellipse cx="${F(100 - dx)}" cy="${F(y)}" rx="${F(R * 0.13)}" ry="${F(R * 0.07)}" fill="url(#pl-blush)"/><ellipse cx="${F(100 + dx)}" cy="${F(y)}" rx="${F(R * 0.13)}" ry="${F(R * 0.07)}" fill="url(#pl-blush)"/>`;
}
const sickMouth = (A, x, y) => `<path d="M${F(x - 7)} ${F(y)}l3.5 -2.4l3.5 2.4l3.5 -2.4l3.5 2.4" fill="none" stroke="${darken(A.pal.body, 0.62)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
function gearPath(ro, ri, n) {
  const p = [], hw = (Math.PI / n) * 0.28;
  for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n, r = i % 2 === 0 ? ro : ri; p.push([Math.cos(a - hw) * r, Math.sin(a - hw) * r], [Math.cos(a + hw) * r, Math.sin(a + hw) * r]); }
  return pathOf(p, true);
}
function cogGears(A, y, dx, scale) {
  const R = A.R, ro = R * 0.36 * (scale || 1) * (A.rk >= 2 ? 1.16 : 1), ri = ro * 0.7; let q = '';
  const metal = A.mat === 'chrome' ? 'url(#pl-trim-s)' : 'url(#pl-gear)';
  [-1, 1].forEach((s, i) => {
    const rot = A.rng() * 45;
    q += `<g transform="translate(${F(100 + s * dx)} ${F(y)})"><g class="pl-spin${i ? ' pl-rev' : ''}"><path d="${gearPath(ro, ri, 8)}" transform="rotate(${F(rot)})" fill="${metal}" stroke="#5e4413" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/><circle r="${F(ro * 0.34)}" fill="${darken(A.pal.body, 0.55)}" stroke="#fbe0a6" stroke-opacity=".5" stroke-width="1"/></g></g>`;
  });
  return q;
}
function tendrilPath(x, y, a0, len, curl, w0) {
  const n = 16, pts = []; let px = x, py = y, a = a0;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([px, py, t, a]); a += curl * t * t * (3 / n); px += (Math.cos(a) * len) / n; py += (Math.sin(a) * len) / n; }
  const L = [], Rr = [];
  for (const [qx, qy, t, aa] of pts) { const w = (w0 * (1 - t) + 0.9) / 2, nx = -Math.sin(aa), ny = Math.cos(aa); L.push([qx + nx * w, qy + ny * w]); Rr.push([qx - nx * w, qy - ny * w]); }
  return pathOf(L.concat(Rr.reverse()), true);
}
function mothAntennae(A, x, y) {
  const R = A.R; let q = '';
  for (const s of [-1, 1]) {
    const p0 = [x + s * R * 0.2, y + 7], p1 = [x + s * R * 0.26, y - 24], p2 = [x + s * R * 0.7, y - 30];
    let barbs = '';
    for (let i = 1; i <= 7; i++) {
      const t = 0.22 + i * 0.1, m = 1 - t;
      const bx = m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0], by = m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1];
      let tx = 2 * m * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), ty = 2 * m * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]); const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const len = 6.5 * (1 - t * 0.45);
      for (const k of [-1, 1]) { const ang = k * 0.75, dx = tx * Math.cos(ang) - ty * Math.sin(ang), dy = tx * Math.sin(ang) + ty * Math.cos(ang); barbs += `M${F(bx)} ${F(by)}l${F(dx * len)} ${F(dy * len)}`; }
    }
    q += `<path d="${barbs}" stroke="${A.pal.trim || '#f6e7d3'}" stroke-width="1.4" stroke-linecap="round" opacity=".95"/>`;
    q += `<path d="M${F(p0[0])} ${F(p0[1])}Q${F(p1[0])} ${F(p1[1])} ${F(p2[0])} ${F(p2[1])}q${F(s * 6)} -1 ${F(s * 4.5)} 5.5q${F(-s * 1.5)} 2.5 ${F(-s * 3.5)} .5" fill="none" stroke="${darken(A.pal.body, 0.42)}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return q;
}
function prismShard(A, x, y, ang, h) {
  const b = A.pal.body, w = A.R * 0.22, metal = A.mat === 'gold' ? '#f5c451' : null;
  const pts = [[0, 0], [w / 2, -h * 0.2], [w / 2, -h * 0.85], [0, -h], [-w / 2, -h * 0.85], [-w / 2, -h * 0.2]];
  return `<g transform="translate(${F(x)} ${F(y)}) rotate(${F(ang)})"><path d="${pathOf(pts, true)}" fill="${metal || darken(b, 0.12)}" stroke="${darken(metal || b, 0.6)}" stroke-width="3.6" stroke-linejoin="round" paint-order="stroke"/><path d="${pathOf([[0, 0], [0, -h], [-w / 2, -h * 0.85], [-w / 2, -h * 0.2]], true)}" fill="${lighten(metal || b, 0.42)}"/><path d="M0 0V${F(-h)}" stroke="${lighten(b, 0.85)}" stroke-width=".9" opacity=".8"/><path d="M${F(-w / 2 + 1.5)} ${F(-h * 0.8)}L${F(-w / 2 + 1.5)} ${F(-h * 0.35)}" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".75"/></g>`;
}
function lumenRing(x, y) {
  return `<circle cx="${F(x)}" cy="${F(y)}" r="9" fill="none" stroke="#3d2410" stroke-width="5.5"/><circle cx="${F(x)}" cy="${F(y)}" r="9" fill="none" stroke="url(#pl-bronze)" stroke-width="3.5"/><path d="M${F(x - 7)} ${F(y - 5)}A9 9 0 0 1 ${F(x + 2)} ${F(y - 9)}" fill="none" stroke="#f3c98a" stroke-width="1" opacity=".8"/>`;
}
function wispFlame(A, x, y, k) {
  return `<g transform="translate(${F(x)} ${F(y + 3)})${k ? ` scale(${k})` : ''}"><g class="pl-flicker"><path d="M0 0C-10 -3 -9 -14 -1 -17C-4 -12 4 -12 2 -23C12 -15 11 -3 0 0Z" fill="url(#wf-${A.sid})" stroke="${darken(A.pal.body, 0.35)}" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"/><path d="M-1 -4C-5 -6 -4 -11 0 -12" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></g></g>`;
}
function stalkEye(A, bx, by, ex, ey, er, delay) {
  const b = A.pal.body;
  const st = `<path d="M${F(bx - 4.2)} ${F(by)}Q${F((bx + ex) / 2 - 3)} ${F((by + ey) / 2)} ${F(ex - 2.2)} ${F(ey + er * 0.6)}L${F(ex + 2.2)} ${F(ey + er * 0.6)}Q${F((bx + ex) / 2 + 3)} ${F((by + ey) / 2)} ${F(bx + 4.2)} ${F(by)}Z" fill="${bodyFill(A)}" stroke="${darken(b, 0.6)}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/>`;
  return st + `<circle cx="${F(ex)}" cy="${F(ey)}" r="${F(er + 3)}" fill="${lighten(b, 0.25)}" stroke="${darken(b, 0.6)}" stroke-width="2"/>` + drawEye(A, { x: ex, y: ey, er, delay, noGlow: true, noWink: true });
}

// ---- the seven species ----
// geo() anchors used by accessories: hat {x,y,w}, ear {y,dx}, neck {y,w}, gog {y,dx,r}, bowAt, sproutAt, visW
const SPECIES_PARTS = {};
SPECIES_PARTS.cog = {
  geo(A) {
    const R = A.R, cy = 196 - R * 1.02, x0 = 100 - R, y0 = cy - R * 0.95, w = 2 * R, h = R * 1.9, r = R * 0.5;
    const d = `M${F(x0 + r)} ${F(y0)}H${F(x0 + w - r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0 + w)} ${F(y0 + r)}V${F(y0 + h - r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0 + w - r)} ${F(y0 + h)}H${F(x0 + r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0)} ${F(y0 + h - r)}V${F(y0 + r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0 + r)} ${F(y0)}Z`;
    const two = A.rk >= 3, er = (two ? R * 0.24 : R * 0.32) * A.eyeK, eyeY = cy - R * 0.32;
    return { d, cy, sx: 100, sy: cy, headTop: { x: 100, y: y0 }, brow: y0 + 8, bw: R * 0.98, eyeY, er, two, mouthY: cy + R * 0.2, spec: { x: 100 - R * 0.55, y: y0 + R * 0.2 }, hot: { x: 100 - R * 0.82, y: cy - R * 0.05 }, scarAt: { x: 100 + R * 0.62, y: y0 + R * 0.4 },
      hat: { x: 100, y: y0 + 3, w: R * 0.5 }, ear: { y: eyeY, dx: R * 1.0 }, neck: { y: cy + R * 0.42, w: R }, gog: { y: y0 + 4, dx: R * 0.3, r: R * 0.16 }, bowAt: { x: 100 - R * 0.74, y: y0 + 5 }, sproutAt: { x: 100 - R * 0.12, y: y0 + 2 }, visW: R * 1.04 };
  },
  ornament(A, K) {
    const R = A.R; let q = cogGears(A, K.headTop.y + 8, R * 0.62);
    if (A.rk >= 1) {
      const ax = 100 + R * 0.4, ay = K.headTop.y - 21;
      q += `<path d="M${F(ax - 2)} ${F(K.headTop.y + 6)}L${F(ax)} ${F(ay)}" stroke="${darken(A.pal.body, 0.5)}" stroke-width="3.2" stroke-linecap="round"/><circle cx="${F(ax)}" cy="${F(ay)}" r="10" fill="url(#pl-led)"/><circle class="pl-led" cx="${F(ax)}" cy="${F(ay)}" r="4.5" fill="#ff5a4e" stroke="#7a1a14" stroke-width="1.4"/><circle cx="${F(ax - 1.5)}" cy="${F(ay - 1.5)}" r="1.3" fill="#fff" opacity=".85"/>`;
    }
    return q;
  },
  back(A, K) {
    const R = A.R, b = A.pal.body; let q = '';
    for (const s of [-1, 1]) q += `<rect x="${F(100 + s * R * 0.42 - R * 0.2)}" y="${F(197 - R * 0.22)}" width="${F(R * 0.4)}" height="${F(R * 0.22)}" rx="6" fill="${darken(b, 0.35)}" stroke="${darken(b, 0.62)}" stroke-width="2"/>`;
    return q;
  },
  detail(A, K) {
    const R = A.R, b = A.pal.body, cy = K.cy; let q = '';
    for (const s of [-1, 1]) {
      q += `<path d="M${F(100 + s * R * 0.76)} ${F(K.headTop.y + R * 0.3)}Q${F(100 + s * R * 0.8)} ${F(cy + R * 0.2)} ${F(100 + s * R * 0.74)} ${F(cy + R * 0.66)}" fill="none" stroke="${darken(b, 0.45)}" stroke-width="1.2" opacity=".6"/>`;
      const hx = 100 + s * R * 0.99, hy = cy + R * 0.08; let hex = []; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; hex.push([hx + Math.cos(a) * 5.2, hy + Math.sin(a) * 5.2]); }
      q += `<path d="${pathOf(hex, true)}" fill="${A.ti >= 2 ? 'url(#pl-trim-' + (A.ti >= 3 ? 'g' : 's') + ')' : lighten(b, 0.12)}" stroke="${darken(b, 0.6)}" stroke-width="1.4"/><circle cx="${F(hx)}" cy="${F(hy)}" r="1.6" fill="${darken(b, 0.5)}"/>`;
    }
    const px = 100, py = cy + R * 0.58, pr = R * 0.22, nd = -2.2 + A.rng() * 1.4;
    q += `<circle cx="${px}" cy="${F(py)}" r="${F(pr + 4.2)}" fill="${A.rk >= 2 ? 'url(#pl-hz)' : darken(b, 0.42)}" stroke="${darken(b, 0.65)}" stroke-width="1.6"/><circle cx="${px}" cy="${F(py)}" r="${F(pr)}" fill="url(#pl-win)" stroke="${darken(b, 0.6)}" stroke-width="1"/>`;
    let tk = ''; for (let i = 0; i < 5; i++) { const t = -2.6 + i * 0.55; tk += `M${F(px + Math.cos(t) * pr * 0.72)} ${F(py + Math.sin(t) * pr * 0.72)}L${F(px + Math.cos(t) * pr * 0.9)} ${F(py + Math.sin(t) * pr * 0.9)}`; }
    q += `<path d="${tk}" stroke="#7a4a0e" stroke-width="1.2" stroke-linecap="round" opacity=".7"/><path d="M${px} ${F(py)}L${F(px + Math.cos(nd) * pr * 0.78)} ${F(py + Math.sin(nd) * pr * 0.78)}" stroke="#3a2306" stroke-width="1.8" stroke-linecap="round"/><circle cx="${px}" cy="${F(py)}" r="2" fill="#3a2306"/>`;
    q += `<path d="M${F(px - pr * 0.72)} ${F(py - pr * 0.1)}A${F(pr * 0.74)} ${F(pr * 0.74)} 0 0 1 ${F(px + pr * 0.1)} ${F(py - pr * 0.72)}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>`;
    for (let i = 0; i < 4; i++) { const t = Math.PI / 4 + (i * Math.PI) / 2, rx = px + Math.cos(t) * (pr + 2.1), ry = py + Math.sin(t) * (pr + 2.1); q += `<circle cx="${F(rx)}" cy="${F(ry)}" r="1.8" fill="${lighten(b, 0.2)}" stroke="${darken(b, 0.6)}" stroke-width=".7"/>`; }
    return q;
  },
  face(A, K) {
    const R = A.R, b = A.pal.body, my = K.mouthY; let q = blushAt(A, K.eyeY + R * 0.3, R * 0.56);
    const eyes = K.two ? [-1, 1].map((s) => ({ x: 100 + s * (K.er + 5), y: K.eyeY, er: K.er })) : [{ x: 100, y: K.eyeY, er: K.er }];
    for (const e of eyes) q += drawEye(A, { x: e.x, y: e.y, er: e.er, kind: 'lens', star: A.rk >= 2 });
    q += browsSVG(A, eyes.map((e) => ({ x: e.x, y: e.y, er: e.er + 3 })), 1.32);
    if (A.sick) return q + sickMouth(A, 100, my);
    if (!usesOwnMouth(A)) return q + mouthSVG(A, 100, my - 3, R * 0.2) + whiskersSVG(A, my, R * 0.3);
    const mw = R * 0.34;
    q += `<rect x="${F(100 - mw / 2)}" y="${F(my - 3.5)}" width="${F(mw)}" height="7" rx="3.5" fill="${darken(b, 0.62)}"/>`;
    q += `<path d="M${F(100 - 4.8)} ${F(my - 2)}v4M100 ${F(my - 2)}v4M${F(100 + 4.8)} ${F(my - 2)}v4" stroke="${lighten(b, 0.15)}" stroke-width="1.6" stroke-linecap="round"/>`;
    q += `<path d="M${F(100 + mw / 2 - 5.5)} ${F(my + 2.5)}l2.3 4.6l2.3 -4.6z" fill="#fff" stroke="${darken(b, 0.6)}" stroke-width=".6"/>`;
    return q + whiskersSVG(A, my, R * 0.3);
  },
};
SPECIES_PARTS.scholar = {
  geo(A) {
    const R = A.R, cy = 196 - R * 1.02, rng = A.rng, jt = () => (rng() - 0.5) * 2 * R * 0.04;
    const by = cy + R * 0.95, tLx = 100 - R * 0.62 + jt(), tLy = cy - R * 1.32 + jt(), tRx = 100 + R * 0.62 + jt(), tRy = cy - R * 1.32 + jt(), dipY = cy - R * 0.86;
    const d = `M100 ${F(by)}C${F(100 - R * 0.62)} ${F(by)} ${F(100 - R * 0.95)} ${F(cy + R * 0.55)} ${F(100 - R * 0.9)} ${F(cy - R * 0.2)}C${F(100 - R * 0.87)} ${F(cy - R * 0.66)} ${F(100 - R * 0.8)} ${F(cy - R * 1.04)} ${F(tLx)} ${F(tLy)}Q${F(100 - R * 0.36)} ${F(cy - R * 1.0)} 100 ${F(dipY)}Q${F(100 + R * 0.36)} ${F(cy - R * 1.0)} ${F(tRx)} ${F(tRy)}C${F(100 + R * 0.8)} ${F(cy - R * 1.04)} ${F(100 + R * 0.87)} ${F(cy - R * 0.66)} ${F(100 + R * 0.9)} ${F(cy - R * 0.2)}C${F(100 + R * 0.95)} ${F(cy + R * 0.55)} ${F(100 + R * 0.62)} ${F(by)} 100 ${F(by)}Z`;
    const er = R * 0.28 * A.eyeK, eyeY = cy - R * 0.2;
    return { d, cy, sx: 100, sy: cy, headTop: { x: 100, y: dipY }, brow: dipY + 6.5, bw: R * 0.84, eyeY, er, ex: R * 0.28 * 1.175 * Math.max(1, A.eyeK * 0.92), book: ['#b84a3a', '#3a6cb8', '#3f8f5a'][Math.floor(rng() * 3)], scarAt: { x: 100 + R * 0.6, y: cy - R * 0.62 },
      hat: { x: 100, y: dipY + 4, w: R * 0.44 }, ear: { y: eyeY - 2, dx: R * 0.92 }, neck: { y: cy + R * 0.42, w: R * 0.96 }, gog: { y: dipY + 7, dx: R * 0.24, r: R * 0.14 }, bowAt: { x: 100 + R * 0.5, y: dipY + 1 }, sproutAt: { x: 100, y: dipY + 3 }, visW: R * 0.98 };
  },
  front(A, K) {
    const R = A.R; let q = '';
    for (const s of [-1, 1]) { const fx = 100 + s * R * 0.3; for (const k of [-1, 0, 1]) q += `<ellipse cx="${F(fx + k * 4.2)}" cy="194.5" rx="2.6" ry="3.6" fill="#e2a33a" stroke="#7a4e10" stroke-width="1"/>`; }
    if (A.rk >= 3) {
      const bx = 100 + R * 0.36, by = K.cy + R * 0.66;
      q += `<g transform="translate(${F(bx)} ${F(by)}) rotate(-8)"><rect x="-12" y="-9" width="24" height="17" rx="2" fill="${darken(K.book, 0.45)}"/><rect x="-11" y="-8" width="22" height="16" rx="2" fill="${K.book}"/><rect x="-11" y="5" width="22" height="3" fill="#f4ecd6"/><path d="M-9 6.2h18M-9 7.2h18" stroke="#c9bb98" stroke-width=".5"/><rect x="-11" y="-8" width="3" height="13" fill="${darken(K.book, 0.25)}"/><path d="M-3 -4h9M-3 -1h7" stroke="#f5c451" stroke-width="1.1" opacity=".85"/></g>`;
    }
    return q;
  },
  detail(A, K) {
    const R = A.R, b = A.pal.body, cy = K.cy, disc = A.mat === 'gold' ? '#fff3c4' : mix('#cdeee8', b, 0.1); let q = '';
    if (A.rk >= 1) {
      const by = cy + R * 0.62; q += `<ellipse cx="100" cy="${F(by)}" rx="${F(R * 0.42)}" ry="${F(R * 0.26)}" fill="${mix(b, '#cdeee8', 0.42)}"/>`;
      let ch = ''; [[3, -7], [4, 0], [3, 7]].forEach(([n, dy]) => { for (let i = 0; i < n; i++) { const x = 100 + (i - (n - 1) / 2) * 8.5; ch += `M${F(x - 3)} ${F(by + dy - 1.5)}l3 3l3 -3`; } });
      q += `<path d="${ch}" fill="none" stroke="${darken(mix(b, '#cdeee8', 0.42), 0.3)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    for (const s of [-1, 1]) {
      q += `<path d="M${F(100 + s * R * 0.72)} ${F(cy - R * 0.22)}C${F(100 + s * R * 1.04)} ${F(cy + R * 0.08)} ${F(100 + s * R * 1.0)} ${F(cy + R * 0.52)} ${F(100 + s * R * 0.84)} ${F(cy + R * 0.82)}C${F(100 + s * R * 0.7)} ${F(cy + R * 0.52)} ${F(100 + s * R * 0.6)} ${F(cy + R * 0.12)} ${F(100 + s * R * 0.72)} ${F(cy - R * 0.22)}Z" fill="${darken(b, 0.22)}" stroke="${darken(b, 0.55)}" stroke-width="1.3"/>`;
      let sc = ''; for (let k = 0; k < 3; k++) sc += `M${F(100 + s * R * 0.93)} ${F(cy + R * (0.1 + 0.2 * k))}Q${F(100 + s * R * 0.8)} ${F(cy + R * (0.18 + 0.2 * k))} ${F(100 + s * R * 0.88)} ${F(cy + R * (0.28 + 0.2 * k))}`;
      q += `<path d="${sc}" fill="none" stroke="${lighten(b, 0.18)}" stroke-width="1.3" stroke-linecap="round"/>`;
    }
    const rr = R * 0.28 * 1.65, notch = `M${F(100 - rr * 0.5)} ${F(K.eyeY + rr * 0.62)}L100 ${F(K.eyeY + rr * 1.12)}L${F(100 + rr * 0.5)} ${F(K.eyeY + rr * 0.62)}Z`;
    q += `<g fill="none" stroke="${darken(b, 0.35)}" stroke-width="4" stroke-linejoin="round"><circle cx="${F(100 - K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><circle cx="${F(100 + K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><path d="${notch}"/></g>`;
    q += `<g fill="${disc}"><circle cx="${F(100 - K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><circle cx="${F(100 + K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><path d="${notch}"/></g>`;
    q += `<g fill="none" stroke="${darken(disc, 0.25)}" stroke-opacity=".45" stroke-width="1.2"><circle cx="${F(100 - K.ex)}" cy="${F(K.eyeY)}" r="${F(rr - 3)}"/><circle cx="${F(100 + K.ex)}" cy="${F(K.eyeY)}" r="${F(rr - 3)}"/></g>`;
    return q;
  },
  face(A, K) {
    const R = A.R, ey = K.eyeY; let q = blushAt(A, ey + K.er * 1.05, R * 0.5);
    const eyes = [-1, 1].map((s) => ({ x: 100 + s * K.ex, y: ey, er: K.er }));
    for (const e of eyes) q += drawEye(A, { x: e.x, y: e.y, er: e.er, iris: A.hybrid ? irisFor(A, e.x) : A.night || A.T === 'Legendary' || A.v && A.v.colorway.key !== 'teal' ? undefined : 'pl-owl', star: A.rk >= 2, lidC: mix('#cdeee8', A.pal.body, 0.1) });
    if (A.rk >= 2) {
      let sp = ''; for (const s of [-1, 1]) sp += `<circle cx="${F(100 + s * K.ex)}" cy="${F(ey)}" r="${F(K.er + 3.2)}"/>`;
      q += `<g fill="none" stroke="#5a3a04" stroke-width="4.2">${sp}</g><g fill="none" stroke="#f5c451" stroke-width="2.2">${sp}<path d="M${F(100 - K.ex + K.er + 3)} ${F(ey - 2)}Q100 ${F(ey - 8)} ${F(100 + K.ex - K.er - 3)} ${F(ey - 2)}"/></g><circle cx="${F(100 - K.ex - K.er * 0.6)}" cy="${F(ey - K.er * 0.85)}" r="1.2" fill="#fff6c8"/><circle cx="${F(100 + K.ex - K.er * 0.6)}" cy="${F(ey - K.er * 0.85)}" r="1.2" fill="#fff6c8"/>`;
    }
    // owl brows sit on the facial disc
    q += browsSVG(A, eyes.map((e) => ({ x: e.x, y: e.y, er: R * 0.3 })), 1.55);
    const by = ey + R * 0.28 * 0.95 + (K.er - R * 0.28) * 0.5;
    const open = A.ex === 'grin' || A.ex === 'tongue' || A.ex === 'wink';
    if (open) q += `<path d="M95.6 ${F(by + 1)}Q100 ${F(by + 9)} 104.4 ${F(by + 1)}Z" fill="#2a1218"/>` + (A.ex !== 'grin' ? `<path d="M97.4 ${F(by + 3)}h5.2v3.4q0 3.2-2.6 3.2t-2.6-3.2z" fill="${TONGUE}"/>` : '');
    q += `<path d="M100 ${F(by - 6)}L104.6 ${F(by)}L100 ${F(by + (open ? 3 : 7))}L95.4 ${F(by)}Z" fill="url(#pl-beak)" stroke="#6b4a12" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/><path d="M98.6 ${F(by - 3)}L100 ${F(by - 4.6)}" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>`;
    if (A.sick) q += sickMouth(A, 100, by + 12);
    return q + whiskersSVG(A, by + 2, R * 0.2);
  },
};
SPECIES_PARTS.moth = {
  geo(A) {
    const R = A.R, cy = 196 - R * 0.97, r = R * 0.97, rng = A.rng, pts = [];
    for (let i = 0; i < 30; i++) { const a = -Math.PI / 2 + (Math.PI * 2 * i) / 30, rr = (i % 2 ? r * 0.92 : r) * (1 + (rng() - 0.5) * 0.03); pts.push({ x: 100 + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.96 }); }
    const top = cy - r * 0.94, er = R * 0.3 * A.eyeK, eyeY = cy - R * 0.34;
    return { d: smoothClosedPath(pts), cy, sx: 100, sy: cy, headTop: { x: 100, y: top }, brow: top + 10, bw: R * 0.6, eyeY, er, ex: R * 0.3 * 1.25 * Math.max(1, A.eyeK * 0.92), flap: (rng() - 0.5) * 8,
      hat: { x: 100, y: top + 5, w: R * 0.5 }, ear: { y: eyeY, dx: R * 0.95 }, neck: { y: cy + R * 0.4, w: R * 0.95 }, gog: { y: top + 8, dx: R * 0.24, r: R * 0.14 }, bowAt: { x: 100 - R * 0.5, y: top + 9 }, sproutAt: { x: 100, y: top + 3 }, visW: R * 0.98 };
  },
  ornament(A, K) { return mothAntennae(A, 100, K.headTop.y); },
  back(A, K) {
    const R = A.R, b = A.pal.body, cy = K.cy, X = (o) => 100 - o, s = A.sid;
    const up = `M${F(X(R * 0.4))} ${F(cy - R * 0.35)}C${F(X(R * 0.85))} ${F(cy - R * 1.25)} ${F(X(R * 1.4))} ${F(cy - R * 1.38)} ${F(X(R * 1.6))} ${F(cy - R * 1.12)}C${F(X(R * 1.74))} ${F(cy - R * 0.85)} ${F(X(R * 1.72))} ${F(cy - R * 0.08)} ${F(X(R * 1.52))} ${F(cy + R * 0.1)}C${F(X(R * 1.2))} ${F(cy + R * 0.28)} ${F(X(R * 0.8))} ${F(cy + R * 0.15)} ${F(X(R * 0.5))} ${F(cy + R * 0.05)}Z`;
    const lo = `M${F(X(R * 0.45))} ${F(cy + R * 0.02)}C${F(X(R * 1.0))} ${F(cy + R * 0.05)} ${F(X(R * 1.38))} ${F(cy + R * 0.45)} ${F(X(R * 1.18))} ${F(cy + R * 0.78)}C${F(X(R * 1.0))} ${F(cy + R * 0.98)} ${F(X(R * 0.62))} ${F(cy + R * 0.8)} ${F(X(R * 0.42))} ${F(cy + R * 0.45)}Z`;
    const icx = X(R * 1.1), icy = cy - R * 0.55, wg = A.mat === 'gold' ? 'url(#pl-mgold)' : A.mat === 'chrome' ? 'url(#pl-mchrome)' : `url(#wg-${s})`, eb = darken(A.mat === 'gold' ? '#c4871a' : b, 0.55);
    let wing = `<path d="${lo}" fill="${wg}" stroke="${eb}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/><path d="${lo}" fill="none" stroke="${lighten(b, 0.6)}" stroke-width="1.4"/>`;
    wing += `<path d="${up}" fill="${wg}" stroke="${eb}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/><path d="${up}" fill="none" stroke="${lighten(b, 0.6)}" stroke-width="1.5"/>`;
    if (A.mat === 'holo' || A.mat === 'iridescent') wing += `<path d="${up}" fill="url(#pl-${A.mat === 'iridescent' ? 'irid' : 'holo'})" opacity=".55" style="mix-blend-mode:overlay"/><path d="${lo}" fill="url(#pl-${A.mat === 'iridescent' ? 'irid' : 'holo'})" opacity=".55" style="mix-blend-mode:overlay"/>`;
    wing += `<path d="${up}" transform="translate(${F(icx)} ${F(icy)}) scale(.74) translate(${F(-icx)} ${F(-icy)})" fill="none" stroke="${lighten(b, 0.65)}" stroke-width="1.3" stroke-dasharray="3 3" opacity=".5"/>`;
    wing += `<path d="M${F(X(R * 0.45))} ${F(cy - R * 0.28)}Q${F(X(R * 1.0))} ${F(cy - R * 0.9)} ${F(X(R * 1.5))} ${F(cy - R * 1.02)}M${F(X(R * 0.45))} ${F(cy - R * 0.25)}Q${F(X(R * 1.1))} ${F(cy - R * 0.5)} ${F(X(R * 1.66))} ${F(cy - R * 0.45)}M${F(X(R * 0.45))} ${F(cy - R * 0.2)}Q${F(X(R * 1.0))} ${F(cy - R * 0.05)} ${F(X(R * 1.45))} ${F(cy + R * 0.05)}M${F(X(R * 0.5))} ${F(cy + R * 0.12)}Q${F(X(R * 0.85))} ${F(cy + R * 0.3)} ${F(X(R * 1.1))} ${F(cy + R * 0.65)}" fill="none" stroke="${lighten(b, 0.7)}" stroke-width="1" opacity=".4"/>`;
    if (A.rk >= 2) { const ex = X(R * 1.18), ey = cy - R * 0.6; wing += `<circle cx="${F(ex)}" cy="${F(ey)}" r="9.5" fill="#f6e7d3" stroke="${darken(b, 0.45)}" stroke-width="1"/><circle cx="${F(ex)}" cy="${F(ey)}" r="6.2" fill="${darken(b, 0.6)}"/><circle ${A.rk >= 3 ? 'class="pl-pulse" ' : ''}cx="${F(ex)}" cy="${F(ey)}" r="3.6" fill="${A.rk >= 3 ? A.pal.glow : lighten(b, 0.2)}"/><circle cx="${F(ex - 1.2)}" cy="${F(ey - 1.2)}" r="1.6" fill="#fff"/>`; const lx = X(R * 0.95), ly = cy + R * 0.5; wing += `<circle cx="${F(lx)}" cy="${F(ly)}" r="5" fill="#f6e7d3"/><circle cx="${F(lx)}" cy="${F(ly)}" r="2.8" fill="${darken(b, 0.6)}"/>`; }
    const tr = `rotate(${F(K.flap)} ${F(X(R * 0.45))} ${F(cy - R * 0.2)})`;
    const pair = `<g transform="${tr}"><g class="pl-wing">${wing}</g></g><g transform="matrix(-1 0 0 1 200 0)"><g transform="${tr}"><g class="pl-wing">${wing}</g></g></g>`;
    // a Legendary moth's upgrade is a bigger wingspan
    return A.ti >= 4 ? `<g transform="translate(100 ${F(cy)}) scale(1.16) translate(-100 ${F(-cy)})">${pair}</g>` : pair;
  },
  detail(A, K) {
    const R = A.R, b = A.pal.body, cy = K.cy, fx = 100, fy = cy + R * 0.5;
    const cl = [[0, 0, 9.5]]; for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 * i) / 8; cl.push([Math.cos(a) * R * 0.27, Math.sin(a) * R * 0.15, 7.2]); }
    const circ = (dx, dy) => cl.map(([x, y, r]) => `<circle cx="${F(fx + x + dx)}" cy="${F(fy + y + dy)}" r="${r}"/>`).join('');
    let q = `<g fill="${darken(b, 0.45)}" opacity=".35">${circ(0, 3)}</g><g fill="${darken('#e8d2b8', 0.45)}" stroke="${darken('#e8d2b8', 0.45)}" stroke-width="3">${circ(0, 0)}</g><g fill="url(#pl-collar)">${circ(0, 0)}</g>`;
    q += `<path d="M${F(fx - R * 0.26)} ${F(fy - 3)}q3 -4 8 -4M${F(fx - 4)} ${F(fy - 8)}q3 -3 8 -2" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
    let tuft = ''; for (const k of [-1, 0, 1]) tuft += `M${F(100 + k * 7)} ${F(K.headTop.y + 6)}q${F(k * 2 - 2)} -6 ${F(k * 3 + 2)} -9`;
    q += `<path d="${tuft}" fill="none" stroke="${lighten(b, 0.35)}" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`;
    return q;
  },
  face(A, K) {
    const R = A.R, ey = K.eyeY; let q = blushAt(A, ey + K.er * 1.0, R * 0.5);
    const eyes = [-1, 1].map((s) => ({ x: 100 + s * K.ex, y: ey, er: K.er }));
    for (const e of eyes) q += drawEye(A, { x: e.x, y: e.y, er: e.er, star: A.rk >= 2 });
    q += browsSVG(A, eyes);
    const my = ey + K.er + 3.5;
    if (A.sick) return q + sickMouth(A, 100, my + 1);
    if (!usesOwnMouth(A)) return q + mouthSVG(A, 100, my, R * 0.15) + whiskersSVG(A, my + 2, R * 0.22);
    q += `<path d="M94.5 ${F(my)}Q97.2 ${F(my + 3.6)} 100 ${F(my)}Q102.8 ${F(my + 3.6)} 105.5 ${F(my)}" fill="none" stroke="${darken(A.pal.body, 0.6)}" stroke-width="1.8" stroke-linecap="round"/>`;
    return q + whiskersSVG(A, my + 2, R * 0.22);
  },
  front(A, K) {
    if (A.rk < 3) return '';
    const R = A.R; let q = '';
    for (let i = 0; i < 5; i++) { const s = i % 2 ? 1 : -1, x = 100 + s * R * (1.0 + A.rng() * 0.45), y = K.cy + R * (0.55 + A.rng() * 0.45); q += `<circle class="pl-fall" cx="${F(x)}" cy="${F(y)}" r="${F(1 + A.rng() * 0.8)}" fill="#fff" opacity=".55" style="animation-delay:-${F(i * 0.5)}s"/>`; }
    return q;
  },
};
SPECIES_PARTS.prism = {
  geo(A) {
    const R = A.R, cy = 196 - R * 0.92 - 4, rng = A.rng, J = () => (rng() - 0.5) * 2 * R * 0.05;
    const P = [[100 + J(), cy - R * 1.12 + J()], [100 + R * 0.82 + J(), cy - R * 0.55 + J()], [100 + R * 0.98 + J(), cy + R * 0.18 + J()], [100 + R * 0.55 + J(), cy + R * 0.92], [100 - R * 0.55 + J(), cy + R * 0.92], [100 - R * 0.98 + J(), cy + R * 0.18 + J()], [100 - R * 0.82 + J(), cy - R * 0.55 + J()]];
    const er = R * 0.25 * A.eyeK, eyeY = cy - R * 0.14;
    return { d: pathOf(P, true), P, cy, sx: 100, sy: cy, Fc: [100 - R * 0.12, cy - R * 0.18], headTop: { x: P[0][0], y: P[0][1] }, brow: cy - R * 0.5, bw: R * 0.78, eyeY, er, ex: R * 0.25 * 1.2 * Math.max(1, A.eyeK * 0.92), hot: { x: 100 - R * 0.6, y: cy - R * 0.1 }, scarAt: { x: 100 + R * 0.55, y: cy - R * 0.38 },
      hat: { x: 100, y: P[0][1] + 14, w: R * 0.36 }, ear: { y: cy - R * 0.36, dx: R * 0.88 }, neck: { y: cy + R * 0.42, w: R * 0.92 }, gog: { y: cy - R * 0.55, dx: R * 0.22, r: R * 0.13 }, bowAt: { x: 100 - R * 0.42, y: cy - R * 0.84 }, sproutAt: { x: P[0][0], y: P[0][1] + 4 }, visW: R * 1.0 };
  },
  inner(A, K) {
    const b = A.pal.body, P = K.P, [fx, fy] = K.Fc; let q = '';
    for (let i = 0; i < P.length; i++) {
      const a = P[i], c2 = P[(i + 1) % P.length]; let nx = c2[1] - a[1], ny = -(c2[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const sh = (nx * -0.6 + ny * -0.8 + 1) / 2;
      q += `<path d="${pathOf([[fx, fy], a, c2], true)}" fill="${sh > 0.5 ? lighten(b, 0.08 + 0.45 * (sh - 0.5) * 2) : darken(b, 0.2 * (1 - sh * 2) + 0.04)}" stroke="${lighten(b, 0.75)}" stroke-width=".9" stroke-opacity=".7" stroke-linejoin="round"/>`;
    }
    return q;
  },
  shards(A, K) {
    const R = A.R, n = [0, 1, 3, 5, 5][A.rk], P = K.P, rng = A.rng; let q = '';
    const first = rng() < 0.5 ? -1 : 1;
    for (let k = 0; k < n; k++) {
      const side = k === 2 ? 0 : (k % 2 === 0 ? first : -first), t = 0.25 + rng() * 0.45, h = R * (k === 2 ? 0.75 + rng() * 0.12 : 0.45 + rng() * 0.25);
      let x, y, ang;
      if (side === 0) { x = P[0][0] + (rng() - 0.5) * 6; y = P[0][1] + 12; ang = (rng() - 0.5) * 16; }
      else { const e = side > 0 ? P[1] : P[6]; x = P[0][0] + (e[0] - P[0][0]) * t; y = P[0][1] + (e[1] - P[0][1]) * t; x -= side * 5; y += 7; ang = side * (16 + rng() * 26); }
      q += prismShard(A, x, y, ang, h);
    }
    return q;
  },
  ornament(A, K) { return SPECIES_PARTS.prism.shards(A, K); },
  back(A, K) {
    const R = A.R, b = A.pal.body; let q = '';
    for (const s of [-1, 1]) { const x = 100 + s * R * 0.3; q += `<path d="M${F(x - 8)} 187L${F(x + 8)} 187L${F(x + 5)} 197L${F(x - 5)} 197Z" fill="${darken(b, 0.25)}" stroke="${darken(b, 0.6)}" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/><path d="M${F(x - 8)} 187L${F(x)} 187L${F(x)} 197L${F(x - 5)} 197Z" fill="${lighten(b, 0.15)}"/>`; }
    return q;
  },
  detail(A, K) {
    const R = A.R, b = A.pal.body, P = K.P, [fx, fy] = K.Fc; let q = '';
    const sliv = (a, c2, inset, t0, t1, w) => { const dx = c2[0] - a[0], dy = c2[1] - a[1], l = Math.hypot(dx, dy); let nx = -dy / l, ny = dx / l; const mx = (a[0] + c2[0]) / 2, my = (a[1] + c2[1]) / 2; if ((100 - mx) * nx + (K.cy - my) * ny < 0) { nx = -nx; ny = -ny; } const p = (t, o) => [a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]; return `<path d="${pathOf([p(t0, inset), p(t1, inset), p(t1 - 0.04, inset + w), p(t0 + 0.04, inset + w)], true)}" fill="#fff" opacity=".7"/>`; };
    q += sliv(P[6], P[0], 3.5, 0.12, 0.85, 3) + sliv(P[5], P[6], 3.5, 0.2, 0.75, 2.4);
    q += `<circle class="pl-pulse" cx="${F(fx)}" cy="${F(fy)}" r="${F(R * 0.55)}" fill="url(#pl-glow-w)"/>`;
    if (A.rk >= 2) {
      const gx = 100, gy = K.cy + R * 0.5, rng = A.rng, ring = (r0) => { const pts = []; for (let i = 0; i < 14; i++) { const a = (Math.PI * 2 * i) / 14, rr = r0 * (i % 2 ? 0.86 : 1) * (1 + (rng() - 0.5) * 0.1); pts.push([gx + Math.cos(a) * rr, gy + Math.sin(a) * rr * 0.9]); } return pathOf(pts, true); };
      q += `<path d="${ring(R * 0.28)}" fill="#2a3f8a" stroke="${darken(b, 0.55)}" stroke-width="1.4" stroke-linejoin="round"/><path d="${ring(R * 0.21)}" fill="#6f8df0"/><path d="${ring(R * 0.15)}" fill="#bfe9ff"/><circle cx="${gx}" cy="${F(gy)}" r="${F(R * 0.075)}" fill="#1b2a66"/>`;
      let teeth = ''; for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 * i) / 8 + 0.2, r1 = R * 0.13, r2 = R * 0.06; teeth += `M${F(gx + Math.cos(a - 0.2) * r1)} ${F(gy + Math.sin(a - 0.2) * r1 * 0.9)}L${F(gx + Math.cos(a) * r2)} ${F(gy + Math.sin(a) * r2 * 0.9)}L${F(gx + Math.cos(a + 0.2) * r1)} ${F(gy + Math.sin(a + 0.2) * r1 * 0.9)}Z`; }
      q += `<path d="${teeth}" fill="#fff" opacity=".92"/>`;
    }
    if (A.rk >= 3) { const e = pathOf([P[5], P[6], P[0], P[1]]); q += `<g fill="none" stroke-width="1.3" opacity=".5" stroke-linejoin="round"><path d="${e}" stroke="#ff6b8b" transform="translate(-1.2 .4)"/><path d="${e}" stroke="#6ee7a5" transform="translate(0 -1.2)"/><path d="${e}" stroke="#67a8f0" transform="translate(1.2 .4)"/></g>`; }
    return q;
  },
  face(A, K) {
    const R = A.R, ey = K.eyeY; let q = blushAt(A, ey + K.er * 1.0, R * 0.5);
    const eyes = [-1, 1].map((s) => ({ x: 100 + s * K.ex, y: ey, er: K.er }));
    for (const e of eyes) q += drawEye(A, { x: e.x, y: e.y, er: e.er, star: true });
    q += browsSVG(A, eyes);
    const my = ey + K.er + 5;
    if (A.sick) return q + sickMouth(A, 100, my);
    if (!usesOwnMouth(A)) return q + mouthSVG(A, 100, my - 1.5, R * 0.14) + whiskersSVG(A, my, R * 0.2);
    q += `<path d="M95 ${F(my - 1)}Q100 ${F(my + 3.5)} 105 ${F(my - 1)}" fill="none" stroke="${darken(A.pal.body, 0.65)}" stroke-width="2.2" stroke-linecap="round"/><path d="${star4(107.5, my - 2.5, 2)}" fill="#fff"/>`;
    return q + whiskersSVG(A, my, R * 0.2);
  },
};
SPECIES_PARTS.lumen = {
  geo(A) {
    const R = A.R, cy = 128, rx = R * 0.9, ry = R * 0.98, capBot = cy - ry + 6, capTop = capBot - R * 0.28, ringY = capTop - 7;
    const d = `M${F(100 - rx)} ${cy}A${F(rx)} ${F(ry)} 0 1 1 ${F(100 + rx)} ${cy}A${F(rx)} ${F(ry)} 0 1 1 ${F(100 - rx)} ${cy}Z`;
    const er = R * 0.2 * A.eyeK, eyeY = cy - R * 0.06;
    return { d, cy, rx, ry, capBot, capTop, ringY, sx: 100, sy: cy, headTop: { x: 100, y: ringY - 10.7 }, brow: cy - R * 0.6, bw: R * 0.72, eyeY, er, spec: { x: 100 - R * 0.42, y: cy - R * 0.5 }, scarAt: { x: 100 + R * 0.5, y: cy - R * 0.45 },
      hat: { x: 100, y: capTop + 2, w: R * 0.4 }, ear: { y: eyeY, dx: rx + 1 }, neck: { y: capBot + 8, w: R * 0.66 }, gog: { y: capBot + 14, dx: R * 0.22, r: R * 0.13 }, bowAt: { x: 100 - R * 0.55, y: capBot - 3 }, sproutAt: { x: 100 + 11, y: capTop + 1 }, visW: rx + 2 };
  },
  aura(A, K) { return `<circle cx="100" cy="${F(K.cy)}" r="${F(A.R + 36)}" fill="url(#la-${A.sid})"/>`; },
  ornament(A, K) { return lumenRing(100, K.ringY); },
  detail(A, K) {
    const R = A.R, cy = K.cy, rx = K.rx, ry = K.ry; let q = '';
    q += `<g transform="translate(100 ${F(cy + R * 0.62)}) scale(1.05)"><g class="pl-flicker"><path d="M0 10C8 2 6 -8 0 -16C-6 -8 -8 2 0 10Z" fill="url(#pl-flame)" opacity=".7"/></g></g>`;
    const offs = A.rk >= 2 ? [-0.8, -0.4, 0.4, 0.8] : [-0.62, 0.62];
    let bars = ''; for (const o of offs) bars += `M${F(100 + o * rx * 0.62)} ${F(K.capBot - 2)}Q${F(100 + o * rx * 1.28)} ${F(cy)} ${F(100 + o * rx * 0.66)} ${F(cy + ry - 5)}`;
    if (A.rk >= 2) bars += `M${F(100 - rx * 0.92)} ${F(cy + R * 0.38)}Q100 ${F(cy + R * 0.6)} ${F(100 + rx * 0.92)} ${F(cy + R * 0.38)}`;
    const bar = A.mat === 'gold' ? ['#5a3a04', '#c4871a', '#fff0a6'] : A.mat === 'chrome' ? ['#1d2029', '#8994a6', '#ffffff'] : ['#2a180a', '#4a2c12', '#c98a4a'];
    q += `<path d="${bars}" fill="none" stroke="${bar[0]}" stroke-width="5" stroke-linecap="round" opacity=".55"/><path d="${bars}" fill="none" stroke="${bar[1]}" stroke-width="3.2" stroke-linecap="round"/><path d="${bars}" transform="translate(-.9 -.3)" fill="none" stroke="${bar[2]}" stroke-width="1" stroke-linecap="round"/>`;
    const tw = R * 0.7, bw = R * 1.2, cap = A.mat === 'gold' ? 'url(#pl-mgold)' : A.mat === 'chrome' ? 'url(#pl-mchrome)' : 'url(#pl-bronze)';
    q += `<path d="M${F(100 - tw / 2)} ${F(K.capTop)}L${F(100 + tw / 2)} ${F(K.capTop)}L${F(100 + bw / 2)} ${F(K.capBot)}L${F(100 - bw / 2)} ${F(K.capBot)}Z" fill="${cap}" stroke="#2a180a" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/><rect x="${F(100 - bw / 2 - 2)}" y="${F(K.capBot - 3)}" width="${F(bw + 4)}" height="5" rx="2.5" fill="${A.mat === 'vinyl' ? '#8a5a24' : bar[1]}" stroke="#2a180a" stroke-width="1.2"/><path d="M${F(100 - tw / 2 + 3)} ${F(K.capTop + 2.5)}L${F(100 - bw / 2 + 6)} ${F(K.capBot - 4)}" stroke="#f3c98a" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`;
    return q;
  },
  front(A, K) {
    const R = A.R, cy = K.cy, ry = K.ry, top = cy + ry - 7, tw = R * 1.05, bw = R * 0.72; let q = '';
    const cap = A.mat === 'gold' ? 'url(#pl-mgold)' : A.mat === 'chrome' ? 'url(#pl-mchrome)' : 'url(#pl-bronze)';
    for (const s of [-1, 1]) q += `<ellipse cx="${F(100 + s * R * 0.24)}" cy="194" rx="5" ry="3" fill="#3d2410"/>`;
    q += `<path d="M${F(100 - tw / 2)} ${F(top)}L${F(100 + tw / 2)} ${F(top)}L${F(100 + bw / 2)} 192L${F(100 - bw / 2)} 192Z" fill="${cap}" stroke="#2a180a" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/><path d="M${F(100 - tw / 2 + 4)} ${F(top + 2)}H${F(100 + tw / 2 - 4)}" stroke="#f3c98a" stroke-width="1.2" opacity=".7"/>`;
    if (A.rk >= 2) for (const s of [-1, 1]) { const x = 100 + s * R * 0.62, y = cy + ry * 0.62; q += `<path d="${dropP(x, y, 9)}" fill="url(#ld-${A.sid})" stroke="${darken(A.pal.body, 0.5)}" stroke-width="1.6" paint-order="stroke"/><circle cx="${F(x - 1.2)}" cy="${F(y + 7.5)}" r="1.1" fill="#fff6d8"/>`; }
    if (A.rk >= 3) for (let i = 0; i < 6; i++) { const x = 100 + (A.rng() - 0.5) * R * 1.3, y = K.capTop - 4 - A.rng() * 22; q += `<circle class="pl-rise" cx="${F(x)}" cy="${F(y)}" r="${F(1.2 + A.rng() * 1.2)}" fill="${lighten(A.pal.body, 0.4)}" style="animation-delay:-${F(i * 0.42)}s"/>`; }
    return q;
  },
  face(A, K) {
    const R = A.R, ey = K.eyeY, ex = K.er * 1.15 / A.eyeK * Math.max(1, A.eyeK * 0.95); let q = '';
    const eyes = [-1, 1].map((s) => ({ x: 100 + s * ex, y: ey, er: K.er }));
    for (const e of eyes) q += drawEye(A, { x: e.x, y: e.y, er: e.er, kind: A.hybrid ? undefined : 'dark', lidC: lighten(A.pal.body, 0.45), noGlow: true });
    q += browsSVG(A, eyes.map((e) => ({ x: e.x, y: e.y, er: e.er * 1.15 })), 1.5);
    const my = K.cy + R * 0.2;
    if (A.sick) return q + sickMouth(A, 100, my);
    if (!usesOwnMouth(A)) return q + mouthSVG(A, 100, my - 3, R * 0.13, { hole: '#fffbe8', line: darken(A.pal.body, 0.55) }) + whiskersSVG(A, my, R * 0.2);
    q += `<ellipse cx="100" cy="${F(my)}" rx="4.6" ry="5" fill="#fffbe8" stroke="${darken(A.pal.body, 0.55)}" stroke-width="1.6"/><ellipse cx="100" cy="${F(my)}" rx="7.5" ry="8" fill="none" stroke="#fff2a0" stroke-width="2" opacity=".35"/>`;
    return q + whiskersSVG(A, my, R * 0.2);
  },
};
SPECIES_PARTS.hydra = {
  geo(A) {
    const R = A.R, cy = 196 - R * 1.02, top = cy - R * 0.95, sideY = cy + R * 0.55, rimY = cy + R * 0.9, rng = A.rng;
    let d = `M${F(100 - R * 1.15)} ${F(rimY)}C${F(100 - R * 1.02)} ${F(cy + R * 0.78)} ${F(100 - R * 0.96)} ${F(cy + R * 0.68)} ${F(100 - R * 0.95)} ${F(sideY)}C${F(100 - R * 0.98)} ${F(cy - R * 0.3)} ${F(100 - R * 0.55)} ${F(top)} 100 ${F(top)}C${F(100 + R * 0.55)} ${F(top)} ${F(100 + R * 0.98)} ${F(cy - R * 0.3)} ${F(100 + R * 0.95)} ${F(sideY)}C${F(100 + R * 0.96)} ${F(cy + R * 0.68)} ${F(100 + R * 1.02)} ${F(cy + R * 0.78)} ${F(100 + R * 1.15)} ${F(rimY)}`;
    const seg = (2.3 * R) / 4; for (let k = 0; k < 4; k++) { const xa = 100 + R * 1.15 - k * seg, xb = xa - seg, amp = 4 + rng() * 3; d += `Q${F((xa + xb) / 2)} ${F(rimY + (k % 2 ? -amp : amp))} ${F(xb)} ${F(rimY)}`; }
    d += 'Z';
    const n = [3, 4, 5, 6, 7, 7][A.ti], stalks = A.rk >= 2 && !A.other && A.look.orn > 0 ? 2 : 0;
    const eyes = [{ x: 100, y: cy - R * 0.28, er: R * 0.24 * A.eyeK }];
    for (let i = 1; i < n - stalks; i++) {
      let er = R * (0.1 + rng() * 0.07), placed = null;
      for (let shrink = 0; shrink < 3 && !placed; shrink++, er *= 0.85) for (let t = 0; t < 120 && !placed; t++) {
        const x = 100 + (rng() * 2 - 1) * R * 0.78, y = cy - R * 0.78 + rng() * R * 0.9;
        const ax = (x - 100) / (R * 0.95 - er - 4), ay = (y - (cy + R * 0.35)) / (R * 1.3 - er - 4);
        if (ax * ax + ay * ay > 1 || y + er > cy + R * 0.2) continue;
        if (eyes.every((o) => Math.hypot(o.x - x, o.y - y) > o.er + er + 3.5)) placed = { x, y, er };
      }
      if (placed) eyes.push(placed);
    }
    eyes.forEach((e) => (e.delay = rng() * 4));
    const st = []; for (let i = 0; i < stalks; i++) { const s = i ? 1 : -1; st.push({ bx: 100 + s * R * 0.3, by: top + R * 0.14, x: 100 + s * (R * 0.46 + rng() * 6), y: top - 12 - rng() * 6, er: R * (0.12 + rng() * 0.03), delay: rng() * 4 }); }
    return { d, cy, sx: 100, sy: cy, rimY, top, eyes, st, headTop: { x: 100, y: top }, brow: cy - R * 0.62, bw: R * 0.78, eyeY: cy - R * 0.28, er: R * 0.24 * A.eyeK, nuc: blobPoints(100 + (rng() - 0.5) * 8, cy + R * 0.2, R * 0.3, 8, 0.2, rng), bub: [0, 1, 2, 3, 4].map(() => [100 + (rng() * 2 - 1) * R * 0.7, cy + R * (0.05 + rng() * 0.55), 2 + rng() * 4]), scarAt: { x: 100 + R * 0.58, y: cy - R * 0.55 },
      hat: { x: 100, y: top + 5, w: R * 0.46 }, ear: { y: cy - R * 0.25, dx: R * 0.92 }, neck: { y: cy + R * 0.62, w: R * 1.02 }, gog: { y: top + 9, dx: R * 0.22, r: R * 0.13 }, bowAt: { x: 100 - R * 0.52, y: top + 12 }, sproutAt: { x: 100, y: top + 2 }, visW: R * 0.96 };
  },
  ornament(A, K) { let q = ''; for (const e of K.st) q += stalkEye(A, e.bx, e.by, e.x, e.y, e.er, e.delay); return q; },
  back(A, K) {
    const R = A.R, b = A.pal.body, cy = K.cy; let q = '';
    if (A.rk >= 2) {
      const tf = `fill="${bodyFill(A)}" stroke="${darken(b, 0.6)}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"`;
      q += `<path d="${tendrilPath(100 - R * 0.8, cy + R * 0.15, Math.PI * 1.08, R * 0.75, -3.2, 8)}" ${tf}/><path d="${tendrilPath(100 + R * 0.8, cy + R * 0.05, -Math.PI * 0.08, R * 0.75, 3.2, 8)}" ${tf}/><path d="${tendrilPath(100 + R * 0.35, K.top + R * 0.2, -Math.PI * 0.38, R * 0.6, 3.6, 7)}" ${tf}/>`;
    }
    q += `<ellipse cx="100" cy="${F(cy + R * 0.88)}" rx="${F(R * 1.2)}" ry="${F(R * 0.17)}" fill="${darken(b, 0.2)}" opacity=".75"/>`;
    return q;
  },
  detail(A, K) {
    const R = A.R, b = A.pal.body; let q = `<path d="${smoothClosedPath(K.nuc)}" fill="${darken(b, 0.45)}" opacity=".2"/>`;
    if (A.rk >= 2) for (const [x, y, r] of K.bub) q += `<circle cx="${F(x)}" cy="${F(y)}" r="${F(r)}" fill="${lighten(b, 0.3)}" fill-opacity=".15" stroke="${lighten(b, 0.6)}" stroke-opacity=".6" stroke-width="1"/><circle cx="${F(x - r * 0.35)}" cy="${F(y - r * 0.35)}" r="${F(Math.max(0.7, r * 0.25))}" fill="#fff" opacity=".85"/>`;
    q += `<path d="M${F(100 - R * 0.9)} ${F(K.rimY + 5)}Q100 ${F(K.rimY + 12)} ${F(100 + R * 0.9)} ${F(K.rimY + 5)}" fill="none" stroke="${lighten(b, 0.45)}" stroke-opacity=".45" stroke-width="1.3" stroke-linecap="round"/>`;
    return q;
  },
  face(A, K) {
    const R = A.R, my = K.cy + R * 0.3; let q = blushAt(A, my - 3, R * 0.5);
    for (const e of K.eyes) q += drawEye(A, { x: e.x, y: e.y, er: e.er, star: A.rk >= 2 && e.er > R * 0.2, delay: e.delay });
    q += browsSVG(A, [K.eyes[0]], 1.4);
    if (A.sick) return q + sickMouth(A, 100, my + 3);
    const w = R * 0.25;
    if (!usesOwnMouth(A)) {
      q += mouthSVG(A, 100, my, w * 0.92);
      if (A.ex === 'grin' || A.ex === 'determined') q += `<path d="M${F(100 - w * 0.62 - 2.2)} ${F(my + (A.ex === 'grin' ? 1 : w * 0.36))}l2.2 4.2l2.2 -4.2zM${F(100 + w * 0.62 - 2.2)} ${F(my + (A.ex === 'grin' ? 1 : w * 0.36))}l2.2 4.2l2.2 -4.2z" fill="#fff" stroke="${darken(A.pal.body, 0.6)}" stroke-width=".5"/>`;
      return q + whiskersSVG(A, my + 2, R * 0.3);
    }
    q += `<path d="M${F(100 - w)} ${F(my)}Q100 ${F(my + R * 0.3)} ${F(100 + w)} ${F(my)}Q100 ${F(my + R * 0.08)} ${F(100 - w)} ${F(my)}Z" fill="#0d2417" stroke="${darken(A.pal.body, 0.55)}" stroke-width="1.4" stroke-linejoin="round"/>`;
    q += `<path d="M${F(100 - R * 0.13 - 2.4)} ${F(my + 2.2)}l2.4 4.6l2.4 -4.6zM${F(100 + R * 0.13 - 2.4)} ${F(my + 2.2)}l2.4 4.6l2.4 -4.6z" fill="#fff"/>`;
    q += `<path d="${dropP(100 + w - 2, my + 2, 6)}" fill="${lighten(A.pal.body, 0.55)}" opacity=".85"/>`;
    return q + whiskersSVG(A, my + 2, R * 0.3);
  },
};
SPECIES_PARTS.wisp = {
  geo(A) {
    const R = A.R, cy = 128, s = A.rng() < 0.5 ? -1 : 1, X = (o) => 100 + s * o;
    const d = `M${F(X(-R))} ${cy}A${F(R)} ${F(R)} 0 0 ${s > 0 ? 1 : 0} ${F(X(R))} ${cy}L${F(X(R * 0.98))} ${F(cy + R * 0.7)}Q${F(X(R * 0.75))} ${F(cy + R * 0.98)} ${F(X(R * 0.5))} ${F(cy + R * 0.74)}Q${F(X(R * 0.25))} ${F(cy + R * 1.0)} ${F(X(0))} ${F(cy + R * 0.76)}Q${F(X(-R * 0.25))} ${F(cy + R * 1.02)} ${F(X(-R * 0.5))} ${F(cy + R * 0.8)}Q${F(X(-R * 0.82))} ${F(cy + R * 1.1)} ${F(X(-R * 1.14))} ${F(cy + R * 0.9)}Q${F(X(-R * 1.32))} ${F(cy + R * 0.8)} ${F(X(-R * 1.2))} ${F(cy + R * 0.6)}Q${F(X(-R * 1.06))} ${F(cy + R * 0.74)} ${F(X(-R * 0.98))} ${F(cy + R * 0.5)}Z`;
    const er = R * 0.27 * A.eyeK, eyeY = cy - R * 0.06;
    return { d, cy, sx: 100, sy: cy, float: true, headTop: { x: 100, y: cy - R }, brow: cy - R * 0.5, bw: R * 0.86, eyeY, er, scarAt: { x: 100 + R * 0.55, y: cy - R * 0.5 },
      hat: { x: 100, y: cy - R + 6, w: R * 0.56 }, ear: { y: cy - R * 0.12, dx: R * 1.0 }, neck: { y: cy + R * 0.5, w: R * 1.02 }, gog: { y: cy - R * 0.72, dx: R * 0.24, r: R * 0.14 }, bowAt: { x: 100 - R * 0.6, y: cy - R * 0.72 }, sproutAt: { x: 100 + 10, y: cy - R + 1 }, visW: R * 1.04 };
  },
  ornament(A, K) { if (A.v && A.v.accessory && A.v.accessory.key === 'beanie') return ''; return wispFlame(A, K.headTop.x, K.headTop.y, 1.4); },
  detail(A, K) { return `<circle cx="100" cy="${F(K.cy - A.R * 0.25)}" r="${F(A.R * 0.5)}" fill="url(#pl-glow-w)" opacity=".75"/>`; },
  face(A, K) {
    const R = A.R, ey = K.eyeY, ex = R * 0.27 * 0.95 * Math.max(1, A.eyeK * 0.92); let q = blushAt(A, ey + K.er * 1.15, R * 0.48);
    const eyes = [-1, 1].map((s) => ({ x: 100 + s * ex, y: ey, er: K.er }));
    for (const e of eyes) q += drawEye(A, { x: e.x, y: e.y, er: e.er, kind: 'tall', star: A.rk >= 2 });
    q += browsSVG(A, eyes, 1.5);
    const my = K.cy + R * 0.32;
    if (A.sick) return q + sickMouth(A, 100, my);
    if (!usesOwnMouth(A)) return q + mouthSVG(A, 100, my - 3, R * 0.14) + whiskersSVG(A, my, R * 0.24);
    q += `<ellipse cx="100" cy="${F(my)}" rx="3.6" ry="4.6" fill="${darken(A.pal.body, 0.7)}"/><ellipse cx="100" cy="${F(my + 2)}" rx="2" ry="1.6" fill="#ff8fb0" opacity=".8"/>`;
    return q + whiskersSVG(A, my, R * 0.24);
  },
  front(A, K) {
    const n = [0, 1, 3, 5, 5][A.rk], R = A.R; let q = '';
    for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + 0.7 * A.rng()) + (i % 2 ? 0 : Math.PI * 0.05), rr = R * (1.08 + A.rng() * 0.3), side = i % 2 ? 1 : -1; const x = 100 + side * Math.abs(Math.cos(a)) * rr, y = K.cy + Math.sin(a) * rr * 0.9 + R * 0.2; q += `<path class="pl-twinkle" d="${star4(x, y, 3 + A.rng() * 3)}" fill="${lighten(A.pal.glow, 0.6)}" style="animation-delay:-${F(i * 0.37)}s"/>`; }
    return q;
  },
};

// ---- accessories (Uncommon and up): one slot, anchored per species ----
function glossy(d, fill, edge, sw) { return `<path d="${d}" fill="${fill}" stroke="${edge}" stroke-width="${sw || 2.6}" stroke-linejoin="round" paint-order="stroke"/><path d="${d}" fill="url(#pl-acc-gloss)"/>`; }
const ACC = {
  headphones(A, K, col) {
    const y = K.ear.y, dx = K.ear.dx, top = K.headTop.y - 12, dk = darken(col, 0.6);
    const band = `M${F(100 - dx - 1)} ${F(y - 5)}C${F(100 - dx - 6)} ${F(top - 10)} ${F(100 + dx + 6)} ${F(top - 10)} ${F(100 + dx + 1)} ${F(y - 5)}`;
    let q = `<path d="${band}" fill="none" stroke="#14161d" stroke-width="8" stroke-linecap="round"/><path d="${band}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round"/><path d="${band}" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.3" transform="translate(0 -1.3)"/>`;
    for (const s of [-1, 1]) {
      const cx = 100 + s * (dx + 2), w = 13, h = 23;
      q += glossy(`M${F(cx - w / 2)} ${F(y - h / 2 + 5)}Q${F(cx - w / 2)} ${F(y - h / 2)} ${F(cx)} ${F(y - h / 2)}Q${F(cx + w / 2)} ${F(y - h / 2)} ${F(cx + w / 2)} ${F(y - h / 2 + 5)}V${F(y + h / 2 - 5)}Q${F(cx + w / 2)} ${F(y + h / 2)} ${F(cx)} ${F(y + h / 2)}Q${F(cx - w / 2)} ${F(y + h / 2)} ${F(cx - w / 2)} ${F(y + h / 2 - 5)}Z`, col, '#14161d', 2.6);
      q += `<rect x="${F(cx - s * w / 2 - (s > 0 ? 0 : 0) - 2.2)}" y="${F(y - h / 2 + 3)}" width="4.4" height="${F(h - 6)}" rx="2.2" fill="${dk}"/><circle cx="${F(cx + s * 1.5)}" cy="${F(y)}" r="2.6" fill="${lighten(col, 0.4)}" opacity=".8"/>`;
    }
    return q;
  },
  beanie(A, K, col) {
    const { x, y, w } = K.hat, h = w * 1.02, dk = darken(col, 0.58), rib = darken(col, 0.18);
    const dome = `M${F(x - w)} ${F(y)}C${F(x - w * 1.02)} ${F(y - h * 1.22)} ${F(x + w * 1.02)} ${F(y - h * 1.22)} ${F(x + w)} ${F(y)}Z`;
    let q = glossy(dome, col, dk, 2.8);
    let kn = ''; for (let i = -2; i <= 2; i++) kn += `M${F(x + i * w * 0.36)} ${F(y - 2)}Q${F(x + i * w * 0.42)} ${F(y - h * 0.6)} ${F(x + i * w * 0.2)} ${F(y - h * 0.86)}`;
    q += `<path d="${kn}" fill="none" stroke="${rib}" stroke-width="1.2" opacity=".55"/>`;
    const cuff = `M${F(x - w * 1.08)} ${F(y - h * 0.2)}Q${F(x)} ${F(y - h * 0.36)} ${F(x + w * 1.08)} ${F(y - h * 0.2)}L${F(x + w * 1.1)} ${F(y + h * 0.16)}Q${F(x)} ${F(y)} ${F(x - w * 1.1)} ${F(y + h * 0.16)}Z`;
    q += glossy(cuff, darken(col, 0.12), dk, 2.6);
    let rb = ''; for (let i = -6; i <= 6; i++) rb += `M${F(x + i * w * 0.16)} ${F(y - h * 0.24 - Math.abs(i) * -0.2)}v${F(h * 0.32)}`;
    q += `<path d="${rb}" stroke="${dk}" stroke-width="1" opacity=".4"/>`;
    const pr = w * 0.27, py = y - h * 0.98;
    let pom = ''; for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5; pom += `<circle cx="${F(x + Math.cos(a) * pr * 0.72)}" cy="${F(py + Math.sin(a) * pr * 0.72)}" r="${F(pr * 0.48)}"/>`; }
    q += `<g fill="${dk}" transform="translate(0 1)">${pom}</g><g fill="${lighten(col, 0.3)}">${pom}</g><circle cx="${F(x - pr * 0.3)}" cy="${F(py - pr * 0.3)}" r="${F(pr * 0.35)}" fill="#fff" opacity=".45"/>`;
    return q;
  },
  sprout(A, K) {
    const { x, y } = K.sproutAt;
    let q = `<path d="M${F(x)} ${F(y + 2)}Q${F(x - 3)} ${F(y - 9)} ${F(x + 1)} ${F(y - 17)}" fill="none" stroke="#2f6b2a" stroke-width="4.4" stroke-linecap="round"/><path d="M${F(x)} ${F(y + 2)}Q${F(x - 3)} ${F(y - 9)} ${F(x + 1)} ${F(y - 17)}" fill="none" stroke="#5fbf55" stroke-width="2.4" stroke-linecap="round"/>`;
    q += glossy(leafP(x + 1, y - 16, 15, -150, 0.42), '#6fd765', '#2f6b2a', 2.4) + glossy(leafP(x + 1, y - 16, 13, -35, 0.42), '#8ae67a', '#2f6b2a', 2.4);
    q += `<path d="M${F(x - 1)} ${F(y - 18)}l${F(-8)} ${F(-3.5)}M${F(x + 3)} ${F(y - 18)}l${F(7)} ${F(-4.5)}" stroke="#2f6b2a" stroke-width=".9" opacity=".7"/>`;
    return q;
  },
  bow(A, K, col) {
    const { x, y } = K.bowAt, dk = darken(col, 0.58);
    const loop = (s) => `M${F(x)} ${F(y)}C${F(x + s * 6)} ${F(y - 12)} ${F(x + s * 15)} ${F(y - 9)} ${F(x + s * 14)} ${F(y - 1)}C${F(x + s * 15)} ${F(y + 8)} ${F(x + s * 6)} ${F(y + 9)} ${F(x)} ${F(y)}Z`;
    const tail = (s) => `M${F(x)} ${F(y + 1)}L${F(x + s * 5)} ${F(y + 13)}L${F(x + s * 8.5)} ${F(y + 10.5)}L${F(x + s * 2.5)} ${F(y)}Z`;
    let q = `<g transform="rotate(-18 ${F(x)} ${F(y)})">` + glossy(tail(-1), darken(col, 0.12), dk, 2.2) + glossy(tail(1), darken(col, 0.12), dk, 2.2) + glossy(loop(-1), col, dk, 2.4) + glossy(loop(1), col, dk, 2.4);
    q += `<path d="M${F(x - 9)} ${F(y - 2)}q3 -2 6 0M${F(x + 9)} ${F(y - 2)}q-3 -2 -6 0" fill="none" stroke="${dk}" stroke-width="1" opacity=".6"/>`;
    q += glossy(`M${F(x - 3.6)} ${F(y - 3.8)}h7.2v7.6h-7.2z`, lighten(col, 0.08), dk, 2.2) + '</g>';
    return q;
  },
  // goggles ride up on the forehead, never over the eyes
  goggles(A, K, col) {
    const { dx, r } = K.gog, strap = '#3a2a22', y = Math.min(K.gog.y, K.eyeY - K.er * 1.3 - r - 6);
    let q = '';
    {
      const bd = `M${F(100 - A.R * 1.25)} ${F(y + 6)}Q100 ${F(y - 4)} ${F(100 + A.R * 1.25)} ${F(y + 6)}`;
      q += `<g clip-path="url(#cl-${A.sid})"><path d="${bd}" fill="none" stroke="#1a120e" stroke-width="8"/><path d="${bd}" fill="none" stroke="${strap}" stroke-width="6"/><path d="${bd}" fill="none" stroke="#6b5040" stroke-width="1.2" transform="translate(0 -1.5)"/></g>`;
    }
    q += `<path d="M${F(100 - dx + r)} ${F(y)}Q100 ${F(y - 3)} ${F(100 + dx - r)} ${F(y)}" fill="none" stroke="#1a120e" stroke-width="4.5"/><path d="M${F(100 - dx + r)} ${F(y)}Q100 ${F(y - 3)} ${F(100 + dx - r)} ${F(y)}" fill="none" stroke="url(#pl-trim-s)" stroke-width="2.4"/>`;
    for (const s of [-1, 1]) {
      const cx = 100 + s * dx;
      q += `<circle cx="${F(cx)}" cy="${F(y)}" r="${F(r + 3.4)}" fill="url(#pl-trim-s)" stroke="#1a120e" stroke-width="2.4"/><circle cx="${F(cx)}" cy="${F(y)}" r="${F(r)}" fill="${mix(col, '#1d3a5c', 0.45)}"/><circle cx="${F(cx)}" cy="${F(y)}" r="${F(r)}" fill="url(#pl-lens)" opacity=".75"/><path d="M${F(cx - r * 0.55)} ${F(y - r * 0.1)}A${F(r * 0.6)} ${F(r * 0.6)} 0 0 1 ${F(cx + r * 0.1)} ${F(y - r * 0.6)}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>`;
    }
    return q;
  },
  // a wraparound shade pushed up onto the forehead, so the face always shows
  visor(A, K, col) {
    const h = Math.max(9, K.er * 1.05), y = K.eyeY - K.er * 1.3 - h * 0.62 - 5, w = K.visW * 0.9, dk = '#14161d';
    const d = `M${F(100 - w)} ${F(y - h * 0.42)}Q100 ${F(y - h * 0.62)} ${F(100 + w)} ${F(y - h * 0.42)}L${F(100 + w * 0.94)} ${F(y + h * 0.38)}Q100 ${F(y + h * 0.62)} ${F(100 - w * 0.94)} ${F(y + h * 0.38)}Z`;
    let q = `<path d="${d}" fill="${mix(col, '#0b0d14', 0.25)}" fill-opacity=".42" stroke="${dk}" stroke-width="2.6" stroke-linejoin="round"/>`;
    q += `<path d="M${F(100 - w * 0.92)} ${F(y - h * 0.36)}Q100 ${F(y - h * 0.54)} ${F(100 + w * 0.92)} ${F(y - h * 0.36)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/>`;
    q += `<path d="M${F(100 - w * 0.5)} ${F(y + h * 0.4)}L${F(100 - w * 0.2)} ${F(y - h * 0.5)}M${F(100 - w * 0.3)} ${F(y + h * 0.45)}L${F(100 - w * 0.08)} ${F(y - h * 0.52)}" stroke="#fff" stroke-opacity=".28" stroke-width="2.4"/>`;
    for (const s of [-1, 1]) q += `<circle cx="${F(100 + s * (w - 1))}" cy="${F(y - h * 0.02)}" r="3.4" fill="url(#pl-trim-s)" stroke="${dk}" stroke-width="1.4"/>`;
    return q;
  },
  scarf(A, K, col) {
    const { y, w } = K.neck, dk = darken(col, 0.58), st = lighten(col, 0.55), s = A.flip;
    const band = `M${F(100 - w * 1.02)} ${F(y - 6)}Q100 ${F(y + 3)} ${F(100 + w * 1.02)} ${F(y - 6)}L${F(100 + w * 1.02)} ${F(y + 6)}Q100 ${F(y + 15)} ${F(100 - w * 1.02)} ${F(y + 6)}Z`;
    let q = `<g clip-path="url(#cl-${A.sid})">${glossy(band, col, dk, 3)}<path d="M${F(100 - w * 1.02)} ${F(y - 1.5)}Q100 ${F(y + 7.5)} ${F(100 + w * 1.02)} ${F(y - 1.5)}M${F(100 - w * 1.02)} ${F(y + 2.5)}Q100 ${F(y + 11.5)} ${F(100 + w * 1.02)} ${F(y + 2.5)}" fill="none" stroke="${st}" stroke-width="1.6" opacity=".75"/></g>`;
    q += `<path d="${band}" fill="none" stroke="${dk}" stroke-width="2.4" clip-path="url(#cl-${A.sid})"/>`;
    const tx = 100 + s * w * 0.42, ty = y + 6;
    const tail = `M${F(tx - 6)} ${F(ty - 2)}L${F(tx + 6)} ${F(ty - 2)}L${F(tx + 8 + s * 2)} ${F(ty + 22)}L${F(tx - 4 + s * 2)} ${F(ty + 23)}Z`;
    q += glossy(tail, col, dk, 2.6) + `<path d="M${F(tx - 5)} ${F(ty + 7)}L${F(tx + 6.6 + s * 0.6)} ${F(ty + 7)}M${F(tx - 4.6)} ${F(ty + 12)}L${F(tx + 7.2 + s * 1)} ${F(ty + 12)}" stroke="${st}" stroke-width="1.6" opacity=".75"/>`;
    let fr = ''; for (let i = 0; i < 5; i++) { const fx = tx - 4 + s * 2 + i * 3; fr += `M${F(fx)} ${F(ty + 22.5)}v4`; }
    q += `<path d="${fr}" stroke="${dk}" stroke-width="2.6" stroke-linecap="round"/><path d="${fr}" stroke="${col}" stroke-width="1.4" stroke-linecap="round"/>`;
    return q;
  },
};
// which layer an accessory goes on: nothing ever covers the eyes
const ACC_LAYER = { visor: 'top', goggles: 'top', scarf: 'body', headphones: 'top', beanie: 'top', bow: 'top', sprout: 'top' };
function accessorySVG(A, K, layer) {
  const a = A.v && A.v.accessory; if (!a || !ACC[a.key] || ACC_LAYER[a.key] !== layer) return '';
  return `<g class="acc">${ACC[a.key](A, K, A.v.accColor)}</g>`;
}

// ---- trait + rarity overlays ----
function drawTraits(A, K) {
  const R = A.R, b = A.pal.body, tr = A.tr, ht = K.headTop; let q = '';
  if (tr.includes('Scarred')) {
    const sx = 100 - R * 0.52, sy = K.eyeY + K.er + 7;
    q += `<g transform="translate(${F(sx)} ${F(sy)}) rotate(-24)"><path d="M-7 0H7" stroke="${darken(b, 0.55)}" stroke-width="2" stroke-linecap="round"/><path d="M-4.5 -2.2v4.4M-1.5 -2.2v4.4M1.5 -2.2v4.4M4.5 -2.2v4.4" stroke="${darken(b, 0.55)}" stroke-width="1.1" stroke-linecap="round"/></g>`;
    const p = K.scarAt || { x: 100 + R * 0.42, y: K.brow + 6 };
    q += `<g transform="translate(${F(p.x)} ${F(p.y)})"><rect x="-9" y="-3" width="18" height="6" rx="3" fill="url(#pl-tape)" stroke="#a37c4c" stroke-width=".8" transform="rotate(35)"/><rect x="-9" y="-3" width="18" height="6" rx="3" fill="url(#pl-tape)" stroke="#a37c4c" stroke-width=".8" transform="rotate(-35)"/><rect x="-3" y="-2.6" width="6" height="5.2" rx="1.2" fill="#e6bf8c"/><circle cx="-1.2" cy="-1" r=".55" fill="#a37c4c"/><circle cx="1.2" cy="-1" r=".55" fill="#a37c4c"/><circle cx="-1.2" cy="1" r=".55" fill="#a37c4c"/><circle cx="1.2" cy="1" r=".55" fill="#a37c4c"/></g>`;
  }
  if (A.healed) {
    const hx = 100 + R * 0.42, hy = K.cy + R * 0.48;
    q += `<path d="${heartP(hx, hy, 5.5)}" fill="#ff6b8b" stroke="#f5c451" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"/><circle cx="${F(hx - 2.2)}" cy="${F(hy - 1.6)}" r="1.1" fill="#fff" opacity=".9"/>`;
    q += `<g transform="translate(${F(100 - R * 0.5)} ${F(K.cy + R * 0.42)}) rotate(-22)"><rect x="-6" y="-2.6" width="12" height="5.2" rx="2.6" fill="url(#pl-tape)" stroke="#a37c4c" stroke-width=".7"/><rect x="-2" y="-2" width="4" height="4" rx="1" fill="#e6bf8c"/></g>`;
  }
  if (A.night) {
    const mx = ht.x + R * 0.62, my = ht.y - 6;
    q += `<g transform="translate(${F(mx)} ${F(my)}) rotate(-15)"><path d="M6.3 3A7 7 0 1 1 -.3 -7A6 6 0 0 0 6.3 3Z" fill="#ffe9a8" stroke="#6b5a2a" stroke-width="1.8" stroke-linejoin="round" paint-order="stroke"/></g><path d="${star4(mx + 11, my - 8, 3.2)}" fill="#ffe9a8"/>`;
  }
  if (tr.includes('Restless') && !A.sick) {
    let m = ''; for (const s of [-1, 1]) { const x = 100 + s * (R + 8), y = K.cy - R * 0.15; m += `M${F(x)} ${F(y - 7)}q${F(s * 4)} 7 0 14M${F(x + s * 5)} ${F(y - 4)}q${F(s * 3)} 4 0 8`; }
    q += `<path d="${m}" fill="none" stroke="${lighten(A.pal.glow, 0.3)}" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
  }
  if (A.sick) {
    q += `<path d="${dropP(100 + R * 0.7, K.brow - 2, 9)}" fill="#9fd0ff" stroke="#3b6f9c" stroke-width="1.4" paint-order="stroke"/><circle cx="${F(100 + R * 0.7 - 1.3)}" cy="${F(K.brow + 7)}" r="1.1" fill="#fff"/>`;
    const cx = ht.x - R * 0.42, cy = ht.y - 8, pts = []; for (let i = 0; i <= 26; i++) { const a = i * 0.42, r = 1.2 + i * 0.26; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6]); }
    q += `<path d="${pathOf(pts)}" fill="none" stroke="#b9c4a0" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>`;
  }
  if (A.ex === 'sleepy' && !A.sick) {
    const zx = ht.x + R * 0.55, zy = ht.y + 4;
    q += `<g class="pl-twinkle" style="animation-duration:2.8s"><path d="M${F(zx)} ${F(zy)}h6l-6 7h6M${F(zx + 8)} ${F(zy - 9)}h4.4l-4.4 5h4.4" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  return q;
}
function drawSwarm(A, K, front) {
  const R = A.R, c = A.c, n = Math.max(3, Math.min(6, (c.features && c.features.orbiters) || c.subagents || 4)), rot = (-12 * Math.PI) / 180;
  let q = front ? '' : `<ellipse cx="100" cy="${F(K.cy)}" rx="${F(R + 28)}" ry="16" transform="rotate(-12 100 ${F(K.cy)})" fill="none" stroke="${lighten(A.pal.glow, 0.3)}" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="3 4"/>`;
  const r0 = rngFor(((c.seed >>> 0) ^ 0x51ed) >>> 0)();
  for (let i = 0; i < n; i++) {
    const t = (Math.PI * 2 * i) / n + r0 * 6.28, ox = Math.cos(t) * (R + 28), oy = Math.sin(t) * 16, x = 100 + ox * Math.cos(rot) - oy * Math.sin(rot), y = K.cy + ox * Math.sin(rot) + oy * Math.cos(rot);
    if ((y > K.cy) !== front) continue;
    q += `<g class="pl-orbit" style="animation-delay:-${F(i * 0.4)}s"><circle cx="${F(x)}" cy="${F(y)}" r="5.5" fill="${bodyFill(A)}" stroke="${darken(A.pal.body, 0.6)}" stroke-width="1.2"/><circle cx="${F(x)}" cy="${F(y)}" r="4.6" fill="none" stroke="${A.rimC}" stroke-opacity=".6" stroke-width=".8"/><circle cx="${F(x + 0.4)}" cy="${F(y - 0.2)}" r="2.2" fill="#10121a"/><circle cx="${F(x - 0.3)}" cy="${F(y - 0.9)}" r=".8" fill="#fff"/></g>`;
  }
  return q;
}
// Epic and up: glowing markings on the flanks and a small emblem, pulsing in the glow color
function markingsSVG(A, K) {
  if (A.ti < 3 || A.sick) return '';
  const R = A.R, cy = K.cy, g = A.ti >= 5 ? '#ffc8f0' : lighten(A.pal.glow, 0.35);
  let d = '';
  for (const s of [-1, 1]) {
    const x0 = 100 + s * R * 0.86, y0 = cy + R * 0.05;
    d += `M${F(x0)} ${F(y0 - R * 0.22)}Q${F(x0 - s * R * 0.16)} ${F(y0)} ${F(x0)} ${F(y0 + R * 0.24)}M${F(x0 - s * R * 0.1)} ${F(y0 - R * 0.12)}Q${F(x0 - s * R * 0.2)} ${F(y0)} ${F(x0 - s * R * 0.1)} ${F(y0 + R * 0.14)}`;
  }
  return `<g clip-path="url(#cl-${A.sid})" class="pl-pulse"><path d="${d}" fill="none" stroke="${g}" stroke-width="5" stroke-linecap="round" opacity=".3"/><path d="${d}" fill="none" stroke="${g}" stroke-width="1.9" stroke-linecap="round" opacity=".95"/></g>`;
}
// Legendary and Mythic: a silhouette and finish upgrade, not another sticker. Each species
// grows its own pair of wings in the creature's finish (Gold Chrome, Holo, Chrome, Iridescent).
const WING_STYLE = { cog: 'mech', scholar: 'feather', prism: 'crystal', lumen: 'flame', hydra: 'frill', wisp: 'flame' };
function legendWings(A, K) {
  const R = A.R, st = WING_STYLE[A.sk] || 'feather', mat = A.mat;
  const fill = mat === 'chrome' ? 'url(#pl-mchrome)' : mat === 'holo' ? 'url(#pl-holob)' : mat === 'iridescent' ? 'url(#pl-irid)' : 'url(#pl-mgold)';
  const edge = mat === 'chrome' ? '#1d2029' : mat === 'holo' || mat === 'iridescent' ? darken(A.pal.body, 0.66) : '#4a2d03';
  const ax = 100 + R * (A.sk === 'lumen' ? 0.74 : 0.66), ay = K.cy - R * 0.16, ks = 1.38;
  const blades = st === 'feather' ? [[-74, 1.02], [-56, 0.94], [-38, 0.84], [-21, 0.72], [-6, 0.6]] : st === 'crystal' ? [[-66, 1.05], [-38, 0.86], [-12, 0.66]] : st === 'mech' ? [[-60, 0.92], [-36, 0.8], [-12, 0.68]] : st === 'frill' ? [[-62, 0.86], [-34, 0.78], [-8, 0.66]] : [[-70, 1.05], [-40, 0.86], [-12, 0.68]];
  let q = '';
  blades.forEach(([deg, k], i) => {
    const len = R * k * ks, a = (deg * Math.PI) / 180, ex = ax + Math.cos(a) * len, ey = ay + Math.sin(a) * len;
    let d;
    if (st === 'feather') d = leafP(ax, ay, len, deg, 0.26);
    else if (st === 'crystal') { const n = -Math.sin(a), m = Math.cos(a), w = len * 0.2; d = pathOf([[ax, ay], [ax + Math.cos(a) * len * 0.42 + n * w, ay + Math.sin(a) * len * 0.42 + m * w], [ex, ey], [ax + Math.cos(a) * len * 0.42 - n * w * 0.7, ay + Math.sin(a) * len * 0.42 - m * w * 0.7]], true); }
    else if (st === 'mech') { const n = -Math.sin(a), m = Math.cos(a), w0 = len * 0.13, w1 = len * 0.08; d = pathOf([[ax + n * w0, ay + m * w0], [ex + n * w1, ey + m * w1], [ex + Math.cos(a) * w1 * 1.6, ey + Math.sin(a) * w1 * 1.6], [ex - n * w1, ey - m * w1], [ax - n * w0, ay - m * w0]], true); }
    else if (st === 'frill') d = leafP(ax, ay, len, deg, 0.2);
    else d = tendrilPath(ax, ay, a, len, -1.2, len * 0.34);
    q += `<path d="${d}" fill="${fill}" stroke="${edge}" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"/>`;
    // a crisp highlight down each blade, plus a detail per style
    const hx = ax + Math.cos(a) * len * 0.18, hy = ay + Math.sin(a) * len * 0.18, tx = ax + Math.cos(a) * len * 0.78, ty = ay + Math.sin(a) * len * 0.78;
    q += `<path d="M${F(hx)} ${F(hy)}L${F(tx)} ${F(ty)}" stroke="#fff" stroke-opacity="${st === 'crystal' ? 0.8 : 0.55}" stroke-width="${st === 'crystal' ? 1.4 : 1.8}" stroke-linecap="round"/>`;
    if (st === 'mech') q += `<circle cx="${F(ax + Math.cos(a) * len * 0.3)}" cy="${F(ay + Math.sin(a) * len * 0.3)}" r="1.9" fill="${edge}" opacity=".7"/>`;
    if (st === 'frill') { let br = ''; for (let j = 1; j <= 3; j++) { const t = 0.32 + j * 0.16, bx = ax + Math.cos(a) * len * t, by = ay + Math.sin(a) * len * t; br += `M${F(bx)} ${F(by)}l${F(Math.cos(a - 0.9) * 5.5)} ${F(Math.sin(a - 0.9) * 5.5)}`; } q += `<path d="${br}" stroke="${edge}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`; }
    if (i === 0 && st !== 'mech') q += `<path d="${star4(ex, ey, 3.4)}" fill="#fff" opacity=".9" class="pl-twinkle"/>`;
  });
  if (st === 'mech') q += `<circle cx="${F(ax)}" cy="${F(ay)}" r="6.5" fill="${fill}" stroke="${edge}" stroke-width="2.6"/><circle cx="${F(ax)}" cy="${F(ay)}" r="2.4" fill="${edge}"/>`;
  const one = `<g class="pl-lwing">${q}</g>`;
  return `<g class="lwings">${one}<g transform="matrix(-1 0 0 1 200 0)">${one}</g></g>`;
}
// hatchlings still sit in the bottom half of their shell
function shellSVG(A, front) {
  // a wisp hatchling floats just above a lower, smaller shell
  const low = A.sk === 'wisp', R = A.R, W = R * (low ? 0.9 : 1.02), top = 197 - R * (low ? 0.3 : 0.48), rng = sub(A, 'shell');
  if (!front) return `<ellipse cx="100" cy="${F(top + 4)}" rx="${F(W * 0.94)}" ry="${F(R * 0.16)}" fill="#8f7a58"/>`;
  const n = 9; let zz = '';
  for (let i = 0; i <= n; i++) zz += `L${F(100 + W - (i * 2 * W) / n)} ${F(top + (i % 2 ? -4 - rng() * 3 : 3 + rng() * 2))}`;
  const d = `M${F(100 - W)} ${F(top + 2)}Q${F(100 - W * 1.02)} 199 100 199Q${F(100 + W * 1.02)} 199 ${F(100 + W)} ${F(top + 2)}` + zz + 'Z';
  let spots = ''; for (let i = 0; i < 6; i++) spots += `<ellipse cx="${F(100 + (rng() * 2 - 1) * W * 0.7)}" cy="${F(top + 9 + rng() * 12)}" rx="${F(2 + rng() * 3)}" ry="${F(1.6 + rng() * 2)}" fill="${A.pal.glow}" opacity=".4"/>`;
  return `<path d="${d}" fill="url(#pl-shell)" stroke="#7a6440" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/>${spots}<path d="M${F(100 - W * 0.72)} ${F(top + 9)}Q${F(100 - W * 0.62)} ${F(top + 20)} ${F(100 - W * 0.2)} 194" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`;
}
// Exalted creatures: a laurel behind them (Elders and up get the warm glow)
function laurelSVG(A, K) {
  const R = A.R; let q = '';
  for (const s of [-1, 1]) {
    let d = `M${F(100 + s * R * 0.3)} 192Q${F(100 + s * R * 1.25)} 182 ${F(100 + s * R * 1.12)} ${F(K.cy - R * 0.6)}`;
    q += `<path d="${d}" fill="none" stroke="#8a5a0c" stroke-width="2.6" stroke-linecap="round"/>`;
    for (let i = 0; i < 7; i++) {
      const t = 0.12 + i * 0.13, m = 1 - t, x0 = 100 + s * R * 0.3, y0 = 192, x1 = 100 + s * R * 1.25, y1 = 182, x2 = 100 + s * R * 1.12, y2 = K.cy - R * 0.6;
      const px = m * m * x0 + 2 * m * t * x1 + t * t * x2, py = m * m * y0 + 2 * m * t * y1 + t * t * y2;
      q += `<path d="${leafP(px, py, 12, s > 0 ? -40 - i * 9 : -140 + i * 9, 0.36)}" fill="url(#pl-leaf)" stroke="#7a4e06" stroke-width="1.2"/>`;
      q += `<path d="${leafP(px, py, 10, s > 0 ? 20 - i * 6 : 160 + i * 6, 0.36)}" fill="url(#pl-leaf)" stroke="#7a4e06" stroke-width="1.2" opacity=".85"/>`;
    }
  }
  return q;
}

function creatureInner(c, rng) {
  const A = artCtx(c, rng), SP = SPECIES_PARTS[A.sk], K = SP.geo(A), R = A.R, s = A.sid, b = A.pal.body, T = A.T, rk = A.rk, g = A.pal.glow;
  // per-creature defs (palette-dependent only; static ones live in PL_DEFS)
  const d = [`<path id="b-${s}" d="${K.d}"/>`, `<clipPath id="cl-${s}"><use href="#b-${s}"/></clipPath>`];
  const vb = A.mat === 'holo' || A.mat === 'iridescent' ? lighten(b, A.mat === 'iridescent' ? 0.3 : 0.22) : b;
  if (A.hybrid) { const pa = ART_PAL[A.pk[0]].body, pb = ART_PAL[A.pk[1]].body; d.push(LG(`bd-${s}`, [0, 0, 1, 1], [[0.1, pa], [0.5, mix(pa, pb, 0.5)], [0.9, pb]])); }
  else if (A.sk === 'hydra') d.push(RG(`bd-${s}`, ['40%', '30%', '80%'], [[0, lighten(vb, 0.65), 0.95], [0.45, lighten(vb, 0.1), 0.88], [1, darken(vb, 0.6), 0.95]]));
  else if (A.sk === 'wisp') d.push(LG(`bd-${s}`, [0, 0, 0, 1], [[0, lighten(vb, 0.35), 0.97], [0.55, vb, 0.92], [1, vb, 0.5]]), LG(`wo-${s}`, [0, 0, 0, 1], [[0, darken(b, 0.6)], [0.6, darken(b, 0.6), 0.9], [1, darken(b, 0.6), 0.1]]));
  else if (A.sk === 'lumen') d.push(RG(`bd-${s}`, ['50%', '55%', '58%'], [[0, '#fffbe8'], [0.25, lighten(vb, 0.55)], [0.55, lighten(vb, 0.12)], [0.85, darken(vb, 0.2)], [1, darken(vb, 0.55)]]));
  else d.push(RG(`bd-${s}`, ['36%', '26%', '88%', '32%', '22%'], [[0, lighten(vb, 0.55)], [0.2, lighten(vb, 0.22)], [0.55, vb], [0.82, darken(vb, 0.28)], [1, darken(vb, 0.5)]]));
  d.push(LG(`rim-${s}`, [0, 0, 1, 1], [[0, A.rimC, 0], [0.55, A.rimC, 0], [0.8, A.rimC, 0.55], [1, A.rimC, 0.95]]));
  const irisG = (id, ic) => RG(id, ['50%', '80%', '70%'], [[0, lighten(ic, 0.25)], [0.35, ic], [0.62, darken(ic, 0.55)], [0.8, '#07080d'], [1, '#000']]);
  d.push(irisG(`ir-${s}`, A.iris)); if (A.hybrid) d.push(irisG(`ir2-${s}`, A.iris2));
  if (A.glowEyes) d.push(RG(`eg-${s}`, ['50%', '50%', '50%'], [[0, A.iris, 0.55], [0.55, A.iris, 0.18], [1, A.iris, 0]]));
  if (A.sk === 'moth') d.push(LG(`wg-${s}`, [1, 0, 0, 0.3], [[0, darken(vb, 0.15)], [0.5, lighten(vb, 0.25)]].concat(rk >= 3 ? [[0.72, lighten(g, 0.2), 0.85]] : []).concat([[1, lighten(vb, 0.5)]])));
  if (A.sk === 'lumen') d.push(RG(`la-${s}`, ['50%', '50%', '50%'], [[0, g, 0.55], [0.5, g, 0.15], [1, g, 0]]), LG(`ld-${s}`, [0, 0, 0, 1], [[0, lighten(b, 0.2)], [1, darken(b, 0.25)]]));
  if (A.sk === 'wisp') d.push(LG(`wf-${s}`, [0, 1, 0, 0], [[0, g, 0.85], [1, lighten(g, 0.75)]]));
  const auraC = T === 'Legendary' ? mix(g, '#f5c451', 0.6) : T === 'Mythic' ? mix(g, '#ff7bd0', 0.6) : mix(g, '#a970ff', 0.5);
  if (A.ti >= 3) d.push(RG(`au-${s}`, ['50%', '50%', '50%'], [[0, auraC, 0.55], [0.55, auraC, 0.16], [1, auraC, 0]]));

  const q = [`<defs>${d.join('')}</defs><g style="--d:-${F(((c.seed >>> 0) % 4000) / 1000)}s">`];
  // stage: aura, plinth, floor ring, contact shadow
  if (SP.aura) q.push(SP.aura(A, K));
  if (A.ti >= 3) q.push(`<circle class="pl-pulse" cx="100" cy="${F(K.cy)}" r="${F(R + 44)}" fill="url(#au-${s})"/>`);
  if (A.stage === 'elder') q.push(`<circle cx="100" cy="${F(K.cy)}" r="${F(R + 30)}" fill="url(#pl-elder)"/>`);
  const pr = T === 'Legendary' ? ' stroke="#f5c451" stroke-width="1.5"' : T === 'Mythic' ? ' stroke="#ff7bd0" stroke-opacity=".7" stroke-width="1.5"' : T === 'Epic' ? ' stroke="#b28dff" stroke-opacity=".5" stroke-width="1.5"' : '';
  q.push(`<g class="pl-base"><ellipse cx="100" cy="203.5" rx="70" ry="11" fill="#090b10"/><ellipse cx="100" cy="200" rx="70" ry="11" fill="url(#pl-plinth)"${pr}/><ellipse cx="100" cy="199.6" rx="67" ry="9.6" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1"/>`);
  if (A.ti >= 3) q.push(`<ellipse cx="100" cy="192" rx="${F(R + 14)}" ry="${F(R * 0.3)}" fill="none" stroke="${T === 'Legendary' ? '#f5c451' : T === 'Mythic' ? '#ff7bd0' : '#b28dff'}" stroke-opacity=".45" stroke-width="1.5"/>`);
  q.push('</g>');
  if (A.exalted) q.push(laurelSVG(A, K));
  q.push(K.float ? `<g opacity=".5"><ellipse cx="100" cy="197" rx="${F(R * 0.55)}" ry="6" fill="url(#pl-cs)"/></g>` : `<ellipse cx="100" cy="197" rx="${F(R * 0.85)}" ry="7.5" fill="url(#pl-cs)"/><ellipse cx="100" cy="196.5" rx="${F(R * 0.45)}" ry="3.5" fill="#000" opacity=".35"/>`);
  const swarm = A.tr.includes('Swarm');
  if (swarm) q.push(drawSwarm(A, K, false));
  if (A.stage === 'hatchling') q.push(shellSVG(A, false));
  // the creature (scaled by growth stage around its feet)
  const k = A.look.k, lift = A.stage === 'hatchling' && A.sk === 'wisp' ? 26 : 0;
  q.push(`<g transform="translate(100 ${196 - lift}) scale(${k}) translate(-100 -196)"><g class="pl-bob${K.float ? ' pl-float' : ''}"><g class="pl-breathe">`);
  if (A.sick) q.push('<g transform="translate(100 196) scale(1.03 .95) translate(-100 -196)">');
  q.push(`<g transform="rotate(${F(A.tilt)} 100 ${K.float ? F(K.cy) : 196})">`);
  if (A.ti >= 4 && A.sk !== 'moth') q.push(legendWings(A, K));
  if (SP.back) q.push(SP.back(A, K));
  const ornament = A.other ? CREST[A.other](A, K) : SP.ornament ? SP.ornament(A, K) : '';
  if (ornament && A.look.orn > 0) { const ok = A.look.orn * (A.ti >= 4 ? 1.22 : 1), hx = K.headTop.x, hy = K.headTop.y + 8; q.push(ok === 1 ? ornament : `<g transform="translate(${F(hx)} ${F(hy)}) scale(${ok}) translate(${F(-hx)} ${F(-hy)})">${ornament}</g>`); }
  else if (ornament && (A.sk === 'lumen' || A.sk === 'wisp' || A.sk === 'moth')) { const hx = K.headTop.x, hy = K.headTop.y + 8, ks = A.sk === 'wisp' ? 1 : 0.55; q.push(`<g transform="translate(${F(hx)} ${F(hy)}) scale(${ks}) translate(${F(-hx)} ${F(-hy)})">${ornament}</g>`); }
  q.push(vinylStack(A, K, { inner: SP.inner ? SP.inner(A, K) : null, pattern: patternSVG(A, K), noSpec: A.sk === 'prism', noAO: A.sk === 'wisp' || A.sk === 'lumen', gloss: A.sk === 'hydra', outline: A.sk === 'wisp' ? `url(#wo-${s})` : A.sk === 'lumen' ? darken(b, 0.72) : null }));
  if (A.sick) q.push(`<use href="#b-${s}" fill="#6f8f5a" opacity=".3" style="mix-blend-mode:multiply"/>`);
  if (SP.detail) q.push(SP.detail(A, K));
  q.push(markingsSVG(A, K));
  q.push(accessorySVG(A, K, 'body'));
  q.push(SP.face(A, K));
  if (SP.front) q.push(SP.front(A, K));
  q.push(drawTraits(A, K));
  q.push(accessorySVG(A, K, 'top'));
  if (A.v && A.v.accessory && A.v.accessory.key === 'beanie' && A.sk === 'wisp') q.push(wispFlame(A, K.hat.x, K.hat.y - K.hat.w * 1.3));
  if (T === 'Mythic') { const hx = K.headTop.x, hy = K.headTop.y - 30; q.push(`<g class="pl-float"><circle cx="${F(hx)}" cy="${F(hy)}" r="22" fill="url(#pl-myth)"/><ellipse cx="${F(hx)}" cy="${F(hy)}" rx="16" ry="4.5" fill="none" stroke="#ff7bd0" stroke-width="2.5"/><ellipse cx="${F(hx)}" cy="${F(hy)}" rx="16" ry="4.5" fill="none" stroke="#fff" stroke-width=".8" opacity=".8"/></g>`); }
  q.push('</g>' + (A.sick ? '</g>' : '') + '</g></g>');
  if (A.stage === 'hatchling') q.push(shellSVG(A, true));
  q.push('</g>');
  // particles, Shiny sparkle, front drones
  if (A.ti >= 3) {
    let p = '';
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2, rr = R + 12 + rng() * 18, x = 100 + Math.cos(a) * rr; let y = K.cy + Math.sin(a) * rr * 0.85; if (y > 184) y = 184 - rng() * 30;
      const sz = 1.2 + rng() * 1.2, col = T === 'Mythic' ? (i % 2 ? '#ff9be0' : '#7bf0ff') : T === 'Legendary' ? '#ffe7a0' : lighten(g, 0.4);
      const shape = T === 'Mythic' && i % 2 ? heartP(x, y, sz * 1.6) : rng() < 0.6 ? star4(x, y, sz * 2.4) : null;
      p += shape ? `<path class="pl-twinkle" d="${shape}" fill="${col}" style="animation-delay:-${F(i * 0.31)}s"/>` : `<circle class="pl-twinkle" cx="${F(x)}" cy="${F(y)}" r="${F(sz)}" fill="${col}" style="animation-delay:-${F(i * 0.31)}s"/>`;
    }
    q.push(p);
  }
  if (A.v && A.v.shiny) {
    const sr = sub(A, 'sparkle'); let p = '';
    for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.95 + (i / 5) * Math.PI * 0.9 + (sr() - 0.5) * 0.3, rr = R * (0.9 + sr() * 0.35), x = 100 + Math.cos(a) * rr, y = K.cy + Math.sin(a) * rr * 0.95; p += `<path class="pl-twinkle" d="${star4(x, y, 3.2 + sr() * 3.6)}" fill="${i % 2 ? '#fff6c8' : '#ffffff'}" stroke="#fff" stroke-width=".4" style="animation-delay:-${F(i * 0.27)}s"/>`; }
    q.push(p);
  }
  if (swarm) q.push(drawSwarm(A, K, true));
  q.push('</g>');
  return q.join('');
}
const CREST = {
  cog: (A, K) => cogGears(A, K.headTop.y + 6, A.R * 0.5, 0.85),
  scholar: (A, K) => { const R = A.R, y = K.headTop.y; let q = ''; for (const s of [-1, 1]) q += `<path d="M${F(100 + s * R * 0.12)} ${F(y + 10)}Q${F(100 + s * R * 0.42)} ${F(y - 4)} ${F(100 + s * R * 0.6)} ${F(y - 22)}Q${F(100 + s * R * 0.66)} ${F(y)} ${F(100 + s * R * 0.62)} ${F(y + 14)}Z" fill="${bodyFill(A)}" stroke="${darken(A.pal.body, 0.6)}" stroke-width="4.5" stroke-linejoin="round" paint-order="stroke"/>`; return q; },
  moth: (A, K) => mothAntennae(A, 100, K.headTop.y),
  prism: (A, K) => { const R = A.R, y = K.headTop.y + 10; return prismShard(A, 100 - 13, y, -26, R * 0.5) + prismShard(A, 100 + 13, y, 26, R * 0.5) + prismShard(A, 100, y - 2, 0, R * 0.72); },
  lumen: (A, K) => lumenRing(100, K.headTop.y - 4),
  hydra: (A, K) => { const R = A.R, y = K.headTop.y; return stalkEye(A, 100 - R * 0.28, y + 10, 100 - R * 0.42, y - 14, R * 0.12, 0.7) + stalkEye(A, 100 + R * 0.28, y + 10, 100 + R * 0.44, y - 17, R * 0.13, 2.1); },
  wisp: (A, K) => wispFlame(A, 100, K.headTop.y + 4),
};
// the art key: everything the drawing depends on (the cache never serves a stale look)
function artKey(c) { return (c.seed >>> 0) + '|' + (c.speciesKey || '') + '|' + (c.rarity && c.rarity.tier) + '|' + (c.level || 1) + '|' + (c.status || '') + '|' + (c.traits || []).join(',') + '|' + (c.parents || []).join(',') + '|' + (c.subagents || 0) + '|' + (c.features && c.features.orbiters || 0) + '|' + (c.vo ? JSON.stringify(c.vo) : ''); }
const ART_CACHE = new Map();
let artSeq = 0;
function creatureMarkup(c) {
  const key = artKey(c);
  let m = ART_CACHE.get(key);
  if (m == null) { m = creatureInner(c, rngFor(c.seed)); if (ART_CACHE.size > 1500) ART_CACHE.clear(); ART_CACHE.set(key, m); }
  return m;
}
// every drawing gets its own id suffix, so copies never share defs (deterministic look, unique ids)
const CROP = { hatchling: '27 62 146 146', juvenile: '19 44 162 162', adult: '13 30 174 174', elder: '13 30 174 174', exalted: '11 26 178 178' };
function cropBox(c) {
  if (c.rarity && c.rarity.tier === 'Mythic') return '0 8 200 200'; // the halo floats high, the wings spread wide
  if (c.rarity && c.rarity.tier === 'Legendary' && !(PV && PV.stageOf(c).key === 'hatchling')) return '2 20 196 196'; // room for the wingspan
  const st = PV ? PV.stageOf(c).key : 'adult';
  if (st === 'hatchling' && c.speciesKey === 'wisp') return '21 38 160 160'; // a wisp floats up out of its shell
  return CROP[st] || CROP.adult;
}
function creatureSVG(c, size, opts) {
  ensurePlDefs();
  const inner = creatureMarkup(c).split('__I__').join('-' + (++artSeq).toString(36));
  return `<svg class="art${opts && opts.live ? ' live' : ''}${opts && opts.crop ? ' crop' : ''}${opts && opts.bare ? ' bare' : ''}" viewBox="${opts && opts.crop ? cropBox(c) : '0 18 200 200'}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}
// ==== ART END ====
let ART = {};
async function loadArt() { try { const m = await (await fetch('/creatures/manifest.json')).json(); ART = (m && m.species) || {}; } catch { ART = {}; } }
// Tiles, modals and cards always use the procedural SVG (it carries per-seed variant, rarity, trait,
// growth and animation layers). A manifest PNG, if one is ever added, is only used for the home hero.
function creatureVisual(c, size, opts) {
  const a = opts && opts.hero ? ART[c.speciesKey + '_' + c.rarity.tier.toLowerCase()] || ART[c.speciesKey] : null;
  if (!a) return creatureSVG(c, size, opts);
  return `<svg class="art" viewBox="0 0 200 220" width="${size}" height="${size}"><image href="/creatures/${a}" x="16" y="8" width="168" height="188" preserveAspectRatio="xMidYMid meet"/></svg>`;
}

// ---- shared bits ----
const APP_API = 2; // the server API this page expects (see /api/version)
const initials = (h) => (h || '?').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
// "a" or "an" by sound: an Uncommon, an Epic, an 8m run, an 11s run, an 18m run
const aAn = (w) => (/^(8|11(?!\d)|18(?!\d)|[aeiou])/i.test(String(w)) ? 'an' : 'a');
const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : many || one + 's'}`;
const shortDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const dayLabel = (key) => { if (!key) return ''; const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now'; const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; const d = Math.floor(h / 24); return d < 30 ? d + 'd ago' : shortDate(ms);
}
function fmtClock(ms) { const s = Math.max(0, Math.round(ms / 1000)); if (s < 60) return s + 's'; const m = Math.floor(s / 60); if (m < 60) return m + 'm ' + (s % 60) + 's'; return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; }
const variantOf = (c) => (PV && c ? PV.variantOf(c) : null);
// the short name ('Vorlisk') for tight spots; the full one ('Vorlisk the Marathon Hydra') stays for the detail view and share card
const shortName = (c) => (c && (c.name || c.fullName)) || '';
// a run longer than rules.openSessionMs was a session left open, not machine time: it keeps its signed tier,
// but it never shows a run length and never ranks among your finest
const isOpenRun = (c) => !!c && !c.bredBy && (c.durationMs || 0) > ((latest.rules && latest.rules.openSessionMs) || 86400000);
const hasPower = (m) => !!m && m.week != null; // older servers sent a capped 0-10 score instead
const stageOf = (c) => (PV && c ? PV.stageOf(c) : { key: 'adult', name: 'Adult' });
// the real signals a creature grew from, as one honest line
function originLine(c) {
  if (c.bredBy) return `bred by @${c.bredBy[0]} + @${c.bredBy[1]} from ${c.domain || 'shared'} work`;
  const parts = [isOpenRun(c) ? 'hatched from a session left open (not counted as machine time)' : `grew from ${aAn(c.durationLabel)} ${c.durationLabel} run`];
  if (c.toolCalls) parts.push(plural(c.toolCalls, 'tool call'));
  if (c.subagents) parts.push(plural(c.subagents, 'subagent'));
  return parts.join(' · ');
}
function shortOrigin(c) {
  if (c.bredBy) return 'cross-fed · ' + (c.domain || 'shared') + ' work';
  return [isOpenRun(c) ? 'session left open' : c.durationLabel ? c.durationLabel + ' run' : '', c.toolCalls ? plural(c.toolCalls, 'tool') : '', c.subagents ? plural(c.subagents, 'subagent') : ''].filter(Boolean).join(' · ');
}
const skillName = (k) => { const s = latest.skills && latest.skills.list.find((x) => x.key === k); return s ? s.name : k.charAt(0).toUpperCase() + k.slice(1); };
// every gain a run earned: its own skills plus what it earned against your history (when the server sent it)
function gainsOf(c) {
  const r = c && latest.skills && latest.skills.recent && latest.skills.recent.find((x) => x.creatureId === c.id);
  const g = (r && r.gains) || (c && c.skillXp) || {};
  return Object.entries(g).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}
const withLevel = (c, L) => Object.assign({}, c, { level: L });
// a 0..1 ring in a band colour; gradient bands are iridescent, gold-ring bands are gold
let ringSeq = 0;
function ringSVG(size, pct, band, inner, o) {
  o = o || {};
  const sw = o.sw || Math.max(4, size * 0.08), r = size / 2 - sw / 2 - 1, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
  const id = 'rg' + (++ringSeq); let stroke = band ? band.color : '#8b90a0', defs = '';
  if (band && band.ring === 'gold' && !band.gradient) { defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f5c451"/><stop offset="1" stop-color="#b07a10"/></linearGradient></defs>`; stroke = `url(#${id})`; }
  else if (band && band.gradient) { const g = band.gradient; defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${g.map((c, i) => `<stop offset="${(i / (g.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`; stroke = `url(#${id})`; }
  const dash = o.fill ? `stroke-dasharray="${F(C)}" stroke-dashoffset="${F(C)}" style="--c:${F(C)};--to:${F(C * (1 - p))}" class="ring-fill"` : `stroke-dasharray="${F(C * p)} ${F(C)}"`;
  return `<svg class="ring${o.cls ? ' ' + o.cls : ''}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${defs}<circle cx="${size / 2}" cy="${size / 2}" r="${F(r)}" fill="none" stroke="#1c1e26" stroke-width="${F(sw)}"/>${p > 0 || o.fill ? `<circle cx="${size / 2}" cy="${size / 2}" r="${F(r)}" fill="none" stroke="${stroke}" stroke-width="${F(sw)}" stroke-linecap="round" ${dash} transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}${inner || ''}</svg>`;
}
const FLAME = '<svg class="flame" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.6A4.8 4.8 0 0 1 12 18a4.8 4.8 0 0 1-4.8-4.9c0-2.2 1.1-3.6 2.2-4.8.3 1.5 1 2.4 2 2.7-.6-3.1.2-6 .6-8.5z" fill="url(#pl-flm)"/><path d="M12 21.5c-2.3 0-3.6-1.5-3.6-3.3 0-1.6 1.1-2.6 1.9-3.4.2 1 .8 1.5 1.5 1.7-.3-1.6.3-3 .6-4.1 1.4 1.4 3.2 3 3.2 5.6 0 2-1.4 3.5-3.6 3.5z" fill="#fff3c8" opacity=".85"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="15.5" r="1.3" fill="currentColor"/></svg>';

// ---- tiles: art is built only when a tile nears the viewport, then cached by look ----
function tileKey(c) { return (c.level || 1) + '|' + (c.status || '') + '|' + (c.traits || []).length + '|' + (c.xp || 0) + '|' + (c.att ? 1 : 0); }
// a short serial for every creature: the first four of its signature fingerprint (or its seed), so twins never look alike
const tagOf = (c) => '#' + (c.att && c.att.fp ? c.att.fp.slice(0, 4) : (c.seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(-4));
const SAVE_IC = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/></svg>';
function tileHTML(c, o) {
  o = o || {};
  const v = variantOf(c), st = stageOf(c), L = c.level || 1;
  const art = o.eager ? creatureSVG(c, 128, { crop: true }) : `<div class="art-slot" data-art="${escapeXml(c.id)}"></div>`;
  const care = c.status === 'sick' ? `<div class="care">needs care · a few good runs will heal it</div>` : c.status === 'healed' ? `<div class="care healed">healed ✓</div>` : '';
  const isNew = !o.noNew && freshIds.has(c.id);
  const cls = ['tile', isNew ? 'new' : '', c.rarity.tier === 'Legendary' ? 'leg' : '', c.rarity.tier === 'Mythic' ? 'myth' : '', v && v.shiny ? 'shiny' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}" style="--tier:${c.rarity.chip}" data-id="${escapeXml(c.id)}" data-k="${tileKey(c)}">
    <div class="t-top"><span class="rchip" style="color:${c.rarity.chip}">${c.rarity.tier}</span><span class="t-tag" title="${c.att ? 'signed · tamper-evident · fingerprint ' + escapeXml(c.att.fp) : 'seed serial'}">${tagOf(c)}${c.att ? '<i class="verified inline">✓</i>' : ''}</span></div>
    <div class="tile-art">${art}${v && v.shiny ? '<span class="shinychip" title="Shiny: about 1 in 64">✦ Shiny</span>' : ''}<button class="tsave" type="button" title="Save this creature's share card" aria-label="Save share card">${SAVE_IC}<span>Card</span></button></div>
    <div class="nm" title="${escapeXml(c.fullName)}">${escapeXml(shortName(c))}</div>
    <div class="var">${escapeXml(c.speciesName + (v ? ' · ' + v.full : ''))}</div>
    <div class="sub">${escapeXml(shortOrigin(c))}</div>
    <div class="lvl"><span><i class="stdot st-${st.key}"></i>${escapeXml(lvLine(c))}</span><div class="xp"><i style="width:${Math.round(xpPct(c) * 100)}%"></i></div></div>
    ${care}</div>`;
}
function mcardHTML(c, origin) {
  return `<div class="mcard" ${c.id ? `data-id="${escapeXml(c.id)}"` : ''}>
    <span class="rchip" style="color:${c.rarity.chip}">${c.rarity.tier}</span>
    ${creatureSVG(c, 118)}
    <div class="nm" title="${escapeXml(c.fullName)}">${escapeXml(shortName(c))}</div>
    <div class="origin">${escapeXml(c.speciesName + (variantOf(c) ? ' · ' + variantOf(c).name : ''))}${origin ? ' · ' + escapeXml(origin) : ''}</div></div>`;
}
function findCreature(id) { return latest.creatures.find((c) => c.id === id) || ((bestiaryData && bestiaryData.breeds) || []).find((c) => c.id === id) || null; }
// keyed update of a grid of tiles: new creatures slide in, changed ones are redrawn, nothing else is touched
function reconcile(grid, items, render, keyOf) {
  const have = new Map();
  for (const el of [...grid.children]) { if (el.dataset && el.dataset.id) have.set(el.dataset.id, el); else el.remove(); }
  let prev = null;
  for (const c of items) {
    let el = have.get(c.id);
    const k = keyOf(c);
    if (!el || el.dataset.k !== k) {
      const t = document.createElement('div'); t.innerHTML = render(c).trim();
      const nel = t.firstElementChild; bindCreatureEl(nel);
      if (el) el.replaceWith(nel);
      el = nel;
    }
    have.delete(c.id);
    const want = prev ? prev.nextElementSibling : grid.firstElementChild;
    if (want !== el) grid.insertBefore(el, want);
    prev = el;
  }
  for (const el of have.values()) el.remove();
  hydrateArt(grid);
}
function bindCreatureEl(el, find) {
  if (!el || !el.dataset || !el.dataset.id) return;
  el.addEventListener('click', (e) => {
    const c = (find || findCreature)(el.dataset.id);
    if (e.target.closest && e.target.closest('.tsave')) { e.stopPropagation(); downloadCard(c, 'portrait'); return; }
    openModal(c);
  });
}

// ---- data ----
let latest = { creatures: [], eggs: [], me: null, stats: { total: 0, machineHours: 0, sick: 0 } };
let boardData = [];
let bestiaryData = null;
let cfState = { a: null, b: null, result: null };
let pubInfo = null;
let known = new Set();
let freshIds = new Set(); // hatched since the last poll: their tiles pop in once
let firstLoad = true;
let server = { old: false, stale: false, info: null, checkedAt: 0 };
const RULES_FALLBACK = { rarity: [{ tier: 'Common', maxMs: 20000 }, { tier: 'Uncommon', maxMs: 90000 }, { tier: 'Rare', maxMs: 300000 }, { tier: 'Epic', maxMs: 1200000 }, { tier: 'Legendary', maxMs: null }], mythic: { runMs: 7200000, subagents: 10, streak: 30 }, minHatchMs: 10000 };
const rules = () => latest.rules || RULES_FALLBACK;

// ---- icons ----
const IC = {
  shelf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  proof: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21C7 17 3 13.7 3 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 9 2.6c0 4.1-4 7.4-9 11.4z"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="14"/></svg>',
  bestiary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 12h17M12 3.5v17"/><circle cx="7.8" cy="7.8" r="1.4" fill="currentColor"/><circle cx="16.2" cy="16.2" r="1.4" fill="currentColor"/></svg>',
  antechamber: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="18" rx="1.5"/><circle cx="15.5" cy="12" r="1"/></svg>',
  skills: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15l5-5 4 4 7-8"/><path d="M20 6h-4"/><path d="M20 6v4"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/></svg>',
};

const PRIMARY_KEYS = ['home', 'collection', 'skills', 'bestiary'];
const SECTIONS = [
  { key: 'home', label: 'Home', short: 'Home', icon: IC.home, eyebrow: '', title: 'Your creatures', render: sec_home },
  { key: 'collection', label: 'Collection', short: 'Collection', icon: IC.shelf, eyebrow: '', title: 'Collection', render: sec_collection },
  { key: 'skills', label: 'Skills', short: 'Skills', icon: IC.skills, eyebrow: 'What you gain', title: 'Skills', render: sec_skills },
  { key: 'bestiary', label: 'Dex', short: 'Dex', icon: IC.bestiary, eyebrow: 'Collect them all', title: 'The Dex', render: sec_bestiary },
  { key: 'board', label: 'Leaderboard', short: 'Board', icon: IC.board, eyebrow: 'Compare', title: 'Leaderboard', render: sec_board },
  { key: 'proof', label: 'How it works', short: 'How', icon: IC.proof, eyebrow: '', title: 'How it works', render: sec_proof },
  { key: 'lounge', label: 'Lounge', short: 'Lounge', icon: IC.antechamber, eyebrow: '', title: 'The Lounge', render: sec_antechamber },
];
let current = 'home';
let moreOpen = false;

// ---- the egg: one deterministic drawing shared by "growing now" and the hatch reveal ----
// Crack zig-zag, speckles and tilt all come from the seed, never from a random source.
function eggGeo(seed) {
  const rng = rngFor((seed ^ 0x5eed) >>> 0), pts = [], n = 9;
  for (let i = 0; i <= n; i++) pts.push([30 + (140 * i) / n, 128 + (i % 2 ? -1 : 1) * (6 + rng() * 9) + (rng() - 0.5) * 6]);
  const spots = []; for (let i = 0; i < 9; i++) spots.push([58 + rng() * 84, 70 + rng() * 120, 2 + rng() * 5]);
  const branch = [[pts[3][0], pts[3][1]], [pts[3][0] - 6 + rng() * 4, pts[3][1] + 14 + rng() * 6], [pts[3][0] + 2, pts[3][1] + 26]];
  const branch2 = [[pts[6][0], pts[6][1]], [pts[6][0] + 5, pts[6][1] - 13 - rng() * 6], [pts[6][0] + 1, pts[6][1] - 24]];
  return { pts, spots, branch, branch2, tilt: (rng() - 0.5) * 6 };
}
const EGG_D = 'M100 50C141 50 160 116 160 150C160 190 133 212 100 212C67 212 40 190 40 150C40 116 59 50 100 50Z';
function eggSVG(seed, glow, size, o) {
  o = o || {};
  // a per-drawing id, so two eggs on a page never share gradients
  const g = eggGeo(seed), id = 'eg' + (seed >>> 0).toString(36) + (o.k || '') + '-' + (++artSeq).toString(36), shell = lighten(glow, 0.12), deep = darken(glow, 0.55);
  const zz = pathOf(g.pts, false), top = pathOf([[-10, g.pts[0][1]], ...g.pts, [210, g.pts[g.pts.length - 1][1]], [210, -10], [-10, -10]], true), bot = pathOf([[-10, g.pts[0][1]], ...g.pts, [210, g.pts[g.pts.length - 1][1]], [210, 250], [-10, 250]], true);
  const body = (clip) => `<g${clip ? ` clip-path="url(#${clip})"` : ''}><path d="${EGG_D}" fill="url(#${id}-f)" stroke="${darken(glow, 0.7)}" stroke-width="4"/>${g.spots.map(([x, y, r]) => `<ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(r)}" ry="${F(r * 0.8)}" fill="${deep}" opacity=".28"/>`).join('')}<path d="${EGG_D}" fill="url(#${id}-s)"/><ellipse cx="78" cy="88" rx="13" ry="22" transform="rotate(24 78 88)" fill="#fff" opacity=".5"/><circle cx="70" cy="122" r="3.4" fill="#fff" opacity=".75"/></g>`;
  const defs = `<defs><radialGradient id="${id}-f" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${lighten(shell, 0.6)}"/><stop offset=".45" stop-color="${shell}"/><stop offset="1" stop-color="${darken(glow, 0.45)}"/></radialGradient><radialGradient id="${id}-s" cx="50%" cy="50%" r="55%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient><radialGradient id="${id}-w" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${glow}" stop-opacity=".55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient><clipPath id="${id}-t"><path d="${top}"/></clipPath><clipPath id="${id}-b"><path d="${bot}"/></clipPath></defs>`;
  const warm = `<ellipse cx="100" cy="140" rx="96" ry="100" fill="url(#${id}-w)" class="egg-warm"/><ellipse cx="100" cy="216" rx="56" ry="7" fill="#000" opacity=".45"/>`;
  if (!o.crack) return `<svg class="eggart" viewBox="0 0 200 230" width="${size}" height="${Math.round(size * 1.15)}" aria-hidden="true">${defs}${warm}<g class="egg-wob" style="transform-origin:100px 212px">${body()}</g></svg>`;
  const cp = (d, cls, w) => '<path class="rv-crack' + cls + '" pathLength="1" d="' + d + '" fill="none" stroke="#fff8e0" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"/>';
  const crack = cp(zz, '', 3.2) + cp(pathOf(g.branch, false), ' rv-c2', 2.2) + cp(pathOf(g.branch2, false), ' rv-c2', 2.2);
  return `<svg class="eggart rv-eggsvg" viewBox="0 0 200 230" width="${size}" height="${Math.round(size * 1.15)}" aria-hidden="true">${defs}${warm}<g class="rv-egg" style="transform-origin:100px 212px"><g class="rv-top">${body(id + '-t')}</g><g class="rv-bot">${body(id + '-b')}</g><g class="rv-cracks">${crack}</g></g></svg>`;
}
// what a running egg will become, from its real start time and the real thresholds
function eggForecast(ms, subs) {
  const R = rules(), tiers = R.rarity, my = R.mythic || RULES_FALLBACK.mythic;
  if (ms < (R.minHatchMs || 10000)) return { now: null, html: `Too young to hatch · it needs ${fmtClock((R.minHatchMs || 10000) - ms)} more`, pct: 0, idx: -1 };
  // rule 2: rarity is set at hatch from what the run got done, so time only fills the Marathon meter
  if (R.rarityRule === 2) {
    const mm = R.marathonMs || 1200000;
    return { now: null, idx: -1, pct: Math.min(1, ms / mm), html: `Rarity is set when it hatches, from what the run gets done: tool calls that worked, kinds of tools, files written, commits${subs >= my.subagents ? ` · <b style="color:${TIERC.Mythic}">Mythic</b> if it earns Legendary without failing` : ''} · ${ms < mm ? `Marathon in ${fmtClock(mm - ms + 1000)}` : 'Marathon earned'}` };
  }
  let idx = tiers.findIndex((t) => t.maxMs == null || ms <= t.maxMs); if (idx < 0) idx = tiers.length - 1;
  const now = tiers[idx].tier, bits = [];
  for (let i = idx; i < tiers.length - 1; i++) {
    const at = tiers[i].maxMs, next = tiers[i + 1].tier;
    bits.push(i === idx ? `<b style="color:${TIERC[next]}">${next}</b> in ${fmtClock(at - ms + 1000)}` : `${next} at ${fmtClock(at + 1000).replace(/ 0s$/, '')}`);
  }
  if (idx === tiers.length - 1) bits.push(ms < my.runMs ? `<b style="color:${TIERC.Mythic}">Mythic</b> at ${fmtClock(my.runMs)} ${subs >= my.subagents ? 'if nothing fails' : `with ${my.subagents}+ subagents (${fmtN(subs)} so far)`}` : subs >= my.subagents ? `<b style="color:${TIERC.Mythic}">Mythic</b> if it ends without failing` : `Mythic needs ${my.subagents - subs} more subagents`);
  // the meter: five equal segments, filled within the current tier by elapsed time
  const lo = idx === 0 ? (R.minHatchMs || 10000) : tiers[idx - 1].maxMs, hi = tiers[idx].maxMs || my.runMs;
  const pct = Math.min(1, (idx + Math.min(1, Math.max(0, (ms - lo) / Math.max(1, hi - lo)))) / tiers.length);
  return { now, idx, pct, html: `Hatches <b style="color:${TIERC[now]}">${now}</b> if it ends now${bits.length ? ' · ' + bits.join(' · ') : ''}` };
}
// live status of a run: working, needs your input (Notification hook), done (Stop)
const WAIT_LINE = { permission: 'Claude is asking for permission', question: 'Claude has a question for you', input: 'Claude is waiting for you' };
const DONE_SHOW_MS = 2 * 60 * 1000;
const waitingEggs = () => (latest.eggs || []).filter((e) => e.status === 'input');
const recentDone = () => (latest.done || []).filter((d) => Date.now() - d.endedAt < DONE_SHOW_MS && !(latest.eggs || []).some((e) => e.id === d.id));
function statusTag(kind) { return `<span class="run-status rs-${kind}">${kind === 'input' ? 'Needs your input' : kind === 'done' ? 'Done' : 'Working'}</span>`; }
function doneBox(d) {
  const c = d.creatureId ? findCreature(d.creatureId) : null, col = (ART_PAL[d.domainKey] || ART_PAL.wisp).glow;
  return `<div class="egg is-done${c ? ' link-c' : ''}"${c ? ` data-id="${escapeXml(c.id)}"` : ''}>${c ? creatureSVG(c, 54) : eggSVG(hashString(String(d.id)), col, 54)}<div class="egg-txt">${statusTag('done')}<b>${c ? 'Hatched ' + escapeXml(shortName(c)) : 'Run finished'}</b><span class="egg-meta">${(DOMAIN_LABEL[d.domainKey] || 'General')} work · ${c ? `<span style="color:${c.rarity.chip}">${c.rarity.tier}</span> · ${escapeXml(c.durationLabel || '')} run` : 'too quick to hatch (under 10 seconds)'} · ${ago(d.endedAt)}</span></div></div>`;
}
function eggBox(e) {
  const col = (ART_PAL[e.domainKey] || ART_PAL.wisp).glow, ms = Date.now() - Number(e.startedAt), fc = eggForecast(ms, e.subagents || 0);
  const segs = rules().rarity.map((t, i) => `<i style="--c:${TIERC[t.tier]}" class="${i <= fc.idx ? 'on' : ''}"></i>`).join('');
  const wait = e.status === 'input';
  return `<div class="egg${wait ? ' is-waiting' : ''}" data-start="${Number(e.startedAt) || 0}" data-subs="${e.subagents || 0}">${eggSVG(hashString(String(e.id)), col, 54)}<div class="egg-txt">${statusTag(wait ? 'input' : 'working')}<b>${wait ? escapeXml(WAIT_LINE[e.waiting] || WAIT_LINE.input) + ' in the terminal' : 'A creature is growing'}</b><span class="egg-meta">${(DOMAIN_LABEL[e.domainKey] || 'General')} work · <span class="timer">${fmtClock(ms)}</span>${e.subagents ? ` · ${plural(e.subagents, 'subagent')}` : ''}</span>
    <div class="meter">${segs}<em style="left:${(fc.pct * 100).toFixed(1)}%"></em></div><div class="forecast">${fc.html}</div></div></div>`;
}

// ---- section: home (a showcase of the newest arrival, then the day) ----
const GOALS = [['auto', 0], ['runs', 5], ['runs', 10], ['runs', 20], ['runs', 40], ['minutes', 60], ['minutes', 120], ['minutes', 240]];
function goalPanel(en) {
  const g = en.goal, pct = Math.min(1, g.progress / Math.max(1, g.target)), met = g.met;
  const unit = g.type === 'runs' ? (g.target === 1 ? 'run' : 'runs') : 'min';
  const ring = ringSVG(112, pct, { color: met ? '#f5c451' : '#6ee7a5', key: met ? 'paragon' : '', ring: met ? 'gold' : null }, '', { sw: 10, cls: met ? 'ring-met' : '' });
  // auto follows your real median day, clamped to 3..100 runs: say so instead of calling the clamp a median
  const med = Math.round(Number(g.median) || 0), runsN = (n) => plural(n, 'run');
  const autoLabel = !g.auto || med === g.target ? `Auto · median ${runsN(med || g.target)}` : `Auto · ${runsN(g.target)} (${med < g.target ? 'min' : 'max'})`;
  const opt = ([t, n]) => { const sel = t === 'auto' ? !!g.auto : !g.auto && t === g.type && n === g.target; return `<option value="${t}:${n}" ${sel ? 'selected' : ''}>${t === 'auto' ? escapeXml(autoLabel) : `${n} ${t === 'runs' ? 'runs' : 'machine-min'} a day`}</option>`; };
  const custom = g.auto || GOALS.some(([t, n]) => t === g.type && n === g.target) ? '' : `<option selected value="${g.type}:${g.target}">${g.target} ${g.type === 'runs' ? 'runs' : 'machine-min'} a day</option>`;
  const left = g.target - g.progress;
  return `<div class="goal ${met ? 'met' : ''}"><div class="goal-ring">${ring}<div class="goal-num"><b>${fmtN(g.progress)}</b><span>of ${fmtN(g.target)} ${unit}</span></div></div>
    <div class="goal-txt"><span class="eyebrow">Daily goal${g.auto ? ' · auto' : ''}</span><h3>${met ? 'Goal met today' : g.progress ? `${fmtN(left)} ${g.type === 'runs' ? 'more ' + (left === 1 ? 'run' : 'runs') : 'more machine-min'} to go` : 'Nothing hatched yet today'}</h3>
    <div class="note">${g.auto ? (med === g.target ? `Set from your median day: ${runsN(med)}` : (med ? `Your median day is ${runsN(med)}, so the auto goal sits at its ${med < g.target ? 'minimum' : 'maximum'} of ${runsN(g.target)}` : `No past days to take a median from yet, so the auto goal starts at its minimum of ${runsN(g.target)}`)) : `Today: ${runsN(en.today.runs)} · ${fmtN(en.today.minutes)} machine-min`}</div>
    <select id="goalsel" class="sel" aria-label="daily goal">${custom}${GOALS.map(opt).join('')}</select></div></div>`;
}
function streakPanel(en) {
  const days = []; // last 7 local days, oldest first, from the real week series
  const wk = (latest.skills && latest.skills.list.reduce((acc, s) => { (s.week || []).forEach((v, i) => (acc[i] = (acc[i] || 0) + v)); return acc; }, [])) || [];
  for (let i = 0; i < 7; i++) days.push(wk[i] > 0);
  const dn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], today = new Date().getDay();
  const toMythic = (rules().mythic || RULES_FALLBACK.mythic).streak - en.streak;
  return `<div class="streak ${en.streak ? 'on' : ''}"><div class="streak-top">${FLAME}<b class="num">${en.streak}</b><span>day streak</span></div>
    <div class="week-dots">${days.map((on, i) => `<div class="wd ${on ? 'on' : ''}"><i></i><span>${dn[(today - 6 + i + 14) % 7]}</span></div>`).join('')}</div>
    <div class="note">Best ${plural(en.bestStreak, 'day')} · ${toMythic > 0 && en.streak ? `${plural(toMythic, 'more day')} in a row hatches a Devoted Mythic` : plural(en.activeDays, 'active day') + ' on record'}</div></div>`;
}
function welcomeState() { try { return { n: Number(localStorage.getItem('pol_visits') || 0), off: localStorage.getItem('pol_welcomed') === '1' }; } catch { return { n: 1, off: false }; } }
let visitCounted = false;
function countVisit() { if (visitCounted) return; visitCounted = true; try { localStorage.setItem('pol_visits', String(Number(localStorage.getItem('pol_visits') || 0) + 1)); } catch {} }
function welcomeHTML() {
  const w = welcomeState();
  if (w.off) return '';
  if (w.n <= 1) return `<div class="welcome"><button class="wx" id="wx" title="dismiss" aria-label="dismiss">✕</button><h2>Meet your creatures</h2><p>Every time Claude works on a task for you, a creature hatches from what really happened in that run. Runs that get more done hatch rarer creatures, the tools it used decide its species, and every one is a one-off: its colorway, accessory and face come from its signed seed.</p></div>`;
  return `<div class="tip"><span>Every Claude run hatches one. Runs that get more done hatch rarer ones, about 1 in 64 is Shiny, and the runs that follow raise them.</span><button class="wx" id="wx" title="dismiss" aria-label="dismiss">✕</button></div>`;
}
function showcaseHTML(c) {
  const v = variantOf(c), st = stageOf(c), gains = gainsOf(c).slice(0, 3), T = c.rarity.tier, glow = (ART_PAL[c.speciesKey] || ART_PAL.wisp).glow;
  return `<div class="panel showcase t-${T.toLowerCase()}${v && v.shiny ? ' is-shiny' : ''}" style="--tier:${c.rarity.chip};--glow:${v ? v.colorway.glow : glow}">
    <div class="sc-stage">${TIERI[T] >= 3 || (v && v.shiny) ? '<div class="sc-rays"></div>' : ''}<div class="sc-motes"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="sc-spot"></div><div class="sc-art link-c" data-id="${escapeXml(c.id)}">${creatureVisual(c, 360, { live: true, hero: true })}</div></div>
    <div class="sc-info"><span class="eyebrow">Newest arrival · ${ago(c.bornAt)}</span>
      <h2>${escapeXml(c.fullName)}</h2>
      <div class="sc-variant">${v && v.shiny ? '<span class="shinychip big">✦ Shiny</span>' : ''}${escapeXml(v ? v.full : c.speciesName)}</div>
      <div class="chips"><span class="chip" style="color:${c.rarity.chip}">${T}</span><span class="trait">${escapeXml(c.speciesName)}</span><span class="trait">${escapeXml(lvLine(c))}</span>${(c.traits || []).map((t) => `<span class="trait">${escapeXml(t)}</span>`).join('')}</div>
      <p class="note sc-origin">${escapeXml(originLine(c))}</p>
      ${gains.length ? `<div class="gains">${gains.map(([k, v2]) => `<span class="gain">+${fmtN(v2)} ${escapeXml(skillName(k))}</span>`).join('')}</div>` : ''}
      <div class="btns left"><button class="primary" id="savenew">${SAVE_IC} Save share card</button><button id="replay">Replay the hatch</button><button id="opennew">Details</button></div></div></div>`;
}
function sec_home() {
  countVisit();
  const cs = latest.creatures, en = latest.engagement;
  const welcome = welcomeHTML();
  const dn = recentDone();
  const growing = latest.eggs.length || dn.length ? `<div class="panel growing"><div class="p-head"><h2>${latest.eggs.length ? 'Growing now' : 'Just finished'}</h2><span class="note">${waitingEggs().length ? 'a run is waiting on you' : latest.eggs.length ? 'the real clock of each running agent' : 'runs that ended in the last 2 minutes'}</span></div><div class="eggs">${latest.eggs.map(eggBox).join('')}${dn.map(doneBox).join('')}</div></div>` : '';
  if (!cs.length) return `${welcome}<div class="panel hero-empty">${eggSVG(1234, '#a48ff0', 120)}${latest.eggs.length ? '<h2>Your first creature is on its way</h2><p class="p-desc">Claude is working on a task right now. When the run ends, it hatches here, and the longer it runs the rarer it gets.</p>' : '<h2>Your first egg is waiting</h2><p class="p-desc">The next time Claude works on a task for you, an egg appears here and hatches when the run ends.</p>'}</div>${growing}`;
  const newest = cs[0];
  const today = en && en.goal ? `<div class="panel today">${goalPanel(en)}<div class="divider"></div>${streakPanel(en)}</div>` : '';
  const dx = dexSummary();
  const dexPanel = `<div class="panel dexmini link-go" data-go="bestiary"><div class="p-head"><h2>The Dex</h2><span class="note link">open →</span></div>
    <div class="dm-row">${ringSVG(96, dx.found / dx.total, { color: '#b28dff', gradient: ['#ff7bd0', '#b28dff', '#67a8f0'] }, `<text x="48" y="53" text-anchor="middle" class="ring-n">${Math.round((100 * dx.found) / dx.total)}%</text>`, { sw: 8 })}<div><b class="num big">${fmtN(dx.found)}</b><span class="of"> of ${fmtN(dx.total)} found</span><div class="note" style="margin-top:4px">${plural(dx.shiny, 'Shiny', 'Shinies')} · ${plural(dx.mythic, 'Mythic')} · ${dx.sets} full colorway sets</div></div></div>
    <span class="eyebrow" style="display:block;margin-top:14px">Next to find</span>${dx.next.slice(0, 2).map((h) => `<div class="hint"><b>${escapeXml(h.title)}</b><span>${escapeXml(h.how)}</span></div>`).join('')}</div>`;
  const rw = en && en.rarestWeek ? findCreature(en.rarestWeek.creatureId) : null;
  const wg = en && en.weekGains && en.weekGains.length ? en.weekGains : null, wmax = wg ? Math.max(...wg.map((g) => g.xp)) : 1;
  const week = `<div class="panel weekp"><div class="p-head"><h2>This week</h2><span class="note link" data-go="skills">all skills →</span></div>
    ${rw ? `<div class="rw link-c" data-id="${escapeXml(rw.id)}" style="--tier:${rw.rarity.chip}">${creatureSVG(rw, 84, { live: true })}<div><span class="eyebrow">Rarest this week</span><b>${escapeXml(shortName(rw))} <em class="rw-sp">${escapeXml(rw.speciesName)}</em></b><span><span style="color:${rw.rarity.chip}">${rw.rarity.tier}</span> · ${escapeXml(en.rarestWeek.durationLabel)} run · ${shortDate(rw.bornAt)}</span></div></div>` : ''}
    ${weekShareHTML()}${telemetryAsk()}
    ${wg ? wg.map((g) => { const s = latest.skills.list.find((x) => x.key === g.key); return `<div class="wk-row"><span>${escapeXml(g.name)}</span><b>+${fmtN(g.xp)} xp</b><div class="wk-bar"><i style="width:${Math.round((g.xp / wmax) * 100)}%;background:${s ? s.band.color : 'var(--green)'}"></i></div></div>`; }).join('') : '<p class="note">No skill gains in the last 7 days.</p>'}</div>`;
  const os = latest.stats.openSessions;
  const stats = `<div class="statstrip"><div class="stat"><b>${fmtN(cs.length)}</b><span>creatures</span></div><div class="stat"><b>${latest.stats.machineHours}</b><span>hours Claude worked</span></div><div class="stat"><b>${latest.skills ? fmtN(latest.skills.totalLevel) : '—'}</b><span>total level</span></div>${hasPower(latest.me) ? `<div class="stat"><b>${fmtN(latest.me.score)}</b><span>power</span></div><div class="stat"><b>${fmtN(latest.me.week)}</b><span>points this week</span></div>` : ''}
    ${os && os.count ? `<p class="note">Not counted as machine time: ${plural(os.count, 'session')} left open for ${os.hours} h. ${os.count === 1 ? 'It keeps its creature.' : 'They keep their creatures.'}</p>` : ''}</div>`;
  const seg = (k, label) => `<button type="button" class="seg-b ${homeStrip === k ? 'on' : ''}" data-strip="${k}" aria-pressed="${homeStrip === k}">${label}</button>`;
  const preview = `<div class="p-head"><div class="ph-l"><h2>${homeStrip === 'newest' ? 'Recent hatches' : 'Your finest'}</h2><div class="seg" role="group" aria-label="show">${seg('finest', 'Finest')}${seg('newest', 'Newest')}</div></div><span class="note link" id="seeall">see all ${fmtN(cs.length)} →</span></div><div class="shelf recent" id="recent"></div>`;
  return `${welcome}${showcaseHTML(newest)}${growing}
    <div class="home-row">${today}${dexPanel}${week}</div>
    ${stats}
    <div class="panel" style="margin-top:16px">${preview}</div>`;
}

// the home strip: your finest (rarest and most raised) or the newest hatches
let homeStrip = (() => { try { return localStorage.getItem('pol_strip') === 'newest' ? 'newest' : 'finest'; } catch { return 'finest'; } })();
const stripList = () => (homeStrip === 'newest' ? latest.creatures.slice(0, 10) : latest.creatures.filter((c) => !isOpenRun(c)).sort(byFeatured).slice(0, 10));

// ---- section: collection (filters, sort, paging; tiles update in place) ----
const COLL_DEFAULT = { species: 'all', tier: 'all', trait: 'all', look: 'all', sort: 'featured', q: '', shown: 60 };
let coll = (() => { try { return Object.assign({}, COLL_DEFAULT, JSON.parse(localStorage.getItem('pol_coll2') || '{}'), { shown: 60 }); } catch { return Object.assign({}, COLL_DEFAULT); } })();
let collOpen = false;
function saveColl() { try { const { shown, ...keep } = coll; localStorage.setItem('pol_coll2', JSON.stringify(keep)); } catch {} }
// Featured: the rarest and most raised first (rarity, Shiny and editions from variants.js, plus two points a level)
const featScore = (c) => (isOpenRun(c) ? -1000 : 0) + (PV ? PV.rankScore(c) : c.rarity.index * 10) + (c.level || 1) / 3;
const byFeatured = (a, b) => featScore(b) - featScore(a) || (b.durationMs || 0) - (a.durationMs || 0) || b.bornAt - a.bornAt;
const byRarest = (a, b) => (PV ? PV.rarer(a, b) : b.rarity.index - a.rarity.index || (b.durationMs || 0) - (a.durationMs || 0));
function collList() {
  const q = coll.q.trim().toLowerCase();
  let list = latest.creatures.filter((c) => {
    if (coll.species !== 'all' && c.speciesKey !== coll.species) return false;
    if (coll.tier !== 'all' && c.rarity.tier !== coll.tier) return false;
    if (coll.trait !== 'all' && !(c.traits || []).includes(coll.trait)) return false;
    if (coll.look !== 'all') {
      const v = variantOf(c);
      if (coll.look === 'shiny' && !(v && v.shiny)) return false;
      if (coll.look.startsWith('acc:') && !(v && v.accessory && v.accessory.key === coll.look.slice(4))) return false;
      if (coll.look.startsWith('stage:') && stageOf(c).key !== coll.look.slice(6)) return false;
      if (coll.look.startsWith('cw:') && !(v && v.colorway.key === coll.look.slice(3))) return false;
    }
    if (q && !(c.fullName.toLowerCase().includes(q) || (variantOf(c) || { full: '' }).full.toLowerCase().includes(q))) return false;
    return true;
  });
  const by = {
    featured: byFeatured, newest: (a, b) => b.bornAt - a.bornAt, oldest: (a, b) => a.bornAt - b.bornAt,
    rarest: byRarest,
    level: (a, b) => (b.level || 1) - (a.level || 1) || (b.xp || 0) - (a.xp || 0), longest: (a, b) => (b.durationMs || 0) - (a.durationMs || 0),
    name: (a, b) => a.fullName.localeCompare(b.fullName),
  }[coll.sort] || byFeatured;
  return list.sort(by);
}
function selectHTML(id, val, opts, label) { return `<label class="fsel"><span>${label}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${escapeXml(v)}" ${v === val ? 'selected' : ''}>${escapeXml(t)}</option>`).join('')}</select></label>`; }
function sec_collection() {
  const cs = latest.creatures;
  if (!cs.length) return `<p class="empty">No creatures yet. The next time Claude does a task for you, your first one is born.</p>`;
  const sp = [['all', 'All species']].concat(Object.keys(SPECIES).map((k) => [k, SPECIES[k].name]));
  const tiers = [['all', 'All rarities']].concat(TIERS.map((t) => [t, t]));
  const traitSet = new Set(); cs.forEach((c) => (c.traits || []).forEach((t) => traitSet.add(t)));
  const traits = [['all', 'Any trait']].concat([...traitSet].sort().map((t) => [t, t]));
  const looks = [['all', 'Any look'], ['shiny', '✦ Shiny only']].concat(PV ? PV.STAGES.map((s) => ['stage:' + s.key, s.name + 's']) : []).concat(PV ? Object.values(PV.ACCESSORIES).map((a) => ['acc:' + a.key, 'Wearing ' + a.name.toLowerCase()]) : []);
  const sorts = [['featured', 'Featured'], ['newest', 'Newest'], ['rarest', 'Rarest'], ['level', 'Highest level'], ['longest', 'Longest run'], ['oldest', 'Oldest'], ['name', 'Name']];
  const active = ['species', 'tier', 'trait', 'look'].filter((k) => coll[k] !== 'all').length + (coll.sort !== 'featured' ? 1 : 0);
  return `<div class="coll-bar${collOpen ? ' open' : ''}">
      <button class="ghost small cfilt" id="cfilt" aria-expanded="${collOpen ? 'true' : 'false'}">Filters${active ? ` · ${active}` : ''}</button>
      <label class="fsearch"><input id="cq" type="search" placeholder="Search names and variants" value="${escapeXml(coll.q)}" aria-label="search"/></label>
      ${selectHTML('cs', coll.species, sp, 'Species')}${selectHTML('ct', coll.tier, tiers, 'Rarity')}${selectHTML('ctr', coll.trait, traits, 'Trait')}${selectHTML('cl', coll.look, looks, 'Look')}${selectHTML('co', coll.sort, sorts, 'Sort')}
      <button class="ghost small" id="creset">Reset</button></div>
    <div class="coll-count note" id="ccount"></div>
    <div class="shelf" id="cgrid"></div>
    <div class="more-row"><button id="cmore" class="ghost">Show more</button></div>`;
}
function updateCollection() {
  const grid = document.getElementById('cgrid'); if (!grid) return;
  const list = collList(), shown = list.slice(0, coll.shown);
  reconcile(grid, shown, (c) => tileHTML(c), tileKey);
  const cnt = document.getElementById('ccount');
  if (cnt) cnt.textContent = list.length === latest.creatures.length ? `${fmtN(list.length)} creatures, each from a real Claude run · showing ${fmtN(shown.length)}` : `${fmtN(list.length)} of ${fmtN(latest.creatures.length)} match · showing ${fmtN(shown.length)}`;
  const more = document.getElementById('cmore');
  if (more) { more.hidden = shown.length >= list.length; more.textContent = `Show ${fmtN(Math.min(60, list.length - shown.length))} more`; }
  if (!list.length) grid.innerHTML = '<p class="empty" style="grid-column:1/-1">Nothing matches these filters.</p>';
}
function bindCollection(stage) {
  const on = (id, ev, fn) => { const el = stage.querySelector('#' + id); if (el) el.addEventListener(ev, fn); };
  on('cfilt', 'click', () => { collOpen = !collOpen; const bar = stage.querySelector('.coll-bar'); if (bar) bar.classList.toggle('open', collOpen); });
  const set = (k) => (e) => { coll[k] = e.target.value; coll.shown = 60; saveColl(); updateCollection(); };
  on('cs', 'change', set('species')); on('ct', 'change', set('tier')); on('ctr', 'change', set('trait')); on('cl', 'change', set('look')); on('co', 'change', set('sort'));
  let tq = null; on('cq', 'input', (e) => { clearTimeout(tq); tq = setTimeout(() => { coll.q = e.target.value; coll.shown = 60; saveColl(); updateCollection(); }, 160); });
  on('cmore', 'click', () => { coll.shown += 60; updateCollection(); });
  on('creset', 'click', () => { coll = Object.assign({}, COLL_DEFAULT); saveColl(); renderActive(); });
  updateCollection();
}

// ---- the Dex (computed here from your signed creatures and variants.js) ----
const SPECIES_HOW = { cog: 'a code run (code files, build or package commands)', scholar: 'a research run (web search and fetch)', moth: 'a writing run (docs and text files)', prism: 'a design run (design tools, image files)', lumen: 'a video run (video tools, ffmpeg, media files)', hydra: 'an outreach run (mail, LinkedIn, CRM, chat tools)', wisp: 'a browser or general run' };
const TIER_HOW = { Common: 'that gets a little done (under 20 points)', Uncommon: 'worth 20 to 49 points', Rare: 'worth 50 to 119 points', Epic: 'worth 120 to 249 points', Legendary: 'worth 250+ points with 3+ kinds of tool', Mythic: 'that earns Legendary with 10+ subagents and no failure, or the first run of a 30th day in a row' };
let dexMemo = { key: '', val: null };
function dexData() {
  const key = latest.creatures.length + '|' + (latest.creatures[0] ? latest.creatures[0].id : '') + '|' + (bestiaryData ? bestiaryData.breeds.length : 0);
  if (dexMemo.key === key) return dexMemo.val;
  const found = new Map();
  if (PV) {
    const mine = latest.me ? latest.me.handle : null;
    const all = latest.creatures.slice().sort((a, b) => a.bornAt - b.bornAt).concat(((bestiaryData && bestiaryData.breeds) || []).filter((b) => mine && b.bredBy && b.bredBy.includes(mine)));
    for (const c of all) for (const id of PV.slotsOf(c)) if (!found.has(id)) found.set(id, c);
  }
  const slots = PV ? PV.dexSlots() : [];
  dexMemo = { key, val: { found, slots } };
  return dexMemo.val;
}
function dexSummary() {
  const { found, slots } = dexData();
  const by = (k) => slots.filter((s) => s.kind === k);
  let sets = 0;
  if (PV) for (const sk of PV.SPECIES_KEYS) for (const cw of PV.COLORWAYS[sk]) if (PV.SET_TIERS.every((t) => found.has('ct:' + sk + ':' + cw.key + ':' + t))) sets++;
  return { found: found.size, total: slots.length || 1, shiny: by('shiny').filter((s) => found.has(s.id)).length, mythic: by('mythic').filter((s) => found.has(s.id)).length, sets, next: dexNext() };
}
// concrete, real ways to fill the slots still empty, closest first
function dexNext() {
  const { found, slots } = dexData(); if (!PV) return [];
  const out = [];
  const counts = {}; latest.creatures.forEach((c) => (counts[c.speciesKey] = (counts[c.speciesKey] || 0) + 1));
  for (const sk of PV.SPECIES_KEYS) {
    const name = SPECIES[sk].name;
    for (const t of PV.SET_TIERS) { const have = PV.COLORWAYS[sk].some((cw) => found.has('ct:' + sk + ':' + cw.key + ':' + t)); if (!have) out.push({ w: 10 + TIERI[t], title: `${aAn(t) === 'an' ? 'An' : 'A'} ${t} ${name}`, how: `${SPECIES_HOW[sk]} ${TIER_HOW[t]}` }); }
    if (!found.has('s:' + sk)) out.push({ w: 30 + (counts[sk] ? 0 : 5), title: `A Shiny ${name}`, how: `about 1 in ${PV.SHINY_ODDS} ${name}s hatches Shiny, chrome or holo with a sparkle` });
    if (!found.has('m:' + sk + ':gold')) out.push({ w: 40, title: `A Gold Chrome ${name}`, how: `a Legendary ${name}: ${SPECIES_HOW[sk]} over 20 minutes; 6 in 10 Legendaries are Gold Chrome` });
    if (!found.has('m:' + sk + ':holo')) out.push({ w: 42, title: `A Holo ${name}`, how: `a Legendary ${name}: 4 in 10 Legendaries are Holo` });
    const missingCw = PV.COLORWAYS[sk].filter((cw) => !PV.SET_TIERS.some((t) => found.has('ct:' + sk + ':' + cw.key + ':' + t)));
    for (const cw of missingCw) out.push({ w: 20, title: `A ${cw.name} ${name}`, how: `about 1 in 9 ${name}s hatches in ${cw.name}` });
    if (!found.has('my:' + sk)) out.push({ w: 60, title: `A Mythic ${name}`, how: `${SPECIES_HOW[sk]} that earns Legendary with 10+ subagents, or cross-feed with another operator` });
  }
  return out.sort((a, b) => a.w - b.w);
}
let dexOpen = null;
function silhouette(sk, tier) { return `<div class="sil">${creatureSVG(demoCreature('dex-' + sk + tier, sk, tier, { salt: 'dex', level: 15, vo: { colorway: 'classic', accessory: null, pattern: null, expression: 'calm' } }), 64)}<span>?</span></div>`; }
function sec_bestiary() {
  if (!PV) return `<p class="empty">The Dex needs /variants.js. Reload the page.</p>`;
  const { found, slots } = dexData(), sum = dexSummary(), pct = found.size / (slots.length || 1);
  const head = `<div class="panel tinted dex-head">
      <div class="dh-ring">${ringSVG(132, pct, { color: '#b28dff', gradient: ['#ff7bd0', '#b28dff', '#67a8f0', '#6ee7a5'] }, `<text x="66" y="72" text-anchor="middle" class="ring-n big">${Math.round(pct * 100)}%</text>`, { sw: 11 })}</div>
      <div class="dh-txt"><span class="eyebrow">Completion</span><h2><span class="num">${fmtN(found.size)}</span> of <span class="num">${fmtN(slots.length)}</span> slots found</h2>
        <div class="dh-stats">${[['set', 'Colorway × rarity', 'set'], ['mythic', 'Mythics', 'mythic'], ['shiny', 'Shinies', 'shiny'], ['edition', 'Gold & Holo', 'edition']].map(([k, label]) => { const all = slots.filter((s) => s.kind === k), f = all.filter((s) => found.has(s.id)).length; return `<div class="stat"><b>${fmtN(f)}<small>/${fmtN(all.length)}</small></b><span>${label}</span></div>`; }).join('')}</div>
        <p class="note">Every slot is filled by a real, signed creature: a species from what the run did, a rarity from what it got done (from how long it ran, for creatures hatched before Oct 10), a colorway and edition from its seed. ${sum.sets ? `${plural(sum.sets, 'full colorway set')} complete.` : 'No full colorway set yet: one colorway at every hatch rarity.'}</p></div></div>`;
  // species x rarity: the first creature that filled each cell, or a silhouette
  const grid = `<div class="panel dex-grid-panel"><div class="p-head"><h2>Species × rarity</h2><span class="note">tap a species for its colorway sets</span></div><div class="dex-grid"><div class="dg-h"></div>${TIERS.map((t) => `<div class="dg-h" style="color:${TIERC[t]}"><span class="lg">${t}</span><span class="sm">${t.slice(0, 3)}</span></div>`).join('')}
    ${PV.SPECIES_KEYS.map((sk) => {
      const row = TIERS.map((t) => {
        if (t === 'Mythic') { const c = found.get('my:' + sk); return `<div class="dg-c ${c ? 'got' : ''}" ${c ? `data-id="${escapeXml(c.id)}"` : ''} title="${c ? escapeXml(c.fullName) : 'Mythic ' + SPECIES[sk].name + ': not found yet'}">${c ? creatureSVG(c, 64) : silhouette(sk, t)}</div>`; }
        const cws = PV.COLORWAYS[sk].filter((cw) => found.has('ct:' + sk + ':' + cw.key + ':' + t));
        const first = cws.length ? found.get('ct:' + sk + ':' + cws[0].key + ':' + t) : null;
        return `<div class="dg-c ${first ? 'got' : ''}" ${first ? `data-id="${escapeXml(first.id)}"` : ''} title="${first ? escapeXml(first.fullName) : t + ' ' + SPECIES[sk].name + ': not found yet'}">${first ? creatureSVG(first, 64) : silhouette(sk, t)}<span class="dg-n">${cws.length}/8</span></div>`;
      }).join('');
      const have = slots.filter((s) => s.species === sk && found.has(s.id)).length, tot = slots.filter((s) => s.species === sk).length;
      return `<button class="dg-sp ${dexOpen === sk ? 'open' : ''}" data-dex="${sk}"><b>${SPECIES[sk].name}</b><span>${have}/${tot}</span></button>${row}${dexOpen === sk ? `<div class="dg-detail">${dexDetail(sk)}</div>` : ''}`;
    }).join('')}</div></div>`;
  const specials = `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Special editions</h2><span class="note">Shiny: about 1 in ${PV.SHINY_ODDS} · Legendary editions: Gold Chrome or Holo</span></div><div class="dex-spec">${PV.SPECIES_KEYS.map((sk) => {
      const cell = (id, label) => { const c = found.get(id); return `<div class="ds-c ${c ? 'got' : ''}" ${c ? `data-id="${escapeXml(c.id)}"` : ''} title="${c ? escapeXml(c.fullName) : label + ': not found yet'}">${c ? creatureSVG(c, 56) : `<div class="sil small">${creatureSVG(demoCreature('dsx-' + sk, sk, 'Rare', { salt: 'dex', level: 15, vo: { colorway: 'classic', accessory: null, pattern: null, expression: 'calm' } }), 56)}<span>?</span></div>`}<em>${label}</em></div>`; };
      return `<div class="ds-sp"><b>${SPECIES[sk].name}</b>${cell('s:' + sk, 'Shiny')}${cell('m:' + sk + ':gold', 'Gold')}${cell('m:' + sk + ':holo', 'Holo')}</div>`;
    }).join('')}</div></div>`;
  const next = sum.next.slice(0, 6);
  const hints = `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Next to find</h2><span class="note">real rules, closest first</span></div><div class="hints">${next.map((h) => `<div class="hint"><b>${escapeXml(h.title)}</b><span>${escapeXml(h.how)}</span></div>`).join('') || '<p class="note">Everything found. Truly.</p>'}</div></div>`;
  const bd = bestiaryData;
  const duos = bd && bd.duos && bd.duos.length ? `<div class="rituals" style="margin-top:12px">${bd.duos.map((d) => `<div class="ritual"><div><b>${escapeXml(d.species)}</b><span>@${escapeXml(d.pair[0])} + @${escapeXml(d.pair[1])} · ${escapeXml(d.domain)} work</span></div><span class="rchip" style="color:${d.chip};position:static">${d.tier}</span></div>`).join('')}</div>` : '';
  const breed = `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Cross-feed breeding</h2><span class="note">a Mythic hybrid from two operators who share a kind of work</span></div>${crossfeedPanel()}${duos}</div>`;
  return head + grid + specials + `<div class="grid cols-2 dex-low">${hints}${breed}</div>`;
}
function dexDetail(sk) {
  const { found } = dexData(), name = SPECIES[sk].name;
  const rows = PV.COLORWAYS[sk].map((cw) => `<div class="dd-row"><span class="dd-cw"><i style="background:${cw.body}"></i>${escapeXml(cw.name)}</span>${PV.SET_TIERS.map((t) => { const c = found.get('ct:' + sk + ':' + cw.key + ':' + t); return `<span class="dd-dot ${c ? 'got' : ''}" style="--c:${cw.body};--t:${TIERC[t]}" ${c ? `data-id="${escapeXml(c.id)}" title="${escapeXml(c.fullName)} · ${t}"` : `title="${escapeXml(cw.name)} ${t} ${name}: not found"`}></span>`; }).join('')}</div>`).join('');
  return `<div class="dd-head"><span></span>${PV.SET_TIERS.map((t) => `<span style="color:${TIERC[t]}">${t.slice(0, 3)}</span>`).join('')}</div>${rows}`;
}

// ---- section: how it works (rules drawn by the real renderer; your own runs as the examples) ----
const RARITY_RULES = [['Common', 'under 20 points'], ['Uncommon', '20+ points'], ['Rare', '50+ points'], ['Epic', '120+ points'], ['Legendary', '250+ points, 3+ kinds of tool'], ['Mythic', 'Legendary work with 10+ subagents, a 30-day streak, or cross-feeding']];
const RARITY_ADDS = { Common: 'glossy vinyl, a colorway and a face of its own', Uncommon: '+ a pattern and an accessory', Rare: '+ metal trim and glowing eyes', Epic: '+ glowing markings and an aura', Legendary: '+ Gold Chrome or Holo body, its own wings, bigger crest, star eyes', Mythic: '+ an animated iridescent body and a halo' };
const SPECIES_RULES = [['cog', 'Engineering', 'code files, build and package commands'], ['scholar', 'Research', 'web search and fetch'], ['moth', 'Writing', 'docs and text files'], ['prism', 'Design', 'design tools and image files'], ['lumen', 'Video', 'video tools, ffmpeg, media files'], ['hydra', 'Outreach', 'mail, LinkedIn, CRM and chat tools'], ['wisp', 'General', 'browser automation, or nothing classifiable']];
function sec_proof() {
  const mk = (latest.me && NAME2KEY[latest.me.topSpecies]) || 'hydra';
  const pin = { colorway: 'classic', expression: 'grin' };
  const rarity = `<div class="rar-ladder">${RARITY_RULES.map(([t, rule]) => `<div class="rar ${t === 'Mythic' ? 'myth' : ''}"><div class="rar-art">${creatureSVG(demoCreature('rule-' + t, mk, t, { salt: 'rule', level: 15, vo: Object.assign({ accessory: TIERI[t] >= 1 ? 'headphones' : null, pattern: TIERI[t] >= 1 ? 'spots' : null }, pin) }), 112)}</div><span class="chip" style="color:${TIERC[t]}">${t}</span><div class="note"><b>${rule}</b><br>${RARITY_ADDS[t]}</div></div>`).join('')}</div>`;
  const species = `<div class="sp-grid">${SPECIES_RULES.map(([k, d, sig]) => `<div class="sp">${creatureSVG(demoCreature('sp-' + k, k, 'Rare', { salt: 'sp', level: 15, vo: { colorway: 'classic', expression: 'grin' } }), 64)}<div><b>${SPECIES[k].name} <span class="note">· ${d}</span></b><span>${sig}</span></div></div>`).join('')}</div>`;
  // a vertical flow: it never wraps into a dangling arrow, at any width
  const hooks = `<ol class="hooks">
    <li class="hook"><b>UserPromptSubmit</b><span>egg laid, the clock starts</span></li>
    <li class="hook"><b>SubagentStop</b><span>each subagent, counted</span></li>
    <li class="hook"><b>Notification</b><span>needs your input, shown live</span></li>
    <li class="hook"><b>Stop</b><span>hatched and signed</span></li>
    <li class="hook born"><b>Creature born</b><span>species, rarity, skills</span></li></ol>`;
  // your real runs as the examples, never made-up run ids
  const real = latest.creatures.filter((c) => !c.bredBy && (c.durationMs || 0) <= 24 * 3600e3);
  const longest = real.slice().sort((a, b) => b.durationMs - a.durationMs)[0];
  const failed = latest.creatures.find((c) => c.error);
  const exCard = (c, label) => `<div class="hcard" data-id="${escapeXml(c.id)}"><span class="eyebrow">${label}</span>
      <div class="flow">${eggSVG(c.seed, (ART_PAL[c.speciesKey] || ART_PAL.wisp).glow, 60)}<span class="arrow">→</span>${creatureSVG(c, 104)}</div>
      <div class="rundata">run       ${escapeXml(c.att ? c.att.fp : c.id.slice(-8))}<br>duration  ${escapeXml(c.durationLabel)}<br>tools     ${c.toolCalls != null ? plural(c.toolCalls, 'call') : 'not recorded'}<br>status    ${c.error ? 'ended in an error ✗' : 'success ✓'}</div>
      <div class="verdict">Hatched <b style="color:${c.rarity.chip}">${c.rarity.tier.toUpperCase()}</b> ${escapeXml(c.speciesName)} · ${escapeXml((variantOf(c) || { full: '' }).full)}${c.status === 'sick' ? ' · <b class="tag-sick">sick</b>, raised back by later runs' : c.status === 'healed' ? ' · healed survivor' : ''}</div></div>`;
  const examples = longest ? `<div class="hero2">${exCard(longest, 'Your longest real run')}${failed ? exCard(failed, 'A run that really failed') : `<div class="hcard"><span class="eyebrow">When a run fails</span><div class="flow">${eggSVG(77, '#e8615b', 60)}<span class="arrow">→</span>${creatureSVG(demoCreature('Example', 'cog', 'Rare', { status: 'sick', salt: 'bad', level: 1 }), 104)}</div><p class="note">None of your runs has ended in an error yet. One that does hatches sick with a scar, and heals once later runs of the same kind raise it. Drawn here as an example, not a real run.</p></div>`}</div>` : `<p class="note">Your own runs appear here as examples once the first one hatches.</p>`;

  // growth: the same creature at every stage (a pure function of its seed and level)
  const stages = [[1, 'Hatchling', 'Lv 1-5 · still in its shell'], [6, 'Juvenile', 'Lv 6-14 · ornaments growing in'], [15, 'Adult', 'Lv 15-27 · fully grown'], [28, 'Elder', 'Lv 28-39 · bushy brows, whiskers, a warm glow'], [40, 'Exalted', 'Lv 40-60 · snow-white brows and a golden laurel']];
  const ladder = stages.map(([lv, name, sub]) => `<div class="rung">${creatureSVG(demoCreature('Ladder', mk, 'Epic', { salt: 'L', level: lv, vo: { colorway: 'classic', expression: 'grin', accessory: 'bow' } }), 116)}<div class="rname">${name}</div><div class="rl">${sub}</div></div>`).join('');

  // one of a kind: the same species and rarity, different seeds
  const variety = `<div class="variety">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const c = demoCreature('variety-' + i, mk, 'Rare', { salt: 'v' + i, level: 15 }); const v = variantOf(c); return `<div class="vr">${creatureSVG(c, 92)}<span>${escapeXml(v ? v.full : '')}</span></div>`; }).join('')}</div>`;

  // the most raised creature, with its OWN facts; your account totals sit in their own row below
  const mine = latest.creatures.slice().sort((a, b) => (b.level || 1) - (a.level || 1) || (b.xp || 0) - (a.xp || 0) || byRarest(a, b))[0];
  const fed = mine ? gainsOf(mine).slice(0, 3) : [];
  const nextXp = mine && (mine.level || 1) < LEVEL_XP.length ? LEVEL_XP[mine.level || 1] - (mine.xp || 0) : 0;
  const scars = latest.me ? latest.me.scars || 0 : 0;
  const survivor = mine ? `<div class="survivor">
    <div style="text-align:center" class="link-c" data-id="${escapeXml(mine.id)}">${creatureVisual(mine, 180)}<div class="mono" style="color:var(--faint);font-size:11px;margin-top:6px">${escapeXml(mine.att ? '#' + mine.att.fp : tagOf(mine))} ${mine.att ? '<span class="verified inline" title="signed">✓</span>' : ''}</div></div>
    <div><span class="eyebrow">Most raised creature</span><h2 style="font-size:22px;margin:4px 0 2px">${escapeXml(mine.fullName)}</h2>
      <div class="note" style="margin:0 0 12px">${escapeXml(lvLine(mine))} · <span style="color:${mine.rarity.chip}">${mine.rarity.tier}</span> ${escapeXml(mine.speciesName)} · ${escapeXml((variantOf(mine) || { full: '' }).full)}</div>
      <div class="sv-stats">
        <div class="stat"><b>${escapeXml(mine.bredBy ? 'bred' : mine.durationLabel || '—')}</b><span>its own run</span></div>
        <div class="stat"><b>${fmtN(mine.xp || 0)}</b><span>xp raised${nextXp > 0 ? ` · ${fmtN(nextXp)} to Lv ${(mine.level || 1) + 1}` : ' · fully raised'}</span></div>
        <div class="stat"><b>${mine.toolCalls != null ? fmtN(mine.toolCalls) : '—'}</b><span>tool calls in its run</span></div>
        <div class="stat"><b>${shortDate(mine.bornAt)}</b><span>born ${ago(mine.bornAt)}</span></div>
      </div>
      ${fed.length ? `<div class="gains" style="margin-top:12px">${fed.map(([k, v2]) => `<span class="gain">+${fmtN(v2)} ${escapeXml(skillName(k))}</span>`).join('')}<span class="note" style="align-self:center">skills its run fed</span></div>` : ''}</div></div>
    <div class="divider"></div>
    <div class="acct"><span class="eyebrow">Your account, all creatures</span>
      <div class="stats-row">
        <div class="stat"><b>${fmtN(latest.creatures.length)}</b><span>runs hatched</span></div>
        <div class="stat"><b>${latest.stats.machineHours}</b><span>machine hours</span></div>
        ${hasPower(latest.me) ? `<div class="stat"><b>${fmtN(latest.me.score)}</b><span>power</span></div>` : ''}
        <div class="stat"><b>${fmtN(scars)}</b><span>scars: runs that ended in an error</span></div>
      </div>
      ${scars ? `<div class="scars-grid" title="one mark for each run that ended in an error (${fmtN(scars)})">${Array.from({ length: Math.min(12, scars) }).map(() => '<div class="scar-dot">✕</div>').join('')}${scars > 12 ? `<span class="note">+${fmtN(scars - 12)}</span>` : ''}<span class="note scar-key">one mark per failed run: each hatched sick, and later good runs of its kind raise it back</span></div>` : '<p class="note">No scars yet: none of your runs has ended in an error.</p>'}</div>`
    : `<p class="empty">Your most raised creature appears once your first one hatches.</p>`;

  const prov = `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Provenance</h2><span class="note">ed25519 attestation</span></div>
    <div class="stats-row"><div class="stat"><b>${fmtN(latest.creatures.filter((c) => c.att).length)}</b><span>of your creatures signed</span></div><div class="stat"><b class="mono" style="font-size:15px">${pubInfo ? escapeXml(pubInfo.fingerprint.slice(0, 12)) : '—'}</b><span>attestor key</span></div><div class="stat"><b>ed25519</b><span>algorithm</span></div></div>
    <p class="note" style="margin-top:12px">Every creature carries an Ed25519 signature over its run's recorded facts: owner, duration, domain, rarity, seed and activity counts. It is tamper-evident: nobody can change a record later without it showing. Its look (colorway, accessory, face, Shiny) is read off the signed seed, so it can't be edited either. The signing key lives on your machine, so this is your own record, not an audit. Open any creature and press Check signature.</p>
    ${telemetryLine()}</div>`;

  return `<div class="panel tinted"><div class="p-head"><h2>Rarity is what the run got done</h2><span class="note">every tier is a visible upgrade</span></div>${rarity}<p class="note">Points: 1 per tool call that worked (up to 200), 5 per kind of tool used, 3 per file written or edited, 10 per git commit, 15 per push, minus 3 per failed call. Run length only earns the Marathon trait (20 minutes or more). Creatures hatched before Oct 10 keep the tier their run length gave them.</p></div>
  <div class="panel" style="margin-top:16px"><div class="p-head"><h2>Every creature is one of a kind</h2><span class="note">8 colorways a species · 6 patterns · 7 accessories · 7 faces · 1 in ${PV ? PV.SHINY_ODDS : 64} Shiny</span></div>${variety}<p class="note">Same species, same rarity: the look is read off each run's signed seed, so no two runs hatch the same creature.</p></div>
  <div class="grid cols-2" style="margin-top:16px">
    <div class="panel"><div class="p-head"><h2>Species is what the run did</h2></div>${species}<p class="note">Read from tool names, file extensions and command names only. Never prompts, paths, file contents or arguments.</p></div>
    <div class="panel"><div class="p-head"><h2>Built on Claude Code hooks</h2></div>${hooks}<div class="divider"></div><span class="eyebrow">Examples from your own runs</span><div style="margin-top:12px">${examples}</div></div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="p-head"><h2>Raised by the runs that follow</h2><span class="note">each good run raises the earlier creatures of its kind, on 60 levels that slow as they climb</span></div><div class="ladder">${ladder}</div></div>
  <div class="panel" style="margin-top:16px">${survivor}</div>
  ${prov}`;
}

// usage stats (TELEMETRY.md): always say whether it is on and how to change it
function telemetryLine() {
  const t = server.info && server.info.telemetry;
  if (!t) return '<p class="note" id="telemetry-line">Usage stats: off unless you said yes. See TELEMETRY.md.</p>';
  const what = t.enabled ? `on (${escapeXml(t.reason)}): once a week, counts only${t.lastSentWeek ? `, last sent ${escapeXml(t.lastSentWeek)}` : ''}${t.endpointSet ? '' : ', no collector set so nothing is sent'}` : `off (${escapeXml(t.reason)})`;
  const btn = t.canSet ? ` <button data-tel="${t.enabled ? 'off' : 'on'}">${t.enabled ? 'Turn off' : 'Turn on'}</button>` : '';
  return `<p class="note" id="telemetry-line">Usage stats: ${what}. To change it: <code>${escapeXml(t.change)}</code>${t.enabled ? ' (or set POL_TELEMETRY=off)' : ''}${t.canSet ? ', or here' : ''}. What is and is never sent: TELEMETRY.md.${btn}</p>`;
}
// asked once on Home when nobody has answered yet (plugin and npx installs are
// never asked in a terminal): Yes or No is stored in telemetry.json, no hooks touched
function telemetryAsk() {
  const t = server.info && server.info.telemetry;
  if (!t || t.decided || !t.canSet) return '';
  return `<div class="wk-share" id="tel-ask"><span class="note">Share anonymous weekly usage counts to help improve Proof of Life? Once a week: a random install ID, app version, number of runs, active days and runs per type of work. Never names, prompts, paths, file contents or commands (TELEMETRY.md).</span><span><button data-tel="on">Yes, share counts</button> <button data-tel="off">No</button></span></div>`;
}
async function setTelemetry(on) {
  try {
    const r = await fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: on }) });
    if (r.ok) { const j = await r.json(); server.info = Object.assign({}, server.info, { telemetry: j.telemetry }); }
  } catch {}
  renderActive();
}

// ---- section: skills (computed server-side in skills.js; rendered here) ----
const GROUP_INFO = { work: ['Work', 'What the runs did, read from their tools. One run splits its experience across every skill it really exercised.'], craft: ['Craft', 'How you run agents: bonuses on top of each run.'], habits: ['Habits', 'Showing up: computed per day across all your runs.'], style: ['Style', 'How and when you work: deep runs, speed, clean streaks, early mornings, weekends, new tools, the Dex.'] };
const SKILL_GLYPH = {
  focus: { accessory: 'goggles', expression: 'determined' }, velocity: { accessory: 'headphones', expression: 'grin' }, precision: { accessory: 'visor', expression: 'determined' },
  earlybird: { accessory: 'beanie', expression: 'sleepy' }, weekend: { accessory: 'visor', expression: 'grin' }, explorer: { accessory: 'goggles', expression: 'grin' },
  multitasker: { accessory: 'headphones', expression: 'smug' }, terminal: { accessory: 'visor', expression: 'determined' }, reviewer: { accessory: 'goggles', expression: 'calm' },
  collector: { accessory: 'bow', expression: 'tongue', shiny: true }, nightowl: { accessory: null, expression: 'sleepy' }, testing: { accessory: 'goggles', expression: 'determined' },
  shipping: { accessory: 'headphones', expression: 'grin' }, debugging: { accessory: 'goggles', expression: 'smug' },
};
const tierForLevel = (L) => (L >= 100 ? 'Mythic' : L >= 70 ? 'Legendary' : L >= 50 ? 'Epic' : L >= 30 ? 'Rare' : L >= 10 ? 'Uncommon' : 'Common');
function skillGlyph(s, salt) { return demoCreature('skill-' + s.key, s.species, tierForLevel(s.level), { salt: salt || 'sk', level: isLocked(s) ? 15 : Math.max(15, Math.min(45, 15 + Math.floor(s.level / 4))), vo: Object.assign({ colorway: 'classic', expression: 'grin' }, SKILL_GLYPH[s.key] || {}) }); }
function sparkSVG(week, color) {
  const w = 84, h = 22, mx = Math.max(1, ...week), pts = week.map((v, i) => [4 + (i * (w - 8)) / 6, h - 4 - (v / mx) * (h - 8)]);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${pathOf(pts, false)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" opacity=".7"/>${pts.map(([x, y], i) => `<circle cx="${F(x)}" cy="${F(y)}" r="${week[i] > 0 ? 2.2 : 1.4}" fill="${week[i] > 0 ? color : '#3a3d4a'}"/>`).join('')}</svg>`;
}
const maxLevel = () => (latest.skills && latest.skills.maxLevel) || 120;
const isLocked = (s) => (s.locked != null ? !!s.locked : !!s.tracking);
const TOTAL_BANDS_FB = [[0, 'Initiate'], [100, 'Operator'], [250, 'Veteran'], [450, 'Elite'], [700, 'Archon'], [1000, 'Sovereign'], [1500, 'Titan'], [2200, 'Eternal']];
// what is next for a skill, without a label (callers add their own)
function nextLine(s) {
  if (isLocked(s)) return 'Locked';
  if (s.level >= maxLevel()) return s.stars >= 5 ? 'Max prestige' : `${fmtN(s.toNext)} xp to prestige star ${s.stars + 1}`;
  return s.nextBand ? `${s.nextBand.name} at Lv ${s.nextBand.level} · ${fmtN(Math.max(0, s.nextBand.xp - s.xp))} xp to go` : `${fmtN(s.toNext)} xp to Lv ${s.level + 1}`;
}
function skillCard(s) {
  const col = s.band.color;
  if (isLocked(s)) {
    return `<button class="skill-card locked" data-skill="${s.key}" style="--band:#5c6276">
      <div class="sc-ring lock">${LOCK}</div>
      <div class="sc-body"><div class="sc-top"><span class="sc-name">${escapeXml(s.name)}</span></div><div class="sc-chips"><span class="band-chip lockchip">Locked</span></div>
        <div class="sc-unlock"><b>How to unlock</b>${escapeXml(s.unlock || '')}</div></div>
      <div class="sc-glyph sil-glyph">${creatureSVG(skillGlyph(s), 46)}</div></button>`;
  }
  const ring = ringSVG(64, s.pct, s.band, `<text x="32" y="39" text-anchor="middle" class="ring-n">${s.level}</text>`, { sw: 5 });
  const last = s.lastGain ? `+${fmtN(s.lastGain.xp)} xp · ${ago(s.lastGain.at)}` : 'no gains yet';
  return `<button class="skill-card" data-skill="${s.key}" style="--band:${col}">
    <div class="sc-ring">${ring}</div>
    <div class="sc-body">
      <div class="sc-top"><span class="sc-name">${escapeXml(s.name)}</span></div>
      <div class="sc-chips"><span class="band-chip" style="color:${col}">${escapeXml(s.title)}</span>${s.stars ? `<span class="stars">${'★'.repeat(s.stars)}</span>` : ''}</div>
      <div class="sc-sig">${escapeXml(s.fact || s.signal || '')}</div>
      <div class="sc-next">Next: ${escapeXml(nextLine(s))}</div>
      <div class="sc-foot"><span>${escapeXml(last)}</span>${sparkSVG(s.week || [0, 0, 0, 0, 0, 0, 0], col)}</div>
    </div>
    <div class="sc-glyph">${creatureSVG(skillGlyph(s), 46)}</div>
    <div class="sc-bar"><i style="width:${Math.round(s.pct * 100)}%"></i></div></button>`;
}
let shownTotal = null; // count up only after a real level-up, never on first view
function sec_skills() {
  const sk = latest.skills;
  if (!sk) return server.old ? `<div class="panel"><h2>Skills need the newer server</h2><p class="p-desc">This page is newer than the Proof of Life server that is running. Restart the server (stop it, then run <code>node server.js</code> in the proof-of-life folder) and your skills compute from every creature you already have.</p></div>` : `<p class="empty">Run some agents and your skills will start filling in.</p>`;
  if (!latest.creatures.length) return `<p class="empty">Run some agents and your skills will start filling in.</p>`;
  const live = sk.list.filter((s) => !isLocked(s)), top = live.slice().sort((a, b) => b.xp - a.xp)[0] || sk.list[0];
  const fbNext = TOTAL_BANDS_FB.find(([from]) => from > sk.totalLevel), fbCur = TOTAL_BANDS_FB.filter(([from]) => from <= sk.totalLevel).pop();
  const nb = sk.nextTotalBand !== undefined ? sk.nextTotalBand : fbNext ? { from: fbNext[0], name: fbNext[1] } : null, cbFrom = sk.totalBand.from != null ? sk.totalBand.from : fbCur[0];
  const tpct = nb ? (sk.totalLevel - cbFrom) / (nb.from - cbFrom) : 1;
  const sig = skillGlyph(top, 'sig');
  const hero = `<div class="sk-hero">
    <div class="panel tinted sk-total">
      <span class="eyebrow">Total level</span>
      <div class="tl-row"><b class="tl-num" id="tlnum" data-to="${sk.totalLevel}">${fmtN(shownTotal != null && shownTotal !== sk.totalLevel ? shownTotal : sk.totalLevel)}</b><span class="tl-max">/ ${fmtN(sk.maxTotalLevel)}</span><span class="band-chip big">${escapeXml(sk.totalBand.name)}</span></div>
      <div class="tl-bar"><i style="width:${Math.round(tpct * 100)}%"></i></div>
      <div class="note">${nb ? `${fmtN(nb.from - sk.totalLevel)} levels to ${nb.name} (${fmtN(nb.from)})` : 'Top band reached'} · ${fmtN(sk.totalXp)} xp · ${live.length} of ${sk.list.length} skills active</div>
      <p class="note" style="margin-top:12px">Every run pours experience into the skills it exercised. Levels run 1 to ${maxLevel()} (Ascendant from 100, Apex at ${maxLevel()}), with prestige stars past that. Runs from before activity tracking count toward the skill of their species. A run counts at most 4 hours of length, so a session left open cannot inflate a skill.</p>
    </div>
    <div class="panel sk-sig" style="--band:${top.band.color}">
      <div class="sig-art">${creatureSVG(sig, 190, { live: true })}</div>
      <div><span class="eyebrow">Signature skill</span><h2>${escapeXml(top.name)}</h2>
        <div class="chips"><span class="band-chip" style="color:${top.band.color}">${escapeXml(top.title)}</span><span class="trait">Lv ${top.level}</span>${top.stars ? `<span class="trait stars">${'★'.repeat(top.stars)}</span>` : ''}</div>
        <div class="note" style="margin-top:8px">${plural(top.creatures, 'run')} · ${fmtN(top.xp)} xp · next: ${escapeXml(nextLine(top))}</div>
        <div class="btns left"><button class="primary" id="skcard" data-skill="${top.key}">Save skill card</button></div></div>
    </div></div>`;
  const ms = (sk.milestones || []).slice(0, 14);
  const miles = ms.length ? `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Milestones</h2><span class="note">replayed from your real runs</span></div><div class="miles-wrap at-start"><button type="button" class="mscroll prev" data-ms="-1" aria-label="earlier milestones">‹</button><div class="miles" id="miles">${ms.map((m) => `<div class="mile ${m.creatureId ? 'link-c' : ''}" ${m.creatureId ? `data-id="${escapeXml(m.creatureId)}"` : ''} style="--mc:${m.color || (m.kind === 'legendary' ? '#f5c451' : m.kind === 'mythic' ? '#ff7bd0' : m.kind === 'shiny' ? '#7bf0ff' : m.kind === 'streak' ? '#ff9a3d' : m.kind === 'total' ? '#b28dff' : '#67a8f0')}"><i></i><b>${escapeXml(m.text)}</b><span>${shortDate(m.at)}</span></div>`).join('')}</div><button type="button" class="mscroll next" data-ms="1" aria-label="more milestones">›</button></div></div>` : '';
  // the band ladder: every band by name and level, how many of your skills sit in it, your signature skill's band lit
  const bands = sk.bands || [['novice', 'Novice', 1, '#8b90a0'], ['apprentice', 'Apprentice', 10, '#7ddc6a'], ['journeyman', 'Journeyman', 20, '#2fd3b5'], ['adept', 'Adept', 30, '#4aa8ff'], ['expert', 'Expert', 40, '#7f7cff'], ['master', 'Master', 50, '#c06cff'], ['grandmaster', 'Grandmaster', 60, '#ff5fb4'], ['virtuoso', 'Virtuoso', 70, '#ff6a5c'], ['luminary', 'Luminary', 80, '#ff9a2e'], ['paragon', 'Paragon', 90, '#ff8ad8'], ['ascendant', 'Ascendant', 100, '#ffe3a0'], ['transcendent', 'Transcendent', 110, '#9ff3ff'], ['apex', 'Apex', 120, '#ffffff']].map(([key, name, from, color]) => ({ key, name, from, color }));
  const inBand = {}; live.forEach((s) => (inBand[s.band.key] = (inBand[s.band.key] || 0) + 1));
  const bandKey = `<div class="band-ladder">${bands.map((b) => { const n = inBand[b.key] || 0, cur = b.key === top.band.key; return `<div class="bl ${n ? 'has' : ''} ${cur ? 'cur' : ''}" style="--c:${b.color}" title="${escapeXml(b.name)}: from Lv ${b.from}${n ? ` · ${plural(n, 'of your skills', 'of your skills')} here` : ''}"><i></i><b>${escapeXml(b.name)}</b><span>Lv ${b.from}${n ? ` · <em>${n}</em>` : ''}</span></div>`; }).join('')}</div>`;
  const groups = ['work', 'craft', 'habits', 'style'].map((g) => { const list = sk.list.filter((s) => s.group === g); if (!list.length) return ''; const lockedN = list.filter(isLocked).length; return `<div class="sk-group"><div class="sk-ghead"><h2>${GROUP_INFO[g][0]}</h2><span class="note">${GROUP_INFO[g][1]}${lockedN ? ` · ${lockedN} locked` : ''}</span></div><div class="skill-grid">${list.slice().sort((a, b) => (isLocked(a) ? 1 : 0) - (isLocked(b) ? 1 : 0)).map(skillCard).join('')}</div></div>`; }).join('');
  return hero + miles + `<div class="panel band-legend"><div class="p-head"><h2>Bands</h2><span class="note">every skill climbs the same ladder · lit: bands your skills are in · ringed: your signature skill</span></div>${bandKey}</div>` + groups;
}
function openSkill(key) {
  const s = latest.skills && latest.skills.list.find((x) => x.key === key); if (!s) return;
  s.locked = isLocked(s);
  const rows = (s.top || []).map((t) => { const c = findCreature(t.creatureId); return c ? `<div class="contrib" data-id="${escapeXml(c.id)}">${creatureSVG(c, 44)}<div><b>${escapeXml(c.fullName)}</b><span>${c.rarity.tier} · ${escapeXml(c.durationLabel)} · ${shortDate(c.bornAt)}</span></div><em>+${fmtN(t.xp)}</em></div>` : ''; }).join('');
  const ring = s.locked ? `<div class="lockring">${LOCK}</div>` : ringSVG(120, s.pct, s.band, `<text x="60" y="70" text-anchor="middle" class="ring-n big">${s.level}</text>`, { sw: 8 });
  const info = s.locked
    ? `<div class="rows"><div class="row"><span>signal</span><span>${escapeXml(s.signal || '')}</span></div></div><div class="unlock-box"><b>How to unlock</b><span>${escapeXml(s.unlock || '')}</span></div>`
    : `<div class="rows"><div class="row"><span>experience</span><span>${fmtN(s.xp)} xp</span></div><div class="row"><span>runs that fed it</span><span>${fmtN(s.creatures)}</span></div><div class="row"><span>next band</span><span>${escapeXml(nextLine(s))}</span></div>${s.level < maxLevel() ? `<div class="row"><span>to Lv ${s.level + 1}</span><span>${fmtN(s.toNext)} xp</span></div>` : ''}<div class="row"><span>signal</span><span>${escapeXml(s.signal || '')}</span></div>${s.fact ? `<div class="row"><span>record</span><span>${escapeXml(s.fact)}</span></div>` : ''}${s.legacyXp ? `<div class="row"><span>from runs before tracking</span><span>${fmtN(s.legacyXp)} xp</span></div>` : ''}</div>`;
  document.getElementById('modal-card').innerHTML = `<div class="sk-modal" style="--band:${s.locked ? '#5c6276' : s.band.color}">${ring}
    <h3>${escapeXml(s.name)}</h3><div class="chips" style="justify-content:center"><span class="band-chip" style="color:${s.locked ? '#9aa0b4' : s.band.color}">${s.locked ? 'Locked' : escapeXml(s.title)}</span>${s.stars ? `<span class="trait stars">${'★'.repeat(s.stars)}</span>` : ''}</div>
    ${info}
    ${rows ? `<span class="eyebrow">Top contributing runs</span><div class="contribs">${rows}</div>` : s.locked ? '' : `<p class="note">${s.group === 'habits' ? 'Daily habits are computed across days, not single runs.' : 'Computed across your runs.'}</p>`}
    <div class="btns">${s.locked ? '' : '<button class="primary" id="skdl">Save skill card</button>'}<button id="close">Close</button></div></div>`;
  document.getElementById('modal').hidden = false;
  document.getElementById('close').onclick = closeModal;
  const dl = document.getElementById('skdl'); if (dl) dl.onclick = () => downloadSkillCard(s);
  document.querySelectorAll('#modal-card .contrib[data-id]').forEach((el) => el.addEventListener('click', () => openModal(findCreature(el.dataset.id))));
}

// ---- section: board (a weekly race; personal records when you are alone) ----
let boardSamples = false;
function recordsHTML() {
  const en = latest.engagement, r = en && en.records; if (!r) return '';
  const lr = r.longestRun ? findCreature(r.longestRun.creatureId) : null, ms = r.mostSubagents ? findCreature(r.mostSubagents.creatureId) : null;
  // the same ranking the server uses for stats.rarest (variants.js)
  const rarestC = (latest.stats && latest.stats.rarest && latest.stats.rarest.id && findCreature(latest.stats.rarest.id)) || latest.creatures.filter((c) => !c.bredBy && !isOpenRun(c)).sort(byRarest)[0];
  const wkPct = r.bestWeek && r.bestWeek.points ? Math.min(1, (r.thisWeek || 0) / r.bestWeek.points) : 0;
  const card = (label, val, sub, c) => `<div class="rec ${c ? 'link-c' : ''}" ${c ? `data-id="${escapeXml(c.id)}"` : ''}>${c ? creatureSVG(c, 58, { crop: true }) : ''}<div><span class="eyebrow">${label}</span><b class="num">${val}</b><span>${sub}</span></div></div>`;
  return `<div class="panel tinted"><div class="p-head"><h2>Personal records</h2><span class="note">from your signed runs</span></div>
    <div class="wk-race"><div><span class="eyebrow" style="display:block">This week</span><b class="num big">${fmtN(r.thisWeek || 0)}</b><span class="of"> points</span></div><div class="wk-track"><i style="width:${(wkPct * 100).toFixed(1)}%"></i></div><div class="note">${r.bestWeek ? `Your best week: ${fmtN(r.bestWeek.points)} points, ${dayLabel(r.bestWeek.from)} to ${dayLabel(r.bestWeek.to)} (${plural(r.bestWeek.runs, 'run')}). ${wkPct >= 1 ? 'You are beating it.' : `${fmtN(r.bestWeek.points - (r.thisWeek || 0))} to go.`}` : ''}</div></div>
    <div class="recs">
      ${r.bestDay ? card('Best day', fmtN(r.bestDay.points) + ' pts', `${dayLabel(r.bestDay.day)} · ${plural(r.bestDay.runs, 'run')} · ${fmtN(r.bestDay.minutes)} machine-min`) : ''}
      ${card('Longest streak', plural(r.bestStreak || 0, 'day'), `now ${plural(en.streak || 0, 'day')}`)}
      ${lr ? card('Longest run', escapeXml(r.longestRun.durationLabel), escapeXml(lr.fullName), lr) : ''}
      ${ms ? card('Most subagents', fmtN(r.mostSubagents.subagents), escapeXml(ms.fullName), ms) : ''}
      ${r.bestCleanStreak != null ? card('Clean streak', plural(r.bestCleanStreak, 'run'), 'no failed tool call') : ''}
      ${hasPower(latest.me) ? card('Power', fmtN(latest.me.score), 'all-time points, never resets') : ''}
      ${rarestC ? card('Rarest hatch', (variantOf(rarestC) && variantOf(rarestC).shiny ? 'Shiny ' : '') + rarestC.rarity.tier, escapeXml(rarestC.fullName + ' · ' + ((variantOf(rarestC) || { name: '' }).name)), rarestC) : ''}
    </div></div>`;
}
// you vs your best week: cumulative points per local day (server: records.lastDays and bestWeek.days)
function raceHTML() {
  const en = latest.engagement, r = en && en.records; if (!r || !r.lastDays || !r.bestWeek || !r.bestWeek.days) return '';
  const cum = (a) => a.reduce((o, v) => (o.push((o.length ? o[o.length - 1] : 0) + v), o), []);
  const me = cum(r.lastDays), best = cum(r.bestWeek.days), mx = Math.max(1, me[6], best[6]);
  const W = 560, H = 210, L = 46, Rr = 16, T = 16, B = 34, xw = (W - L - Rr) / 6, X = (i) => L + i * xw, Y = (v) => T + (H - T - B) * (1 - v / mx);
  const line = (a) => a.map((v, i) => `${i ? 'L' : 'M'}${F(X(i))} ${F(Y(v))}`).join('');
  const area = (a) => line(a) + `L${F(X(6))} ${F(Y(0))}L${F(X(0))} ${F(Y(0))}Z`;
  const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], t = new Date().getDay();
  const ticks = [0, 0.5, 1].map((k) => Math.round(mx * k));
  const ahead = me[6] - best[6];
  const svg = `<svg class="race" viewBox="0 0 ${W} ${H}" role="img" aria-label="points this week against your best week">
    <defs><linearGradient id="race-me" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6ee7a5" stop-opacity=".35"/><stop offset="1" stop-color="#6ee7a5" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((v) => `<path d="M${L} ${F(Y(v))}H${W - Rr}" stroke="#262935" stroke-width="1"/><text x="${L - 8}" y="${F(Y(v) + 4)}" text-anchor="end" class="rt">${fmtN(v)}</text>`).join('')}
    <path d="${area(me)}" fill="url(#race-me)"/>
    <path d="${line(best)}" fill="none" stroke="#f5c451" stroke-width="2.4" stroke-dasharray="6 5" stroke-linejoin="round"/>
    <path d="${line(me)}" fill="none" stroke="#6ee7a5" stroke-width="3" stroke-linejoin="round"/>
    ${me.map((v, i) => `<circle cx="${F(X(i))}" cy="${F(Y(v))}" r="${i === 6 ? 5 : 3}" fill="#6ee7a5"${i === 6 ? ' stroke="#0b0c11" stroke-width="2"' : ''}/>`).join('')}
    <circle cx="${F(X(6))}" cy="${F(Y(best[6]))}" r="4" fill="#f5c451"/>
    ${me.map((_, i) => `<text x="${F(X(i))}" y="${H - 12}" text-anchor="middle" class="rt${i === 6 ? ' now' : ''}">${i === 6 ? 'Today' : dn[(t - 6 + i + 14) % 7]}</text>`).join('')}
  </svg>`;
  return `<div class="panel race-p"><div class="p-head"><h2>You vs your best week</h2><span class="note">points per day, added up</span></div>
    <div class="race-key"><span><i style="background:#6ee7a5"></i>Last 7 days · <b class="num">${fmtN(me[6])}</b></span><span><i class="dash"></i>Best week · <b class="num">${fmtN(best[6])}</b> <em>${dayLabel(r.bestWeek.from)} to ${dayLabel(r.bestWeek.to)}</em></span></div>
    ${svg}<p class="note">${ahead >= 0 ? `You are ${fmtN(ahead)} points ahead of your best week.` : `${fmtN(-ahead)} points behind your best week, with today still running.`}</p></div>`;
}
// this week's podium: your three rarest hatches of the last 7 days
function podiumHTML() {
  const wk = latest.creatures.filter((c) => !c.bredBy && !isOpenRun(c) && c.bornAt >= Date.now() - 7 * 86400000).sort(byRarest).slice(0, 3);
  if (!wk.length) return `<div class="panel podium-p"><div class="p-head"><h2>This week's podium</h2></div><p class="note">Nothing hatched in the last 7 days. Your next run takes first place.</p></div>`;
  const order = [wk[1], wk[0], wk[2]], place = [2, 1, 3];
  // each creature stands on its own stepped plinth (gold, silver, bronze); its short name and real run time sit under it
  const pod = (c, p) => `<div class="pod p${p} link-c" data-id="${escapeXml(c.id)}" style="--tier:${c.rarity.chip}" title="${escapeXml(c.fullName)}">
    <div class="pod-art">${creatureSVG(c, p === 1 ? 142 : 112, { crop: true, bare: true, live: p === 1 })}</div>
    <div class="plinth"><i class="cap"></i><div class="face"><em>${p}</em></div></div>
    <b>${escapeXml(shortName(c))}</b><span><span style="color:${c.rarity.chip}">${(variantOf(c) && variantOf(c).shiny ? 'Shiny ' : '') + c.rarity.tier}</span> · ${escapeXml(c.durationLabel || '')} run</span></div>`;
  return `<div class="panel podium-p"><div class="p-head"><h2>This week's podium</h2><span class="note">your rarest hatches of the last 7 days</span></div><div class="podium">${order.map((c, i) => (c ? pod(c, place[i]) : '<div class="pod empty"></div>')).join('')}</div></div>`;
}
function sec_board() {
  if (!boardData.length) return `<p class="empty">No operators with creatures yet.</p>`;
  const real = boardData.filter((r) => !r.sample).length;
  const lead = `<div class="section-lead">Standing is this week's points: every run adds points for what it got done (tool calls that worked, kinds of tools, files written, commits and pushes, minus failed calls), never for how long it ran. Power is the same points for all time, and it never resets. Neither can be bought.</div>`;
  const rows = boardData.map((r) => `<div class="brow ${r.you ? 'you' : ''}" data-handle="${escapeXml(r.handle)}">
    <div class="rank">${r.rank}</div><div class="ava" style="background:${r.accent || '#67e39a'}">${initials(r.handle)}</div>
    <div class="who"><div class="who-top"><b>@${escapeXml(r.handle)}</b>${r.you ? '<span class="chip" style="color:var(--green)">you</span>' : r.sample ? '<span class="chip" style="color:var(--violet)">sample</span>' : ''}</div><span>${plural(r.runs, 'run')} · ${Number(r.hours || 0).toFixed(1)} hrs · ${escapeXml(r.topSpecies || '—')}</span></div>
    <div class="surv">${hasPower(r) ? fmtN(r.score || 0) : '—'}<span>power</span></div>
    <div class="score" style="color:${r.you ? 'var(--green)' : 'var(--ink)'}">${hasPower(r) ? fmtN(r.week) : '—'}<span>this week</span></div></div>`).join('');
  const note = boardSamples ? 'Rows marked sample are generated operators, shown because the server runs with --samples. They are not real people.' : real <= 1 ? 'Only operators on this server appear here. Right now that is just you, so the race is against your own records.' : 'Every row is an operator on this server.';
  const week = `<div class="grid cols-2 race-row">${raceHTML() || ''}${podiumHTML()}</div>`;
  // alone on this server: the race is against your own best week, no lonely one-row table
  if (real <= 1 && !boardSamples) return lead + week + `<div style="margin-top:16px">${recordsHTML()}</div><p class="note">${note}</p>`;
  return lead + `<div class="board">${rows}</div><p class="note">${note}</p>${week}<div style="margin-top:16px">${recordsHTML()}</div>`;
}

// ---- cross-feed breeding (a panel inside the Dex) ----
function crossfeedPanel() {
  const ops = (bestiaryData && bestiaryData.operators) || [];
  if (ops.length < 2) return `<div class="cf-empty">${creatureSVG(Object.assign(demoCreature('cf-wait', 'moth', 'Mythic', { salt: 'cf', level: 15 }), { parents: ['Moth', 'Prism'] }), 110)}<p class="note">Breeding needs two operators whose real, signed work landed in the same domain, and it always makes a Mythic. ${ops.length ? 'You are the only operator here so far.' : 'No operators have creatures yet.'} When a second operator joins this server, hybrids appear here on their own.</p></div>`;
  const opt = (sel) => ops.map((o) => `<option value="${escapeXml(o.handle)}" ${o.handle === sel ? 'selected' : ''}>@${escapeXml(o.handle)}${o.you ? ' (you)' : o.sample ? ' (sample)' : ''}</option>`).join('');
  const r = cfState.result;
  let out;
  if (r && r.creature) {
    const c = r.creature;
    out = `${creatureSVG(c, 104, { live: true })}<div class="nm" style="font-family:var(--serif);margin-top:4px">${escapeXml(c.fullName)}</div><span class="rchip" style="color:${c.rarity.chip};position:static;display:inline-block;margin-top:6px">${c.rarity.tier}</span><div class="note" style="margin-top:6px">${escapeXml(c.speciesName)}<br>bred from ${escapeXml(r.domain)} work</div>`;
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

// ---- section: lounge (open only while an agent is really running) ----
// the room itself: one SVG (wall, wainscot, fireplace, window, sconces, plank floor and rug), lit while agents run
function loungeRoomSVG(open) {
  const W = 1000, H = 470, FY = 330, r = mulberry32(4855);
  const warm = open ? 1 : 0;
  let planks = ''; for (let i = -14; i <= 14; i++) planks += `M${500 + i * 22} ${FY}L${500 + i * 120} ${H}`;
  let rows = ''; for (const y of [346, 366, 392, 424, 462]) rows += `M0 ${y}H${W}`;
  let panels = ''; for (let x = 20; x < W; x += 140) panels += `<rect x="${x}" y="256" width="110" height="58" rx="4" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2"/><rect x="${x + 1}" y="257" width="110" height="58" rx="4" fill="none" stroke="#fff" stroke-opacity=".05"/>`;
  let stars = ''; for (let i = 0; i < 14; i++) stars += `<circle cx="${F(786 + r() * 118)}" cy="${F(96 + r() * 140)}" r="${F(0.6 + r() * 1.2)}" fill="#fff" opacity="${F(0.4 + r() * 0.6)}"/>`;
  let stones = ''; for (let y = 182; y < 326; y += 18) { const off = ((y - 182) / 18) % 2 ? 22 : 0; for (let x = 66 + off; x < 246; x += 44) stones += `<rect x="${x}" y="${y}" width="${Math.min(40, 246 - x)}" height="15" rx="3"/>`; }
  const flame = (x, h, d) => `<path class="ls-flame" style="animation-delay:${d}s" d="M${x} 318C${x - 16} 300 ${x - 10} ${318 - h * 0.6} ${x} ${318 - h}C${x + 4} ${318 - h * 0.62} ${x + 16} ${318 - h * 0.5} ${x + 12} 304C${x + 10} 312 ${x + 6} 318 ${x} 318Z" fill="url(#lr-fire)"/>`;
  const candle = (x, y, h) => `<rect x="${x - 4}" y="${y - h}" width="8" height="${h}" rx="2" fill="#efe3c6"/><rect x="${x - 4}" y="${y - h}" width="3" height="${h}" rx="1.5" fill="#fff" opacity=".5"/>` + (open ? `<path class="ls-flame" d="M${x} ${y - h - 11}C${x + 4} ${y - h - 5} ${x + 4} ${y - h - 1} ${x} ${y - h - 1}C${x - 4} ${y - h - 1} ${x - 4} ${y - h - 5} ${x} ${y - h - 11}Z" fill="#ffd27a"/>` : `<path d="M${x} ${y - h}v-4" stroke="#2a2a2a" stroke-width="1.4"/>`);
  const sconce = (x) => `${open ? `<circle class="ls-halo" cx="${x}" cy="128" r="70" fill="url(#lr-halo)"/>` : ''}<path d="M${x - 14} 162H${x + 14}L${x + 8} 172H${x - 8}Z" fill="#7a5a2a" stroke="#3a260e" stroke-width="2"/><path d="M${x} 172V186" stroke="#3a260e" stroke-width="4" stroke-linecap="round"/><circle cx="${x}" cy="190" r="6" fill="#7a5a2a" stroke="#3a260e" stroke-width="2"/>${candle(x, 162, 22)}`;
  return `<svg class="ls-room" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs>
    <linearGradient id="lr-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${open ? '#2e1e12' : '#171a25'}"/><stop offset="1" stop-color="${open ? '#1d130b' : '#0f1118'}"/></linearGradient>
    <radialGradient id="lr-warm" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#ffb35c" stop-opacity="${0.22 * warm}"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
    <linearGradient id="lr-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${open ? '#3a2412' : '#1a1b22'}"/><stop offset="1" stop-color="${open ? '#170d06' : '#0a0b0f'}"/></linearGradient>
    <linearGradient id="lr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#091233"/><stop offset="1" stop-color="#26346a"/></linearGradient>
    <linearGradient id="lr-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1f"/><stop offset=".55" stop-color="#ffb23d"/><stop offset="1" stop-color="#fff2b8"/></linearGradient>
    <radialGradient id="lr-halo"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".42"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
    <radialGradient id="lr-hearth" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="#ff9a3d" stop-opacity="${0.35 * warm}"/><stop offset="1" stop-color="#ff9a3d" stop-opacity="0"/></radialGradient>
    <clipPath id="lr-glass"><path d="M784 240V146A61 61 0 0 1 906 146V240Z"/></clipPath>
    <clipPath id="lr-fl"><rect x="0" y="${FY}" width="${W}" height="${H - FY}"/></clipPath></defs>
    <rect width="${W}" height="${FY}" fill="url(#lr-wall)"/><rect width="${W}" height="${FY}" fill="url(#lr-warm)"/>
    <rect y="240" width="${W}" height="${FY - 240}" fill="#000" opacity=".22"/><rect y="238" width="${W}" height="6" fill="${open ? '#5a3a1e' : '#2a2c38'}"/>${panels}
    <rect y="${FY - 8}" width="${W}" height="8" fill="${open ? '#4a2e16' : '#22242e'}"/>
    <rect y="${FY}" width="${W}" height="${H - FY}" fill="url(#lr-floor)"/>
    <g clip-path="url(#lr-fl)" stroke="#000" stroke-opacity=".3" stroke-width="2" fill="none"><path d="${planks}"/><path d="${rows}" stroke-opacity=".18"/></g>
    <polygon points="790,${FY} 900,${FY} 980,${H} 820,${H}" fill="#9fb4ff" opacity="${open ? 0.05 : 0.09}"/>
    <ellipse cx="155" cy="${FY + 4}" rx="190" ry="60" fill="url(#lr-hearth)"/>
    <ellipse cx="500" cy="414" rx="350" ry="48" fill="#000" opacity=".35"/><ellipse cx="500" cy="408" rx="344" ry="46" fill="${open ? '#5c1f22' : '#2a1618'}"/><ellipse cx="500" cy="408" rx="318" ry="38" fill="none" stroke="${open ? '#c9a25a' : '#5a4a32'}" stroke-width="2.5" stroke-dasharray="10 6" opacity=".7"/><ellipse cx="500" cy="408" rx="270" ry="29" fill="${open ? '#6e2a2a' : '#301a1c'}"/>
    <g><rect x="46" y="158" width="218" height="14" rx="3" fill="#5a3a1e" stroke="#2a1a0c" stroke-width="2"/><rect x="50" y="159" width="210" height="3" fill="#fff" opacity=".12"/>
      <path d="M60 172H250V${FY}H60Z" fill="#3e3128"/><g fill="#4d3e33" stroke="#2a2019" stroke-width="1.5">${stones}</g>
      <path d="M95 ${FY}V262Q155 210 215 262V${FY}Z" fill="#0d0805" stroke="#2a2019" stroke-width="3"/>
      ${open ? `<ellipse cx="155" cy="300" rx="70" ry="44" fill="#ff7a2a" opacity=".22"/>${flame(132, 52, -0.3)}${flame(156, 70, 0)}${flame(178, 48, -0.6)}` : `<ellipse cx="155" cy="318" rx="44" ry="8" fill="#ff5a1f" opacity=".28"/>`}
      <rect x="112" y="314" width="88" height="12" rx="6" fill="#4a2a14" stroke="#24140a" stroke-width="2"/><rect x="122" y="306" width="70" height="11" rx="5.5" fill="#5a3418" stroke="#24140a" stroke-width="2" transform="rotate(-6 157 311)"/>
      ${candle(78, 158, 18)}${candle(96, 158, 12)}<circle cx="226" cy="140" r="15" fill="#c9a25a" stroke="#4a3208" stroke-width="2.5"/><circle cx="226" cy="140" r="11" fill="#f4ecd6"/><path d="M226 140V132M226 140L232 143" stroke="#2a1a0c" stroke-width="1.8" stroke-linecap="round"/><rect x="214" y="153" width="24" height="6" rx="2" fill="#c9a25a"/></g>
    <g><path d="M748 54Q760 160 742 268L774 268Q788 160 778 54Z" fill="${open ? '#5a1e22' : '#2a1416'}"/><path d="M942 54Q930 160 948 268L916 268Q902 160 912 54Z" fill="${open ? '#5a1e22' : '#2a1416'}"/>
      <path d="M770 252V144A75 75 0 0 1 920 144V252Z" fill="#3a2716" stroke="#1e130a" stroke-width="3"/>
      <path d="M784 240V146A61 61 0 0 1 906 146V240Z" fill="url(#lr-sky)"/>
      <g clip-path="url(#lr-glass)">${stars}<circle cx="872" cy="124" r="15" fill="#f6efcf"/><circle cx="879" cy="119" r="13" fill="#132050"/></g>
      <path d="M845 88V240M784 176H906" stroke="#3a2716" stroke-width="6"/><rect x="760" y="248" width="170" height="10" rx="3" fill="#4a3220" stroke="#1e130a" stroke-width="2"/>
      <rect x="740" y="48" width="210" height="9" rx="4.5" fill="#6b4a22"/></g>
    ${sconce(330)}${sconce(670)}
  </svg>`;
}
function sec_antechamber() {
  const open = latest.eggs.length > 0;
  const conc = demoCreature('The Concierge', 'scholar', 'Legendary', { salt: 'concierge', level: 40, vo: { colorway: 'classic', expression: 'smug', accessory: null, material: 'gold' } });
  const hour = new Date().getHours();
  const part = hour < 5 ? 'These are the deep hours. Only the devoted are still running.' : hour < 12 ? 'Good morning. The machines are just waking.' : hour < 18 ? 'Good afternoon. A steady day of work behind you.' : 'Good evening. The fire is lit and the seats are warm.';
  const top = latest.me && latest.me.topSpecies && latest.me.topSpecies !== '—' ? `Mostly ${latest.me.topSpecies.toLowerCase()} work, I see.` : '';
  const line = open ? `${part} ${latest.eggs.length === 1 ? 'One egg is' : plural(latest.eggs.length, 'egg') + ' are'} warming by the fire. ${top} Sit, the usual seat.` : `${part} Your agents are resting, so the fire is down to embers. Come back mid-run and the room comes alive.`;
  const night = latest.creatures.filter((c) => (c.traits || []).includes('Nightshift'));
  const owl = latest.skills && latest.skills.list.find((s) => s.key === 'nightowl');
  // tonight's Nightshift hatchlings (the last 24 hours), or else the most recent night's, honestly labelled
  const recentNight = night.filter((c) => c.bornAt >= Date.now() - 86400000);
  const lastNightKey = night[0] ? new Date(night[0].bornAt).toDateString() : '';
  const guests = (recentNight.length ? recentNight : night.filter((c) => new Date(c.bornAt).toDateString() === lastNightKey)).slice(0, 6);
  const guestLabel = recentNight.length ? 'Tonight’s Nightshift' : guests.length ? `Nightshift from ${shortDate(guests[0].bornAt)}` : '';
  // the running eggs warm on the hearth, in front of the fire
  const eggs = latest.eggs.slice(0, 6).map((e, i) => { return `<div class="ls-egg e${i}" style="left:${9 + i * 6.4}%;--d:-${(hashString(String(e.id)) % 2000) / 1000}s" title="${escapeXml((DOMAIN_LABEL[e.domainKey] || 'General') + ' work · running')}">${eggSVG(hashString(String(e.id)), (ART_PAL[e.domainKey] || ART_PAL.wisp).glow, 46)}<span><b class="timer-lite" data-start="${Number(e.startedAt) || 0}">${fmtClock(Date.now() - Number(e.startedAt))}</b></span></div>`; }).join('');
  // guests stand on the rug, each keeping to its own lane on one side of Barnaby so nobody walks through him
  const walkers = guests.map((c, i) => { const r = mulberry32(hashString('walk:' + c.id)), k = Math.floor(i / 2), right = i % 2 === 1, a = 6 + k * 11 + r() * 3, b = a + 5 + r() * 4; const x0 = right ? 92 - b : a, x1 = right ? 92 - a : b; return `<div class="ls-walk w${i} ${open ? '' : 'asleep'} link-c" data-id="${escapeXml(c.id)}" style="--x0:${F(x0)}%;--x1:${F(x1)}%;--dur:${F(11 + r() * 9)}s;--dl:-${F(r() * 10)}s" title="${escapeXml(c.fullName)}"><div class="ls-flip">${creatureSVG(c, 76 - k * 6, { crop: true, bare: true })}</div></div>`; }).join('');
  const scene = `<div class="lounge-scene ${open ? 'open' : 'closed'}">
      ${loungeRoomSVG(open)}
      <div class="ls-tags"><div class="doorstate">${open ? '● the door is open' : '○ the door is closed'}</div>${guestLabel ? `<div class="ls-caption">${escapeXml(guestLabel)} · ${plural(guests.length, 'guest')} on the floor</div>` : ''}</div>
      <div class="ls-bubble">"${escapeXml(line.replace(/\s+/g, ' ').trim())}"</div>
      <div class="ls-host">${creatureSVG(conc, 196, { live: true, crop: true })}<div class="concierge-name">Barnaby, the Concierge</div></div>
      ${eggs}${walkers}
    </div>`;
  const book = night.slice(0, 8);
  const ledger = `<div class="panel lounge-ledger"><div class="ll-stats">
      <div><b>${fmtN(latest.eggs.length)}</b><span>${latest.eggs.length === 1 ? 'agent' : 'agents'} running now</span></div>
      <div><b>${latest.me && latest.me.week != null ? fmtN(latest.me.week) : '—'}</b><span>your points this week</span></div>
      <div><b>${fmtN(night.length)}</b><span>Nightshift creatures</span></div>
      ${owl ? `<div><b>Lv ${owl.level}</b><span>Night Owl · ${escapeXml(owl.title)}</span></div>` : ''}</div>
    ${latest.eggs.length ? `<div class="eggs" style="margin-top:14px">${latest.eggs.slice(0, 2).map(eggBox).join('')}</div>` : ''}
    <div class="p-head ll-head"><h2>The guest book</h2><span class="note">runs that finished between midnight and 5am</span></div>
    ${book.length ? `<div class="ll-guests">${book.map((c) => `<div class="guest link-c" data-id="${escapeXml(c.id)}" style="--tier:${c.rarity.chip}">${creatureSVG(c, 64, { crop: true })}<div><b>${escapeXml(shortName(c))}</b><span><span style="color:${c.rarity.chip}">${c.rarity.tier}</span> ${escapeXml(c.speciesName)}</span><span>${shortDate(c.bornAt)} · ${escapeXml(shortOrigin(c))}</span></div></div>`).join('')}</div>` : '<p class="note">No night runs yet. Run an agent after midnight and its creature signs the book.</p>'}</div>`;
  return `<div class="section-lead">Not a place to be productive. A candlelit room that comes alive only while your agents are really running. Barnaby keeps your running eggs warm, and the creatures your night runs hatched wander in.</div>
  ${scene}${ledger}`;
}

// ---- server build check: never let an older server quietly show empty panels ----
function bannerHTML() {
  if (server.old) return `<b>Restart your Proof of Life server.</b> This page is newer than the server that is running${server.info && server.info.build ? ` (build ${escapeXml(server.info.build)})` : ''}, so the ten new skills, levels past 99, your Power, the auto goal and personal records wait for a restart. Stop it, then run <code>node server.js</code> in the proof-of-life folder. Your creatures are safe in data/state.json.`;
  if (server.stale) return `<b>Restart your Proof of Life server to finish the update.</b> New code is on disk (build ${escapeXml(server.info.disk)}) but the running server is still build ${escapeXml(server.info.build)}. Stop it, then run <code>node server.js</code> in the proof-of-life folder.`;
  return '';
}
function showBanner() { const el = document.getElementById('banner'); if (!el) return; const h = bannerHTML(); el.hidden = !h; el.innerHTML = h; }
async function checkServer(st) {
  server.old = !st || st.api == null || st.api < APP_API || !st.skills || st.rev == null;
  if (!server.old && Date.now() - server.checkedAt > 60000) {
    server.checkedAt = Date.now();
    try { const r = await fetch('/api/version'); if (r.ok) { const had = JSON.stringify(server.info && server.info.telemetry); server.info = await r.json(); if (had !== JSON.stringify(server.info.telemetry) && (current === 'proof' || current === 'home') && document.getElementById('modal').hidden) renderActive(); server.stale = !!server.info.stale; if (server.info.api < APP_API) server.old = true; } else server.old = true; } catch {}
  }
  showBanner();
}

// ---- topbar + nav ----
function topRight() {
  const running = latest.eggs.length, en = latest.engagement;
  const streak = en && en.streak ? `<div class="pill streak-pill hide-sm" title="best ${en.bestStreak} days">${FLAME}<b>${en.streak}</b><span>day streak</span></div>` : '';
  const waiting = waitingEggs().length, dn = !running && recentDone().length;
  const live = waiting ? `<div class="pill wait" title="a run is waiting on you in the terminal"><span class="live"></span>${waiting > 1 ? waiting + ' runs need your input' : 'Needs your input'}</div>`
    : running ? `<div class="pill"><span class="live"></span>${running > 1 ? running + ' agents working' : 'Claude is working'}</div>`
    : dn ? '<div class="pill done"><span class="live"></span>Done</div>' : '<div class="pill idle"><span class="live"></span>idle</div>';
  return `${live}${streak}<div class="pill hide-sm"><b>${fmtN(latest.creatures.length)}</b> creatures</div>`;
}
let rendered = { key: null, sig: '' };
function renderActive() {
  const sec = SECTIONS.find((s) => s.key === current);
  document.getElementById('tb-eyebrow').textContent = sec.eyebrow || '';
  document.getElementById('tb-title').textContent = sec.title;
  document.getElementById('tb-right').innerHTML = topRight();
  const stage = document.getElementById('stage');
  if (artObs) artObs.disconnect();
  stage.innerHTML = sec.render();
  rendered = { key: current, sig: sectionSig() };
  stage.querySelectorAll('.mcard[data-id], .hcard[data-id], .link-c[data-id], .contrib[data-id], .dg-c[data-id], .ds-c[data-id], .dd-dot[data-id], .rec[data-id]').forEach(bindCreatureEl);
  stage.querySelectorAll('.brow[data-handle]').forEach((el) => el.addEventListener('click', () => openProfile(el.dataset.handle)));
  stage.querySelectorAll('.skill-card[data-skill]').forEach((el) => el.addEventListener('click', () => openSkill(el.dataset.skill)));
  stage.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => setSection(el.dataset.go)));
  stage.querySelectorAll('[data-dex]').forEach((el) => el.addEventListener('click', () => { dexOpen = dexOpen === el.dataset.dex ? null : el.dataset.dex; renderActive(); }));
  const cfa = stage.querySelector('#cfa'), cfb = stage.querySelector('#cfb');
  if (cfa) cfa.addEventListener('change', doCrossfeed);
  if (cfb) cfb.addEventListener('change', doCrossfeed);
  const wx = stage.querySelector('#wx'); if (wx) wx.onclick = () => { try { localStorage.setItem('pol_welcomed', '1'); } catch {} renderActive(); };
  const seeall = stage.querySelector('#seeall'); if (seeall) seeall.onclick = () => setSection('collection');
  const rp = stage.querySelector('#replay'); if (rp) rp.onclick = () => { sfx.unlock(); queueReveals([latest.creatures[0]], true); };
  const on = stage.querySelector('#opennew'); if (on) on.onclick = () => openModal(latest.creatures[0]);
  const sv = stage.querySelector('#savenew'); if (sv) sv.onclick = () => downloadCard(latest.creatures[0], 'portrait');
  const swk = stage.querySelector('#saveweek'); if (swk) swk.onclick = downloadWeekCard;
  stage.querySelectorAll('[data-tel]').forEach((b) => { b.onclick = () => setTelemetry(b.dataset.tel === 'on'); });
  const gs = stage.querySelector('#goalsel'); if (gs) gs.onchange = async () => { const [type, target] = gs.value.split(':'); try { await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: { type, target: Number(target) } }) }); } catch {} poll(true); };
  const skc = stage.querySelector('#skcard'); if (skc) skc.onclick = () => downloadSkillCard(latest.skills.list.find((s) => s.key === skc.dataset.skill));
  const recent = stage.querySelector('#recent'); if (recent) reconcile(recent, stripList(), (c) => tileHTML(c), tileKey);
  stage.querySelectorAll('[data-strip]').forEach((b) => b.addEventListener('click', () => { homeStrip = b.dataset.strip; try { localStorage.setItem('pol_strip', homeStrip); } catch {} renderActive(); }));
  if (current === 'collection') bindCollection(stage);
  const ml = stage.querySelector('#miles');
  if (ml) {
    const wrap = ml.parentElement, upd = () => { wrap.classList.toggle('at-start', ml.scrollLeft < 4); wrap.classList.toggle('at-end', ml.scrollLeft + ml.clientWidth >= ml.scrollWidth - 4); };
    ml.addEventListener('scroll', upd, { passive: true }); upd();
    wrap.querySelectorAll('[data-ms]').forEach((b) => b.addEventListener('click', () => ml.scrollBy({ left: Number(b.dataset.ms) * ml.clientWidth * 0.8, behavior: reduceMotion() ? 'auto' : 'smooth' })));
  }
  hydrateArt(stage);
  // total level counts up only after a real level-up seen in this tab
  const tl = stage.querySelector('#tlnum');
  if (tl) { const to = Number(tl.dataset.to); if (shownTotal != null && shownTotal !== to && !reduceMotion()) countUp(tl, shownTotal, to); shownTotal = to; }
  latest.creatures.forEach((c) => known.add(c.id));
}
// what each section shows, so a poll only redraws a section whose own data changed
function sectionSig() {
  const sk = latest.skills, en = latest.engagement;
  const lv = sk ? sk.list.map((s) => s.level + ':' + (s.locked ? 0 : 1)).join() : '';
  const top = latest.creatures[0] ? latest.creatures[0].id + ':' + latest.creatures[0].level : '';
  switch (current) {
    case 'home': return [latest.creatures.length, top, latest.eggs.map((e) => e.id + ':' + (e.subagents || 0) + ':' + (e.status || '')).join(), recentDone().map((d) => d.id).join(), en && en.goal ? en.goal.progress + ':' + en.goal.target + ':' + en.goal.auto : '', en ? en.streak : '', lv, latest.me ? latest.me.score : ''].join('|');
    case 'skills': return [lv, sk ? sk.totalXp : '', sk ? (sk.milestones || []).length : ''].join('|');
    case 'board': return [boardData.map((r) => r.handle + r.week + ':' + r.score).join(), en && en.records ? en.records.thisWeek + ':' + (en.records.lastDays || []).join(',') : '', latest.creatures.length].join('|');
    case 'bestiary': return [latest.creatures.length, top, bestiaryData ? bestiaryData.network.breeds : 0, dexOpen].join('|');
    case 'lounge': return [latest.eggs.map((e) => e.id).join(), latest.me ? latest.me.week : '', latest.creatures.length].join('|');
    case 'proof': return [latest.creatures.length, pubInfo ? 1 : 0, latest.me ? latest.me.score : ''].join('|');
    default: return String(latest.rev);
  }
}
const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el, from, to) {
  const t0 = performance.now(), dur = 1100;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtN(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); else el.classList.add('bump'); };
  requestAnimationFrame(step);
}
// art slots are filled only when they come near the viewport (and the markup is cached by look)
let artObs = null;
function hydrateArt(root) {
  const fill = (el) => { if (!el.isConnected || !el.dataset.art) return; const c = findCreature(el.dataset.art); el.removeAttribute('data-art'); if (c) el.outerHTML = creatureVisual(c, 128, { crop: true }); };
  const slots = root.querySelectorAll('.art-slot[data-art]');
  if (!slots.length) return;
  if (typeof IntersectionObserver === 'undefined') { slots.forEach(fill); return; }
  if (!artObs) artObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { artObs.unobserve(e.target); fill(e.target); } }), { rootMargin: '600px 0px' });
  slots.forEach((el) => artObs.observe(el));
}
const HASH_ALIAS = { antechamber: 'lounge', shelf: 'collection', how: 'proof', dex: 'bestiary' };
function setSection(key, fromHash) {
  key = HASH_ALIAS[key] || key;
  if (!SECTIONS.find((s) => s.key === key)) key = 'home';
  current = key;
  if (!PRIMARY_KEYS.includes(key) && !isPhone()) moreOpen = true; // reveal the More group if landing on an advanced page
  if (isPhone()) moreOpen = false;
  buildRail();
  if (!fromHash && location.hash.replace('#', '') !== key) location.hash = key; // a real history entry, so Back works
  renderActive();
  if (!fromHash) window.scrollTo(0, 0);
}
const isPhone = () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 720px)').matches;
function buildRail() {
  const item = (s) => `<button class="rbtn ${s.key === current ? 'active' : ''}" data-key="${s.key}" aria-label="${s.label}">${s.icon}<span class="rlabel">${s.label}</span><span class="tlabel">${s.short}</span></button>`;
  const primary = SECTIONS.filter((s) => PRIMARY_KEYS.includes(s.key)).map(item).join('');
  const advanced = SECTIONS.filter((s) => !PRIMARY_KEYS.includes(s.key)).map(item).join('');
  const moreActive = !PRIMARY_KEYS.includes(current);
  document.getElementById('rail').innerHTML = primary +
    `<button class="more-toggle ${moreActive ? 'active' : ''}" id="moreToggle" aria-expanded="${moreOpen ? 'true' : 'false'}">${IC.more}<span class="rlabel">More <span class="chev">${moreOpen ? '▴' : '▾'}</span></span><span class="tlabel">More</span></button>` +
    `<div class="more-items" ${moreOpen ? '' : 'hidden'}>${advanced}<button class="rbtn sound-m" id="soundm">${sfx.on ? IC.soundOn : IC.soundOff}<span class="rlabel">Sound ${sfx.on ? 'on' : 'off'}</span><span class="tlabel">Sound ${sfx.on ? 'on' : 'off'}</span></button></div>`;
  document.querySelectorAll('.rbtn[data-key]').forEach((b) => b.addEventListener('click', () => { moreOpen = isPhone() ? false : moreOpen; setSection(b.dataset.key); }));
  document.getElementById('moreToggle').addEventListener('click', (e) => { e.stopPropagation(); moreOpen = !moreOpen; buildRail(); });
  const sm = document.getElementById('soundm'); if (sm) sm.addEventListener('click', () => sfx.toggle());
  document.getElementById('mark').innerHTML = creatureSVG(demoCreature('mark', 'hydra', 'Epic', { salt: 'mk', level: 15, vo: { colorway: 'classic', expression: 'grin', accessory: null, pattern: null } }), 32) + '<span class="mark-txt">Proof of Life</span>';
  const st = document.getElementById('sound');
  if (st) { st.innerHTML = (sfx.on ? IC.soundOn : IC.soundOff) + `<span class="rlabel">Sound ${sfx.on ? 'on' : 'off'}</span>`; st.setAttribute('aria-pressed', sfx.on ? 'true' : 'false'); st.title = sfx.on ? 'Sound on' : 'Sound off'; }
}
document.addEventListener('click', (e) => { if (moreOpen && isPhone() && !e.target.closest('.rail')) { moreOpen = false; buildRail(); } });
IC.soundOn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
IC.soundOff = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>';

// ---- sound: synthesized, off by default, starts only after the user turns it on ----
const sfx = {
  on: (() => { try { return localStorage.getItem('pol_sound') === '1'; } catch { return false; } })(),
  ctx: null,
  unlock() { if (this.on && !this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  toggle() { this.on = !this.on; try { localStorage.setItem('pol_sound', this.on ? '1' : '0'); } catch {} this.unlock(); buildRail(); if (this.on) this.chime(); },
  tone(freq, at, dur, type, gain) {
    if (!this.on || !this.ctx) return; const t = this.ctx.currentTime + (at || 0), o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain || 0.08, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.3));
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + (dur || 0.3) + 0.05);
  },
  crack() { this.tone(1800, 0, 0.05, 'triangle', 0.05); this.tone(1200, 0.07, 0.05, 'triangle', 0.05); },
  arp(rank) { const root = 392 * Math.pow(2, (rank || 0) * 2 / 12); [0, 4, 7, 12].slice(0, rank >= 3 ? 4 : 3).forEach((s, i) => this.tone(root * Math.pow(2, s / 12), i * 0.09, 0.45, 'sine', 0.08)); },
  chime() { this.tone(784, 0, 0.35); this.tone(1175, 0.11, 0.5); },
  chord() { [523, 659, 784, 1047].forEach((f) => this.tone(f, 0, 1.1, 'sine', 0.06)); this.tone(1568, 0.25, 0.9, 'sine', 0.04); },
};

// ---- profiles (open in a modal) ----
async function openProfile(handle) {
  let p = null;
  try { const r = await fetch('/api/profile?handle=' + encodeURIComponent(handle)); p = r.ok ? await r.json() : null; } catch {}
  if (!p || p.error) {
    document.getElementById('modal-card').innerHTML = `<h3>@${escapeXml(handle)}</h3><p class="note">No operator with that handle on this server.</p><div class="btns"><button id="close">Close</button></div>`;
    document.getElementById('modal').hidden = false; document.getElementById('close').onclick = closeModal; return;
  }
  const link = `${location.origin}/#u/${encodeURIComponent(p.handle)}`;
  const grid = p.creatures && p.creatures.length ? `<div class="shelf" style="margin-top:12px">${p.creatures.slice(0, 6).map((c) => tileHTML(c, { noNew: true, eager: true })).join('')}</div>` : `<p class="note">No creatures yet.</p>`;
  document.getElementById('modal-card').innerHTML = `<div class="ava big" style="background:${p.accent || '#67e39a'};margin:0 auto">${initials(p.handle)}</div>
    <h3>@${escapeXml(p.handle)} ${p.you ? '<span class="chip" style="color:var(--green)">you</span>' : p.sample ? '<span class="chip" style="color:var(--violet)">sample</span>' : ''}</h3>
    <div class="stats-row" style="justify-content:center;margin:14px 0">
      ${hasPower(p) ? `<div class="stat"><b>${fmtN(p.week)}</b><span>this week</span></div><div class="stat"><b>${fmtN(p.score)}</b><span>power</span></div>` : ''}<div class="stat"><b>${fmtN(p.runs)}</b><span>runs</span></div><div class="stat"><b>${Number(p.hours || 0).toFixed(1)}</b><span>hrs</span></div></div>
    <div class="pshare"><input id="plink" readonly value="${escapeXml(link)}"/><button class="primary" id="copy">Copy link</button>${p.you ? '<button id="edit">Edit</button>' : ''}</div>${grid}
    <div class="btns" style="margin-top:14px"><button id="close">Close</button></div>`;
  document.getElementById('modal-card').classList.add('wide');
  document.getElementById('modal').hidden = false;
  document.getElementById('close').onclick = closeModal;
  const cp = document.getElementById('copy'); cp.onclick = () => { try { navigator.clipboard.writeText(link); } catch {} cp.textContent = 'Copied'; setTimeout(() => (cp.textContent = 'Copy link'), 1400); };
  const ed = document.getElementById('edit'); if (ed) ed.onclick = editIdentity;
  document.getElementById('modal-card').querySelectorAll('.tile[data-id]').forEach((t) => bindCreatureEl(t, (id) => (p.creatures || []).find((c) => c.id === id)));
}
async function editIdentity() {
  const handle = prompt('Your handle (letters, numbers, underscore):', (latest.me && latest.me.handle) || ''); if (handle == null) return;
  const displayName = prompt('Display name:', (latest.me && latest.me.displayName) || '') || undefined;
  const r = await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle, displayName }) });
  if (r.status === 409) { alert('That handle is already taken on this server.'); return; }
  closeModal(); poll(true);
}

// ---- modal (creature) ----
function closeModal() { const m = document.getElementById('modal'); m.hidden = true; m.querySelector('.modal-card').innerHTML = ''; document.getElementById('modal-card').classList.remove('wide'); if (pendingRender) { pendingRender = false; renderActive(); } }
function openModal(c) {
  if (!c) return;
  const gains = gainsOf(c).slice(0, 4), v = variantOf(c), st = stageOf(c);
  const rows = [['species', c.speciesName], ['rarity', c.rarity.tier], ['variant', v ? v.full + (v.shiny ? ' (Shiny)' : '') : '—'], ['face', v ? `${v.expression.name} · ${v.eyes.name} eyes` : '—'], ['level', lvLine(c)], ['serial', tagOf(c)], ['forged from', c.bredBy ? 'cross-feed · ' + c.domain + ' work' : originLine(c).replace(/^grew from /, '')], ['traits', c.traits && c.traits.length ? c.traits.join(', ') : 'none'], ['status', c.status === 'healthy' ? 'healthy' : c.status === 'healed' ? 'healed survivor' : 'sick · needs care'], [c.bredBy ? 'bred by' : 'born', c.bredBy ? '@' + c.bredBy.join(' + @') : new Date(c.bornAt).toLocaleString()]].map(([k, val]) => `<div class="row"><span>${k}</span><span>${escapeXml(val)}</span></div>`).join('');
  const att = `<div class="att"><div class="att-row"><span>attestation</span><span class="mono">${c.att ? escapeXml(c.att.fp) + ' · ed25519' : 'unsigned'}</span></div><button id="verify" class="ghost">Check signature</button><div id="vres" class="vres"></div></div>`;
  document.getElementById('modal-card').classList.remove('wide');
  document.getElementById('modal-card').innerHTML = `<div class="m-art t-${c.rarity.tier.toLowerCase()}${v && v.shiny ? ' is-shiny' : ''}" style="--tier:${c.rarity.chip}">${creatureVisual(c, 220, { live: true })}</div><span class="chip" style="color:${c.rarity.chip}">${c.rarity.tier}</span>${v && v.shiny ? ' <span class="shinychip">✦ Shiny</span>' : ''}<h3>${escapeXml(c.fullName)}</h3><div class="m-var">${escapeXml(v ? v.full : c.speciesName)}</div>${gains.length ? `<div class="gains center">${gains.map(([k, val]) => `<span class="gain">+${fmtN(val)} ${escapeXml(skillName(k))}</span>`).join('')}</div>` : ''}<div class="rows">${rows}</div>${att}
    <div class="btns"><button class="primary" id="dl">Save card</button><button id="dlog" title="1200 × 630, for link previews">Wide card</button>${c.bredBy ? '' : '<button id="rv">Replay hatch</button>'}<button id="close">Close</button></div>`;
  document.getElementById('modal').hidden = false;
  document.getElementById('close').onclick = closeModal;
  document.getElementById('dl').onclick = () => downloadCard(c, 'portrait');
  document.getElementById('dlog').onclick = () => downloadCard(c, 'og');
  const rv = document.getElementById('rv'); if (rv) rv.onclick = () => { sfx.unlock(); closeModal(); queueReveals([c], true); };
  const vb = document.getElementById('verify');
  if (vb) vb.onclick = async () => {
    const vres = document.getElementById('vres'); vres.className = 'vres'; vres.textContent = 'checking signature…';
    try {
      const r = await (await fetch('/api/verify?id=' + encodeURIComponent(c.id))).json();
      vres.className = 'vres ' + (r.valid ? 'ok' : 'bad');
      vres.innerHTML = r.valid ? `✓ Signature intact · signed by key ${escapeXml(r.signer || '')}` : `✗ Invalid signature${r.reason ? ' · ' + escapeXml(r.reason) : ''}`;
    } catch { vres.className = 'vres bad'; vres.textContent = 'signature check failed'; }
  };
}
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!document.getElementById('reveal').hidden) closeReveal(); else closeModal(); } });
document.getElementById('sound').addEventListener('click', () => sfx.toggle());

// ---- hatch reveal ceremony: egg wobbles and cracks, rarity flash, creature lands ----
// revealMarkup is a pure function of the creature: same seed, same ceremony.
const FLASH_OP = { Common: 0.35, Uncommon: 0.45, Rare: 0.55, Epic: 0.66, Legendary: 0.8, Mythic: 0.85 };
const CONFETTI_N = { Epic: 40, Legendary: 120, Mythic: 140 };
function confettiSVG(c, shiny) {
  const n = CONFETTI_N[c.rarity.tier] || (shiny ? 60 : 0); if (!n) return '';
  const rng = rngFor((c.seed ^ 0xc0ffee) >>> 0), pal = [c.rarity.chip, (ART_PAL[c.speciesKey] || ART_PAL.wisp).glow, '#f5c451', '#ffffff', '#ff7bd0', '#7bf0ff', '#6ee7a5'];
  let q = '';
  for (let i = 0; i < n; i++) {
    const x = rng() * 1000, y = -40 - rng() * 260, col = pal[Math.floor(rng() * pal.length)], s = 6 + rng() * 9, dl = (0.85 + rng() * 0.9).toFixed(2), du = (1.9 + rng() * 1.6).toFixed(2), dx = Math.round((rng() - 0.5) * 220), rot = Math.round((rng() - 0.5) * 1080);
    const shape = rng() < 0.62 ? `<rect x="${F(-s / 2)}" y="${F(-s * 0.3)}" width="${F(s)}" height="${F(s * 0.6)}" rx="1.2" fill="${col}"/>` : `<circle r="${F(s * 0.38)}" fill="${col}"/>`;
    q += `<g transform="translate(${F(x)} ${F(y)})"><g class="cf" style="--dx:${dx}px;--rot:${rot}deg;animation-delay:${dl}s;animation-duration:${du}s">${shape}</g></g>`;
  }
  return `<svg class="rv-confetti" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${q}</svg>`;
}
function revealMarkup(c, more, extra) {
  const T = c.rarity.tier, chip = c.rarity.chip, glow = (ART_PAL[c.speciesKey] || ART_PAL.wisp).glow, v = variantOf(c), st = stageOf(c);
  const gains = gainsOf(c).slice(0, 4);
  const brag = T === 'Legendary' || T === 'Mythic' || (v && v.shiny);
  let share = '';
  if (brag) { try { const svg = buildCardSVG(c, 'portrait'), odds = oddsOf(c); share = `<div class="rv-share"><img alt="share card preview" width="120" height="150" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}"/><div><b>${v && v.shiny ? 'A Shiny. Worth showing off.' : T === 'Mythic' ? 'A Mythic. Worth showing off.' : 'A Legendary. Worth showing off.'}</b>${odds.length ? `<span>${odds.map(escapeXml).join(' · ')}</span>` : ''}<button class="primary small" data-rv="save">${SAVE_IC} Save the card</button></div></div>`; } catch { share = ''; } }
  const sig = [c.durationLabel ? `${c.durationLabel} run` : '', c.toolCalls ? plural(c.toolCalls, 'tool call') : '', c.subagents ? plural(c.subagents, 'subagent') : ''].filter(Boolean);
  const rays = T === 'Legendary' || T === 'Mythic' || (v && v.shiny) ? `<div class="rv-rays ${T === 'Mythic' || (v && v.shiny) ? 'myth' : ''}"></div>` : '';
  let grew = '';
  if (extra && extra.raised) {
    const g = (extra.grew || [])[0];
    grew = `<div class="rv-grew">${g ? `<div class="gr-pair">${creatureSVG(withLevel(g.c, g.from), 92)}<span>→</span>${creatureSVG(g.c, 92)}</div>` : ''}<span>This run raised ${plural(extra.raised, 'creature')}${g ? ` · ${escapeXml(g.c.name || g.c.fullName)} grew into ${aAn(stageOf(g.c).name)} ${stageOf(g.c).name}${extra.grew.length > 1 ? ` (+${extra.grew.length - 1} more)` : ''}` : ''}</span></div>`;
  }
  return `<div class="rv-flash" style="--chip:${chip};--fo:${FLASH_OP[T] || 0.4}"></div>${confettiSVG(c, v && v.shiny)}
    <div class="rv-stage" style="--chip:${chip};--glow:${glow}">
      <div class="rv-eyebrow">${c.bredBy ? 'A hybrid was bred' : 'A new creature hatched'}</div>
      <div class="rv-pod">${rays}<div class="rv-halo"></div><div class="rv-eggwrap">${eggSVG(c.seed, glow, 230, { crack: true, k: 'rv' })}</div><div class="rv-creature">${creatureSVG(c, 300, { live: true })}</div></div>
      <div class="rv-tier" style="color:${chip}">${v && v.shiny ? 'Shiny ' : ''}${T}</div>
      <h2 class="rv-name">${escapeXml(c.fullName)}</h2>
      <div class="rv-variant">${escapeXml(v ? v.full : '')} · ${escapeXml(st.name)}</div>
      <div class="rv-sig">${escapeXml(c.speciesName)}${sig.length ? ' · ' + sig.map(escapeXml).join(' · ') : ''}${c.traits && c.traits.length ? ' · ' + c.traits.map(escapeXml).join(', ') : ''}</div>
      ${gains.length ? `<div class="gains center rv-gains">${gains.map(([k, val]) => `<span class="gain">+${fmtN(val)} ${escapeXml(skillName(k))}</span>`).join('')}</div>` : ''}
      ${grew}
      ${more ? `<div class="note rv-more">and ${plural(more, 'more creature')} hatched with it</div>` : ''}
      ${share}
      <div class="btns rv-btns"><button class="primary" data-rv="save">${SAVE_IC} Save share card</button><button data-rv="close">Close</button></div>
    </div>`;
}
let revealQ = [], revealing = null, revealTimers = [];
function queueReveals(list, replay, extra) {
  const sorted = list.slice().sort((a, b) => b.rarity.index - a.rarity.index || (b.durationMs || 0) - (a.durationMs || 0));
  const show = sorted.slice(0, 3), more = sorted.length - show.length;
  show.forEach((c, i) => revealQ.push({ c, more: i === show.length - 1 ? more : 0, replay, extra: i === 0 ? extra : null }));
  if (!revealing) nextReveal();
}
function nextReveal() {
  const it = revealQ.shift(); const el = document.getElementById('reveal');
  if (!it) { revealing = null; el.hidden = true; el.innerHTML = ''; document.body.classList.remove('rv-open'); flushToasts(); if (pendingRender && document.getElementById('modal').hidden) { pendingRender = false; renderActive(); } return; }
  revealing = it.c;
  el.className = 'reveal t-' + it.c.rarity.tier.toLowerCase() + (reduceMotion() ? ' rv-still' : '');
  el.innerHTML = revealMarkup(it.c, it.more, it.extra);
  el.hidden = false; document.body.classList.add('rv-open');
  revealTimers.forEach(clearTimeout); revealTimers = [];
  sfx.unlock();
  if (!reduceMotion()) { revealTimers.push(setTimeout(() => sfx.crack(), 250), setTimeout(() => sfx.crack(), 520), setTimeout(() => sfx.arp(Math.min(4, it.c.rarity.index)), 760)); setTimeout(() => el.classList.add('rv-done'), 2800); }
  else el.classList.add('rv-done');
}
function closeReveal() { revealTimers.forEach(clearTimeout); revealTimers = []; nextReveal(); }
document.getElementById('reveal').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rv]');
  if (b && b.dataset.rv === 'save') { downloadCard(revealing, 'portrait'); return; }
  closeReveal();
});

// ---- level-up, growth and milestone toasts (stacked bottom-right, never on first load) ----
let toastQ = [], seenSkills = null;
function loadSeen() { try { return JSON.parse(localStorage.getItem('pol_seen') || 'null'); } catch { return null; } }
function snapSkills(st) {
  if (!st.skills) return null;
  const lv = {}; st.skills.list.forEach((s) => (lv[s.key] = { l: s.level, b: s.band.key, s: s.stars }));
  return { lv, tb: st.skills.totalBand.key, tbn: st.skills.totalBand.name, best: st.engagement ? st.engagement.bestStreak : 0 };
}
function diffSkills(prev, st) {
  if (!prev || !st.skills) return;
  for (const s of st.skills.list) {
    const p = prev.lv[s.key];
    if (!p) { if (!s.locked) toastQ.push({ big: true, band: s.band, title: `${s.name} unlocked`, sub: `a new skill · Lv ${s.level}`, pct: s.pct, n: s.level }); continue; }
    if (s.level <= p.l && s.stars <= p.s) continue;
    if (s.stars > p.s) toastQ.push({ big: true, band: s.band, title: `${s.name} earned a prestige star`, sub: '★'.repeat(s.stars), pct: 1, n: s.level });
    else if (s.band.key !== p.b) toastQ.push({ big: true, band: s.band, title: `${s.name} is now ${s.title.toUpperCase()}`, sub: `Lv ${p.l} → ${s.level}`, pct: s.pct, n: s.level });
    else toastQ.push({ band: s.band, title: `${s.name} ${p.l} → ${s.level}`, sub: `${fmtN(s.toNext)} xp to the next level`, pct: s.pct, n: s.level });
  }
  if (st.skills.totalBand.key !== prev.tb) toastQ.push({ big: true, band: { color: '#b28dff', key: 'total' }, title: `Total level ${fmtN(st.skills.totalLevel)}: ${st.skills.totalBand.name}`, sub: 'a new operator band', pct: 1, n: st.skills.totalLevel });
  if (st.engagement && st.engagement.bestStreak > prev.best && prev.best > 0) toastQ.push({ band: { color: '#ff9a3d' }, flame: true, title: `New best streak: ${st.engagement.bestStreak} days`, sub: 'keep it going tomorrow', pct: 1, n: st.engagement.bestStreak });
  if (!revealing) flushToasts();
}
function flushToasts() {
  const stack = document.getElementById('toasts');
  while (toastQ.length) {
    const t = toastQ.shift();
    while (stack.children.length >= 3) stack.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'ltoast' + (t.big ? ' big' : '') + (t.art ? ' grow' : '');
    el.style.setProperty('--band', t.band.color);
    const lead = t.art ? `<div class="lt-art">${t.art}</div>` : `<div class="lt-ring">${t.flame ? FLAME : ringSVG(t.big ? 52 : 40, t.pct, t.band, `<text x="${t.big ? 26 : 20}" y="${t.big ? 31 : 24.5}" text-anchor="middle" class="ring-n${t.big && t.n < 100 ? '' : ' sm'}">${t.n}</text>`, { sw: t.big ? 5 : 4, fill: true })}</div>`;
    el.innerHTML = `${lead}<div><b>${escapeXml(t.title)}</b><span>${escapeXml(t.sub)}</span></div>`;
    el.onclick = () => { el.remove(); if (t.creatureId) openModal(findCreature(t.creatureId)); };
    stack.appendChild(el);
    setTimeout(() => el.classList.add('out'), t.big ? 5600 : 4200); setTimeout(() => el.remove(), t.big ? 6000 : 4600);
    t.big ? sfx.chord() : sfx.chime();
  }
}

// ---- shareable cards: one SVG, rasterized at 2x ----
// the odds behind a creature, all real: variants.js odds, and where its run ranks among your own runs
function oddsOf(c) {
  const v = variantOf(c), out = [];
  if (v && v.shiny) out.push(`1 in ${PV ? PV.SHINY_ODDS : 64} hatch Shiny`);
  if (c.rarity.tier === 'Legendary' && v && !v.shiny && v.material === 'holo') out.push('Holo: 4 in 10 Legendaries');
  if (c.rarity.tier === 'Legendary' && v && !v.shiny && v.material === 'gold') out.push('Gold Chrome: 6 in 10 Legendaries');
  const mine = latest.creatures.filter((x) => !x.bredBy && (x.durationMs || 0) > 0 && !isOpenRun(x));
  if (!c.bredBy && mine.some((x) => x.id === c.id) && mine.length >= 10) {
    const longer = mine.filter((x) => x.durationMs > c.durationMs).length, pct = Math.max(1, Math.ceil(((longer + 1) / mine.length) * 100));
    if (pct <= 50) out.push(`Top ${pct}% of ${fmtN(mine.length)} runs by length`);
  }
  if (!out.length && !c.bredBy) { const same = latest.creatures.filter((x) => !x.bredBy && x.rarity.tier === c.rarity.tier).length; if (same) out.push(`1 of ${fmtN(same)} ${c.rarity.tier} hatches`); }
  return out.slice(0, 2);
}
const CARD_PRESETS = { portrait: [1080, 1350], og: [1200, 630] };
// a real holo foil: a fine diamond lattice and starbursts in rainbow ink, a sweeping sheen, all clipped to the card
function cardHolo(c, W, H, x, y, w, h) {
  const v = variantOf(c), strong = c.rarity.index >= 4 || (v && v.shiny), on = c.rarity.index >= 3 || (v && v.shiny);
  if (!on) return { defs: '', layer: '' };
  const rng = rngFor((c.seed ^ 0xf011) >>> 0), ang = Math.round(20 + rng() * 40);
  const stops = c.rarity.tier === 'Mythic' ? ['#ff7bd0', '#7bf0ff', '#b28dff', '#9dffcf', '#ff7bd0'] : c.rarity.tier === 'Legendary' && !(v && v.shiny) ? ['#fff3b0', '#f5c451', '#ff9a3d', '#fff3b0', '#ffd36b'] : ['#ff7bd0', '#ffd36b', '#7dffb0', '#6ad8ff', '#b08cff', '#ff7bd0'];
  const defs = `<linearGradient id="holo-ink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W}" y2="${H}" gradientTransform="rotate(${ang - 30} ${W / 2} ${H / 2})">${stops.map((s, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')}</linearGradient>
    <pattern id="holo-lat" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(${ang})"><path d="M13 0L26 13L13 26L0 13Z" fill="none" stroke="#fff" stroke-width="1.1" opacity=".55"/><circle cx="13" cy="13" r="1.6" fill="#fff" opacity=".7"/></pattern>
    <pattern id="holo-star" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(${-ang / 2})"><path d="${star4(45, 45, 9)}" fill="#fff" opacity=".8"/><path d="${star4(10, 70, 4)}" fill="#fff" opacity=".6"/><path d="${star4(72, 14, 5)}" fill="#fff" opacity=".65"/></pattern>
    <mask id="holo-mask"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#holo-lat)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#holo-star)"/></mask>
    <linearGradient id="holo-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const layer = `<g style="mix-blend-mode:screen" opacity="${strong ? 0.5 : 0.32}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#holo-ink)" mask="url(#holo-mask)"/></g><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#holo-ink)" opacity="${strong ? 0.12 : 0.07}" style="mix-blend-mode:screen"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#holo-sheen)"/>`;
  return { defs, layer };
}
function cardFrame(c, W, H) {
  const v = variantOf(c), T = c.rarity.tier, chip = c.rarity.chip;
  const frame = T === 'Legendary' && !(v && v.shiny) ? ['#fff3b0', '#f5c451', '#a8740a', '#ffe39a'] : T === 'Mythic' || (v && v.shiny) ? ['#ff7bd0', '#7bf0ff', '#b28dff', '#ffd36b'] : [lighten(chip, 0.3), chip, darken(chip, 0.4), lighten(chip, 0.2)];
  return `<linearGradient id="frame-g" x1="0" y1="0" x2="1" y2="1">${frame.map((s, i) => `<stop offset="${(i / (frame.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')}</linearGradient>`;
}
// the creature fitted into an art window by its own crop box, so nothing is ever cut off by the frame
function fitArt(c, inner, x, y, w, h, pad) {
  const [bx, by, bw, b0] = cropBox(c).split(' ').map(Number), bh = b0 + 14, k = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh); // +14: the plinth under its feet
  return `<g transform="translate(${F(x + w / 2 - (bx + bw / 2) * k)} ${F(y + h / 2 - (by + bh / 2) * k)}) scale(${F(k * 1000) / 1000})">${inner}</g>`;
}
function runFact(c) { return c.bredBy ? `bred from ${c.domain || 'shared'} work` : isOpenRun(c) ? 'hatched from a session left open' : `forged from ${aAn(c.durationLabel)} ${c.durationLabel} agent run`; }
function buildCardSVG(c, preset) {
  const [W, H] = CARD_PRESETS[preset] || CARD_PRESETS.portrait, chip = c.rarity.chip, v = variantOf(c), st = stageOf(c), T = c.rarity.tier;
  const g = gainsOf(c)[0], fp = c.att ? c.att.fp : null, handle = c.bredBy ? '@' + c.bredBy.join(' + @') : latest.me ? '@' + latest.me.handle : '';
  const inner = creatureInner(c, rngFor(c.seed)).split('__I__').join('-card');
  const TX = (x, y, size, fill, txt, o) => `<text x="${x}" y="${y}" text-anchor="${(o && o.a) || 'middle'}" font-family="${o && o.serif ? 'Georgia,serif' : o && o.mono ? 'ui-monospace,Consolas,monospace' : 'system-ui,Segoe UI,sans-serif'}" font-size="${size}" fill="${fill}"${o && o.ls ? ` letter-spacing="${o.ls}"` : ''}${o && o.w ? ` font-weight="${o.w}"` : ''}>${escapeXml(txt)}</text>`;
  const verify = fp ? `signed ${fp} · ed25519` : 'unsigned';
  const tierLabel = (v && v.shiny ? 'SHINY ' : '') + T.toUpperCase();
  if (preset === 'og') {
    const ax = 40, ay = 40, aw = 500, ah = 550;
    const holo = cardHolo(c, W, H, ax, ay, aw, ah);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${PL_DEFS}${cardFrame(c, W, H)}${holo.defs}<radialGradient id="bgg" cx="30%" cy="45%" r="80%"><stop offset="0" stop-color="#1e2436"/><stop offset="1" stop-color="#0b0d13"/></radialGradient><radialGradient id="spot" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color="${chip}" stop-opacity=".42"/><stop offset="1" stop-color="${chip}" stop-opacity="0"/></radialGradient><clipPath id="art-clip"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="26"/></clipPath></defs>
      <rect width="${W}" height="${H}" rx="34" fill="url(#bgg)"/><rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="28" fill="none" stroke="url(#frame-g)" stroke-width="6"/>
      <g clip-path="url(#art-clip)"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="#10131c"/><circle cx="${ax + aw / 2}" cy="${ay + ah * 0.55}" r="${aw * 0.62}" fill="url(#spot)"/>${holo.layer}${fitArt(c, inner, ax, ay, aw, ah, 26)}</g><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="26" fill="none" stroke="url(#frame-g)" stroke-width="3" opacity=".8"/>
      ${TX(590, 110, 20, '#8d96b3', 'PROOF OF LIFE  ' + tagOf(c), { a: 'start', ls: 6, w: 700 })}${TX(590, 168, 30, chip, tierLabel, { a: 'start', ls: 6, w: 800 })}
      ${TX(590, 238, Math.min(54, Math.floor(1060 / Math.max(10, c.fullName.length))), '#f4f2ff', c.fullName, { a: 'start', serif: 1 })}
      ${TX(590, 286, 24, '#d8dcea', `${v ? v.full : c.speciesName}`, { a: 'start', w: 600 })}${TX(590, 324, 22, '#9aa3bf', `${c.speciesName} · Lv ${c.level || 1} · ${st.name}`, { a: 'start' })}
      ${TX(590, 372, 22, '#9aa3bf', runFact(c) + (c.toolCalls ? ' · ' + plural(c.toolCalls, 'tool call') : ''), { a: 'start' })}
      ${g ? `<rect x="590" y="404" width="${Math.min(520, 40 + (fmtN(g[1]).length + skillName(g[0]).length + 2) * 15)}" height="48" rx="24" fill="${chip}" fill-opacity=".14" stroke="${chip}" stroke-opacity=".55"/>` + TX(614, 436, 22, '#f4f2ff', `+${fmtN(g[1])} ${skillName(g[0])}`, { a: 'start', w: 700 }) : ''}
      ${oddsOf(c).length ? TX(590, 492, 21, chip, oddsOf(c).join('  ·  '), { a: 'start', w: 700 }) : ''}
      ${TX(590, 534, 19, '#7e88a6', verify, { a: 'start', mono: 1 })}${TX(590, 566, 19, '#646d88', `${handle} · a tamper-evident record`, { a: 'start' })}</svg>`;
  }
  // portrait: a trading card. Frame, a foil art window, the odds pill under it, a name plate,
  // three or four real stats (a stat with no data is left out, never shown as a dash), a signed footer.
  const ax = 70, ay = 146, aw = W - 140, ah = 700;
  const holo = cardHolo(c, W, H, ax, ay, aw, ah);
  const odds = oddsOf(c), oddsTxt = odds.join('  ·  '), oddsW = Math.min(aw - 40, 60 + oddsTxt.length * 12.4);
  const stats = [c.bredBy ? ['ORIGIN', 'cross-fed'] : ['RUN', isOpenRun(c) ? 'left open' : c.durationLabel || '0s']];
  if (c.toolCalls != null) stats.push(['TOOLS', fmtN(c.toolCalls)]);
  stats.push(['LEVEL', `${c.level || 1}`], ['SUBAGENTS', fmtN(c.subagents || 0)]);
  const gap = 20, tw = (W - 160 - gap * (stats.length - 1)) / stats.length;
  const stat = (i, label, val) => { const x = 80 + i * (tw + gap); return `<rect x="${F(x)}" y="1068" width="${F(tw)}" height="104" rx="18" fill="#ffffff" fill-opacity=".04" stroke="#ffffff" stroke-opacity=".1"/>${TX(F(x + tw / 2), 1108, 18, '#8d96b3', label, { ls: 3, w: 700 })}${TX(F(x + tw / 2), 1150, val.length > 9 ? 28 : 34, '#f4f2ff', val, { w: 700 })}`; };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${PL_DEFS}${cardFrame(c, W, H)}${holo.defs}<radialGradient id="bgg" cx="50%" cy="30%" r="85%"><stop offset="0" stop-color="#1e2436"/><stop offset="1" stop-color="#0a0c12"/></radialGradient><radialGradient id="spot" cx="50%" cy="58%" r="58%"><stop offset="0" stop-color="${chip}" stop-opacity=".45"/><stop offset=".6" stop-color="${chip}" stop-opacity=".1"/><stop offset="1" stop-color="${chip}" stop-opacity="0"/></radialGradient><clipPath id="art-clip"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="34"/></clipPath></defs>
    <rect width="${W}" height="${H}" rx="44" fill="url(#bgg)"/>
    <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="36" fill="none" stroke="url(#frame-g)" stroke-width="10"/><rect x="30" y="30" width="${W - 60}" height="${H - 60}" rx="26" fill="none" stroke="url(#frame-g)" stroke-width="2" opacity=".55"/>
    ${TX(80, 106, 22, '#9aa3bf', 'PROOF OF LIFE  ' + tagOf(c), { a: 'start', ls: 7, w: 700 })}
    <rect x="${W - 80 - (tierLabel.length * 19 + 56)}" y="70" width="${tierLabel.length * 19 + 56}" height="50" rx="25" fill="${chip}" fill-opacity=".12" stroke="url(#frame-g)" stroke-width="3"/>${TX(W - 80 - (tierLabel.length * 19 + 56) / 2, 104, 22, chip, tierLabel, { ls: 4, w: 800 })}
    <g clip-path="url(#art-clip)"><rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="#0f121b"/><circle cx="${W / 2}" cy="${ay + ah * 0.56}" r="${aw * 0.62}" fill="url(#spot)"/>${holo.layer}${fitArt(c, inner, ax, ay, aw, ah, 34)}</g>
    <rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="34" fill="none" stroke="url(#frame-g)" stroke-width="4"/>
    ${odds.length ? `<rect x="${F(W / 2 - oddsW / 2)}" y="${ay + ah + 18}" width="${F(oddsW)}" height="50" rx="25" fill="${chip}" fill-opacity=".1" stroke="url(#frame-g)" stroke-width="2"/>` + TX(W / 2, ay + ah + 51, 23, '#f4f2ff', oddsTxt, { w: 700, ls: 1 }) : ''}
    ${TX(W / 2, 988, Math.min(62, Math.floor(1700 / Math.max(10, c.fullName.length))), '#f6f4ff', c.fullName, { serif: 1 })}
    ${TX(W / 2, 1036, 26, chip, `${v ? v.full : c.speciesName} · ${c.speciesName} · ${st.name}`, { w: 600 })}
    ${stats.map(([l, v2], i) => stat(i, l, v2)).join('')}
    ${TX(80, 1232, 24, '#f4f2ff', g ? `+${fmtN(g[1])} ${skillName(g[0])}` : c.traits && c.traits.length ? c.traits.join(' · ') : handle, { a: 'start', w: 700 })}
    ${TX(W - 80, 1226, 19, '#8d96b3', verify, { a: 'end', mono: 1 })}${TX(W - 80, 1258, 18, '#646d88', `${handle ? handle + ' · ' : ''}a tamper-evident record`, { a: 'end' })}</svg>`;
}
function buildSkillCardSVG(s) {
  const W = 1080, H = 1350, sk = latest.skills, col = s.band.color, r = 330, C = 2 * Math.PI * r, p = s.locked ? 0 : s.pct;
  const sig = skillGlyph(s, 'sig');
  const grad = s.band.gradient || (s.band.ring === 'gold' ? ['#fff3b0', '#f5c451', '#b07a10'] : null);
  const ringStroke = grad ? 'url(#iri)' : col;
  const inner = creatureInner(sig, rngFor(sig.seed)).split('__I__').join('-sk');
  const T = (x, y, size, fill, txt, o) => `<text x="${x}" y="${y}" text-anchor="${(o && o.a) || 'middle'}" font-family="${o && o.serif ? 'Georgia,serif' : 'system-ui,Segoe UI,sans-serif'}" font-size="${size}" fill="${fill}"${o && o.ls ? ` letter-spacing="${o.ls}"` : ''}${o && o.w ? ` font-weight="${o.w}"` : ''}>${escapeXml(txt)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${PL_DEFS}<radialGradient id="bgg" cx="50%" cy="36%" r="75%"><stop offset="0" stop-color="#20263a"/><stop offset="1" stop-color="#0d0f16"/></radialGradient><radialGradient id="spot" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${col}" stop-opacity=".34"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><linearGradient id="iri" x1="0" y1="0" x2="1" y2="1">${(grad || [col, col]).map((c2, i, a) => `<stop offset="${(i / (a.length - 1)).toFixed(2)}" stop-color="${c2}"/>`).join('')}</linearGradient></defs>
    <rect width="${W}" height="${H}" rx="40" fill="url(#bgg)"/><rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="30" fill="none" stroke="${col}" stroke-opacity=".55" stroke-width="3"/>
    ${T(80, 104, 24, '#8d96b3', 'PROOF OF LIFE · SKILL', { a: 'start', ls: 6, w: 600 })}
    <circle cx="540" cy="500" r="${r + 40}" fill="url(#spot)"/>
    <circle cx="540" cy="500" r="${r}" fill="none" stroke="#1c1e26" stroke-width="16"/><circle cx="540" cy="500" r="${r}" fill="none" stroke="${ringStroke}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${F(C * p)} ${F(C)}" transform="rotate(-90 540 500)"/>
    <g transform="translate(${540 - 100 * 2.9} ${500 - 118 * 2.9}) scale(2.9)">${inner}</g>
    ${T(540, 900, 34, col, s.locked ? 'LOCKED' : s.title.toUpperCase(), { ls: 8, w: 700 })}
    ${T(540, 990, 84, '#f4f2ff', s.name, { serif: 1 })}
    ${T(540, 1066, 46, '#d8dcea', s.locked ? 'Not unlocked yet' : 'Level ' + s.level + (s.stars ? '  ' + '★'.repeat(s.stars) : ''), { serif: 1 })}
    ${T(540, 1118, 26, '#a2abc6', s.locked ? s.unlock || '' : `${fmtN(s.xp)} xp · ${plural(s.creatures, 'run')} · next: ${nextLine(s)}`)}
    <path d="M80 1180H${W - 80}" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/>
    ${T(80, 1240, 28, '#f4f2ff', `Total level ${fmtN(sk.totalLevel)} · ${sk.totalBand.name}`, { a: 'start', w: 600 })}
    ${T(80, 1282, 22, '#7e88a6', `${latest.me ? '@' + latest.me.handle : ''} · ${fmtN(sk.totalXp)} xp across ${sk.list.filter((x) => !isLocked(x)).length} skills`, { a: 'start' })}
    ${T(W - 80, 1282, 20, '#646d88', 'from real agent runs', { a: 'end' })}</svg>`;
}
function saveSVG(svg, W, H, name) {
  const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.onload = () => { const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; const ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url); const a = document.createElement('a'); a.download = name + '.png'; a.href = cv.toDataURL('image/png'); a.click(); };
  img.onerror = () => { URL.revokeObjectURL(url); alert('Could not render the card in this browser.'); };
  img.src = url;
}
function downloadCard(c, preset) { if (!c) return; const [W, H] = CARD_PRESETS[preset] || CARD_PRESETS.portrait; saveSVG(buildCardSVG(c, preset), W, H, c.fullName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + (preset === 'og' ? '-wide' : '')); }
// ---- the weekly card: what my agents did this ISO week, by type of work ----
// Real runs only (bred creatures are not runs). Hours leave out sessions left
// open (as the stat strip does). Non-code work first, Engineering last.
function isoWeekOf(ms) {
  const d = new Date(ms), t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); // the Thursday decides the year
  const wk = 1 + Math.floor(Math.round((t - new Date(t.getFullYear(), 0, 1)) / 86400000) / 7);
  return { year: t.getFullYear(), week: wk };
}
// agent time: a run's wall-clock length minus the time it waited on you (waitMs,
// recorded from v1.0; older runs count in full)
const agentMs = (c) => Math.max(0, (c.durationMs || 0) - (c.waitMs || 0));
function weekSummary(now) {
  now = now || Date.now();
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
  const from = d0.getTime(), to = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + 7).getTime();
  const runs = latest.creatures.filter((c) => !c.bredBy && c.bornAt >= from && c.bornAt < to);
  const by = {};
  let ms = 0;
  for (const c of runs) {
    const k = DOMAIN_LABEL[c.domainKey] ? c.domainKey : 'wisp', b = by[k] || (by[k] = { key: k, label: DOMAIN_LABEL[k], runs: 0, ms: 0 });
    b.runs++;
    if (!isOpenRun(c)) { const a = agentMs(c); b.ms += a; ms += a; }
  }
  // the not-code share counts only runs typed from what the agent did (tools,
  // files, commands), the same rule as scripts/stats.mjs; prompt-typed runs are left out
  const typed = runs.filter((c) => c.domainSource === 'activity');
  const order = (a, b) => b.runs - a.runs || b.ms - a.ms || a.label.localeCompare(b.label);
  const types = Object.values(by).filter((t) => t.key !== 'cog').sort(order).concat(by.cog ? [by.cog] : []);
  const top = runs.filter((c) => !isOpenRun(c)).sort(byRarest)[0] || null;
  const iw = isoWeekOf(now);
  return { from, to, runs: runs.length, ms, types, top, typed: typed.length, nonCode: typed.filter((c) => c.domainKey !== 'cog').length, ...iw };
}
const hrs = (ms) => { const h = ms / 3600000; return h >= 10 ? Math.round(h) + ' h' : h >= 1 ? (Math.round(h * 10) / 10) + ' h' : Math.round(ms / 60000) + ' min'; };
function weekShareHTML() {
  const w = weekSummary();
  return `<div class="wk-share"><span class="note">Week ${w.week} · ${plural(w.runs, 'run')}${w.runs ? ' · ' + hrs(w.ms) : ''}</span><button id="saveweek" title="save a card of what your agents did this week">${SAVE_IC} Share this week</button></div>`;
}
function buildWeekCardSVG(w) {
  const W = 1080, H = 1350, me = latest.me ? '@' + latest.me.handle : '';
  const T = (x, y, size, fill, txt, o) => `<text x="${x}" y="${y}" text-anchor="${(o && o.a) || 'middle'}" font-family="${o && o.serif ? 'Georgia,serif' : o && o.mono ? 'ui-monospace,Consolas,monospace' : 'system-ui,Segoe UI,sans-serif'}" font-size="${size}" fill="${fill}"${o && o.ls ? ` letter-spacing="${o.ls}"` : ''}${o && o.w ? ` font-weight="${o.w}"` : ''}>${escapeXml(txt)}</text>`;
  const fmtD = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const range = `${fmtD(w.from)} to ${fmtD(w.to - 1)}, ${w.year}`;
  let body = '';
  if (!w.runs) {
    body = `<g transform="translate(${540 - 100 * 1.6} ${560 - 115 * 1.6}) scale(1.6)" opacity=".55">${eggSVG(4141, '#8d96b3', 200).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>
      ${T(540, 820, 54, '#f4f2ff', 'No agent runs yet this week', { serif: 1 })}
      ${T(540, 878, 26, '#9aa3bf', 'Every Claude Code run this week will show up here, by type of work.')}`;
  } else {
    const rows = w.types.slice(0, 7), max = Math.max(...rows.map((t) => t.runs)), y0 = 520, rh = 74;
    const firstCode = rows.findIndex((t) => t.key === 'cog');
    body = `${T(80, 330, 120, '#f4f2ff', fmtN(w.runs), { a: 'start', serif: 1 })}${T(80, 380, 24, '#9aa3bf', w.runs === 1 ? 'agent run' : 'agent runs', { a: 'start', ls: 2 })}
      ${T(470, 330, 120, '#f4f2ff', hrs(w.ms).replace(' ', ''), { a: 'start', serif: 1 })}${T(470, 380, 24, '#9aa3bf', 'of agent time', { a: 'start', ls: 2 })}
      ${T(80, 470, 22, '#8d96b3', 'BY TYPE OF WORK', { a: 'start', ls: 5, w: 700 })}${w.typed ? T(W - 80, 470, 22, '#8d96b3', w.nonCode ? Math.round((100 * w.nonCode) / w.typed) + '% NOT CODE' : 'ALL CODE', { a: 'end', ls: 4, w: 700 }) + T(W - 80, 500, 17, '#646d88', `of the ${plural(w.typed, 'run')} typed from what the agent did`, { a: 'end' }) : ''}
      ${rows.map((t, i) => { const y = y0 + i * rh + (firstCode > 0 && i >= firstCode ? 18 : 0), col = (ART_PAL[t.key] || ART_PAL.wisp).glow, bw = Math.max(10, (450 * t.runs) / max);
        return `${firstCode > 0 && i === firstCode ? `<path d="M80 ${y - 30}H${W - 80}" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/>` : ''}${T(80, y + 30, 30, '#f4f2ff', t.label, { a: 'start', w: 600 })}<rect x="330" y="${y + 6}" width="450" height="32" rx="16" fill="#ffffff" fill-opacity=".05"/><rect x="330" y="${y + 6}" width="${F(bw)}" height="32" rx="16" fill="${col}"/>${T(W - 80, y + 31, 26, '#d8dcea', `${plural(t.runs, 'run')} · ${t.ms ? hrs(t.ms) : '0 min'}`, { a: 'end', w: 600 })}`; }).join('')}`;
    if (w.top) {
      const c = w.top, inner = creatureInner(c, rngFor(c.seed)).split('__I__').join('-wk'), yT = 1060;
      body += `<rect x="80" y="${yT}" width="${W - 160}" height="150" rx="24" fill="${c.rarity.chip}" fill-opacity=".08" stroke="${c.rarity.chip}" stroke-opacity=".45" stroke-width="2"/>
        <clipPath id="wk-clip"><rect x="92" y="${yT + 12}" width="126" height="126" rx="18"/></clipPath><g clip-path="url(#wk-clip)"><rect x="92" y="${yT + 12}" width="126" height="126" fill="#0f121b"/>${fitArt(c, inner, 92, yT + 12, 126, 126, 8)}</g>
        ${T(246, yT + 48, 20, '#8d96b3', 'TOP CREATURE THIS WEEK', { a: 'start', ls: 4, w: 700 })}${T(246, yT + 92, Math.min(40, Math.floor(1300 / Math.max(10, c.fullName.length))), '#f4f2ff', c.fullName, { a: 'start', serif: 1 })}
        ${T(246, yT + 128, 22, c.rarity.chip, `${c.rarity.tier} ${c.speciesName} · ${DOMAIN_LABEL[c.domainKey] || 'General'} work · ${c.durationLabel || ''} run`, { a: 'start', w: 600 })}`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${PL_DEFS}<radialGradient id="bgg" cx="50%" cy="30%" r="85%"><stop offset="0" stop-color="#1e2436"/><stop offset="1" stop-color="#0a0c12"/></radialGradient></defs>
    <rect width="${W}" height="${H}" rx="44" fill="url(#bgg)"/><rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="30" fill="none" stroke="#b28dff" stroke-opacity=".45" stroke-width="3"/>
    ${T(80, 106, 22, '#9aa3bf', 'PROOF OF LIFE  ·  WEEK ' + w.week, { a: 'start', ls: 7, w: 700 })}${T(W - 80, 106, 22, '#8d96b3', range, { a: 'end' })}
    ${T(80, 196, 64, '#f6f4ff', 'What my agents did', { a: 'start', serif: 1 })}
    ${body}
    ${T(80, 1282, 22, '#7e88a6', me, { a: 'start' })}${T(W - 80, 1282, 20, '#646d88', 'from my own Claude Code runs · a tamper-evident record', { a: 'end' })}</svg>`;
}
function downloadWeekCard() { const w = weekSummary(); saveSVG(buildWeekCardSVG(w), 1080, 1350, `agents-week-${w.year}-w${String(w.week).padStart(2, '0')}`); }
function downloadSkillCard(s) { if (s) saveSVG(buildSkillCardSVG(s), 1080, 1350, 'skill-' + s.key + '-lv' + s.level); }

// ---- loop ----
let pendingRender = false;
async function poll(force) {
  try {
    const tz = new Date().getTimezoneOffset();
    const [st, bd, be] = await Promise.all([fetch('/api/state?tz=' + tz).then((r) => r.json()), fetch('/api/board').then((r) => r.json()).catch(() => ({ board: [] })), fetch('/api/bestiary').then((r) => r.json()).catch(() => null)]);
    if (!st || !Array.isArray(st.creatures)) throw new Error('bad state');
    // a genuinely new creature gets its hatch ceremony, once; ids are marked known here so an open modal can't repeat it
    const fresh = firstLoad ? [] : st.creatures.filter((c) => !known.has(c.id));
    fresh.forEach((c) => freshIds.add(c.id)); if (fresh.length) setTimeout(() => fresh.forEach((c) => freshIds.delete(c.id)), 8000);
    st.creatures.forEach((c) => known.add(c.id));
    // the herd it raised: levels that went up since the last poll, and who grew into a new stage
    const prevLv = new Map(latest.creatures.map((c) => [c.id, c.level || 1]));
    const raised = [], grew = [];
    if (!firstLoad) for (const c of st.creatures) { const p = prevLv.get(c.id); if (p != null && (c.level || 1) > p) { raised.push(c); if (PV && PV.stageOf(Object.assign({}, c, { level: p })).key !== PV.stageOf(c).key) grew.push({ c, from: p }); } }
    const prevSnap = seenSkills;
    latest = st; boardData = (bd && bd.board) || []; boardSamples = !!(bd && bd.samples); bestiaryData = be || { network: { operators: 0, species: 0, breeds: 0 }, breeds: [], duos: [], operators: [] };
    if (!cfState.a && bestiaryData.breeds && bestiaryData.breeds.length) { cfState.a = bestiaryData.breeds[0].bredBy[0]; cfState.b = bestiaryData.breeds[0].bredBy[1]; cfState.result = { creature: bestiaryData.breeds[0], domain: bestiaryData.breeds[0].domain }; }
    if (!pubInfo) fetch('/api/pubkey').then((r) => r.json()).then((p) => { pubInfo = p; if (current === 'proof' && document.getElementById('modal').hidden) renderActive(); }).catch(() => {});
    document.getElementById('railme').innerHTML = `<span class="av" style="background:${(st.me && st.me.accent) || '#67e39a'}">${st.me ? initials(st.me.handle) : '?'}</span><span>@${escapeXml(st.me ? st.me.handle : 'you')}</span>`;
    checkServer(st);
    if (fresh.length) queueReveals(fresh, false, { raised: raised.length, grew });
    else if (grew.length) { const g = grew[0]; toastQ.push({ big: true, band: { color: g.c.rarity.chip }, art: `${creatureSVG(withLevel(g.c, g.from), 44)}<span>→</span>${creatureSVG(g.c, 44)}`, title: `${g.c.name || g.c.fullName} grew into ${aAn(stageOf(g.c).name)} ${stageOf(g.c).name}`, sub: grew.length > 1 ? `and ${plural(grew.length - 1, 'more creature')} grew up` : `Lv ${g.from} → ${g.c.level}`, creatureId: g.c.id }); }
    // level-up toasts: diff against what this browser last saw (never on first load)
    const snap = snapSkills(st);
    if (!firstLoad) diffSkills(prevSnap, st);
    if (snap) { seenSkills = snap; try { localStorage.setItem('pol_seen', JSON.stringify(snap)); } catch {} }
    document.getElementById('tb-right').innerHTML = topRight();
    // redraw only what changed: the collection grid updates tile by tile, other sections when their own data changed
    const modalOpen = !document.getElementById('modal').hidden;
    if (force || rendered.key !== current) { if (!modalOpen) renderActive(); else pendingRender = true; }
    else if (current === 'collection') updateCollection();
    else if (sectionSig() !== rendered.sig) { if (!modalOpen && !revealing) renderActive(); else pendingRender = true; }
    firstLoad = false;
  } catch (e) { server.old = true; showBanner(); }
}
function tickTimers() {
  document.querySelectorAll('.timer-lite[data-start]').forEach((t) => { t.textContent = fmtClock(Date.now() - Number(t.dataset.start)); });
  document.querySelectorAll('.egg[data-start]').forEach((el) => {
    const ms = Date.now() - Number(el.dataset.start), subs = Number(el.dataset.subs || 0), t = el.querySelector('.timer');
    if (t) t.textContent = fmtClock(ms);
    const fc = eggForecast(ms, subs), f = el.querySelector('.forecast'), m = el.querySelector('.meter em');
    if (f && f.innerHTML !== fc.html) f.innerHTML = fc.html;
    if (m) m.style.left = (fc.pct * 100).toFixed(1) + '%';
    el.querySelectorAll('.meter i').forEach((seg, i) => seg.classList.toggle('on', i <= fc.idx));
  });
}
function readHash() {
  const h = decodeURIComponent(location.hash.replace('#', ''));
  if (h.startsWith('u/')) { if (current !== 'board') setSection('board', true); openProfile(h.slice(2)); }
  else { const k = HASH_ALIAS[h] || h || 'home'; if (k !== current || !document.getElementById('stage').innerHTML) setSection(k, true); }
}
window.addEventListener('hashchange', readHash);

ensurePlDefs();
seenSkills = loadSeen();
buildRail();
loadArt().then(() => poll(true)).then(readHash);
setInterval(() => { if (!document.hidden) poll(false); }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(false); });
setInterval(tickTimers, 1000);
