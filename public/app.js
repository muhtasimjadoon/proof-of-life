// Proof of Life — one dashboard (Shelf · Proof · Board · Bestiary · Antechamber)

// ---- deterministic RNG (mirror of engine.js) ----
function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashString(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
const rngFor = (seed) => mulberry32((seed ^ 0x9e3779b9) >>> 0);

const LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700];
const LEVEL_LABELS = ['Newborn', 'Growing', 'Stronger', 'Thriving', 'Seasoned', 'Veteran', 'Elder', 'Ancient', 'Exalted', 'Fully Raised'];
function levelLabel(c) { if (c.status === 'sick' && (c.level || 1) < 2) return 'Weak & Sick'; return LEVEL_LABELS[Math.min(c.level || 1, LEVEL_LABELS.length) - 1]; }
function xpPct(c) { const l = c.level || 1; if (l >= LEVEL_XP.length) return 1; return Math.max(0, Math.min(1, ((c.xp || 0) - LEVEL_XP[l - 1]) / (LEVEL_XP[l] - LEVEL_XP[l - 1]))); }

// ---- skills: computed server-side from real runs (skills.js), rendered here ----
const DOMAIN_LABEL = { cog: 'Engineering', scholar: 'Research', moth: 'Writing', prism: 'Design', lumen: 'Video', hydra: 'Outreach', wisp: 'General' };
const fmtN = (n) => Math.round(n || 0).toLocaleString('en-US');

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

// ==== ART START: creature renderer (pure, deterministic; the contact-sheet harness slices this block) ====
// One fixed stage (viewBox 0 0 200 220, ground y=196, body radius R=56 for every tier).
// Each species returns its own silhouette + anchors; vinylStack() shades any silhouette as a glossy
// designer toy; rarity, trait and status layers are generic overlays keyed on rarity.tier (never index).
// Everything is derived from seed, tier, traits, status and parents, so signatures are untouched.
const F = (n) => String(Math.round(n * 10) / 10);
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
const RANK = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Mythic: 4, Legendary: 4 };
const ST = (a) => a.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
const LG = (id, v, s) => `<linearGradient id="${id}" x1="${v[0]}" y1="${v[1]}" x2="${v[2]}" y2="${v[3]}">${ST(s)}</linearGradient>`;
const RG = (id, v, s) => `<radialGradient id="${id}" cx="${v[0]}" cy="${v[1]}" r="${v[2]}"${v[3] != null ? ` fx="${v[3]}" fy="${v[4]}"` : ''}>${ST(s)}</radialGradient>`;
const pathOf = (pts, close) => 'M' + pts.map((p) => F(p[0]) + ' ' + F(p[1])).join('L') + (close ? 'Z' : '');
const star4 = (x, y, s) => `M${F(x)} ${F(y - s)}Q${F(x)} ${F(y)} ${F(x + s)} ${F(y)}Q${F(x)} ${F(y)} ${F(x)} ${F(y + s)}Q${F(x)} ${F(y)} ${F(x - s)} ${F(y)}Q${F(x)} ${F(y)} ${F(x)} ${F(y - s)}Z`;
const heartP = (x, y, s) => `M${F(x)} ${F(y + s * 0.9)}C${F(x - s * 1.25)} ${F(y + s * 0.05)} ${F(x - s * 0.95)} ${F(y - s * 0.95)} ${F(x)} ${F(y - s * 0.35)}C${F(x + s * 0.95)} ${F(y - s * 0.95)} ${F(x + s * 1.25)} ${F(y + s * 0.05)} ${F(x)} ${F(y + s * 0.9)}Z`;
const dropP = (x, y, s) => `M${F(x)} ${F(y)}C${F(x + s * 0.55)} ${F(y + s * 0.75)} ${F(x + s * 0.55)} ${F(y + s * 1.25)} ${F(x)} ${F(y + s * 1.25)}C${F(x - s * 0.55)} ${F(y + s * 1.25)} ${F(x - s * 0.55)} ${F(y + s * 0.75)} ${F(x)} ${F(y)}Z`;

// static gradients shared by every creature on a page (fixed ids; buildCardSVG inlines them itself)
const PL_DEFS = [
  RG('pl-cs', ['50%', '50%', '50%'], [[0, '#000', 0.6], [0.6, '#000', 0.25], [1, '#000', 0]]),
  LG('pl-ao', [0, 0, 0, 1], [[0, '#000', 0], [0.58, '#000', 0], [1, '#000', 0.45]]),
  LG('pl-sp', [0, 0, 0, 1], [[0, '#fff', 0.85], [1, '#fff', 0]]),
  RG('pl-shade', ['36%', '26%', '88%', '32%', '22%'], [[0, '#fff', 0.42], [0.22, '#fff', 0.14], [0.55, '#fff', 0], [0.82, '#000', 0.16], [1, '#000', 0.4]]),
  RG('pl-blush', ['50%', '50%', '50%'], [[0, '#ff7d9c', 0.6], [1, '#ff7d9c', 0]]),
  LG('pl-foil-l', [0, 0, 1, 0.35], [[0, '#ff7bd0'], [0.17, '#f5c451'], [0.34, '#6ee7a5'], [0.5, '#67a8f0'], [0.67, '#b28dff'], [0.84, '#ff7bd0'], [1, '#f5c451']]),
  LG('pl-foil-m', [0, 0, 1, 0.35], [[0, '#ff7bd0'], [0.2, '#7bf0ff'], [0.4, '#b28dff'], [0.6, '#ff7bd0'], [0.8, '#7bf0ff'], [1, '#b28dff']]),
  LG('pl-plinth', [0, 0, 0, 1], [[0, '#2c3242'], [1, '#12141b']]),
  LG('pl-gold', [0, 0, 0, 1], [[0, '#fff3b0'], [0.45, '#f5c451'], [0.55, '#c98a12'], [1, '#7a4e06']]),
  LG('pl-gear', [0, 0, 0, 1], [[0, '#fbe0a6'], [0.48, '#f2b545'], [0.5, '#c6943a'], [1, '#795b23']]),
  RG('pl-win', ['50%', '40%', '70%'], [[0, '#fff2c4'], [0.4, '#ffb53d'], [1, '#7a4a0e']]),
  RG('pl-led', ['50%', '50%', '50%'], [[0, '#ff5a4e', 0.55], [1, '#ff5a4e', 0]]),
  LG('pl-beak', [0, 0, 0, 1], [[0, '#f6e7b8'], [1, '#c99a3e']]),
  RG('pl-owl', ['50%', '50%', '50%'], [[0, '#120c04'], [0.38, '#120c04'], [0.43, '#ffcf4a'], [0.8, '#e28a12'], [1, '#5a3306']]),
  RG('pl-collar', ['50%', '30%', '75%'], [[0, '#fffaf0'], [1, '#e8d2b8']]),
  RG('pl-molten', ['50%', '55%', '58%'], [[0, '#fffbe8'], [0.25, '#ffe39a'], [0.55, '#ffb24a'], [0.85, '#e0701c'], [1, '#8a3a0c']]),
  LG('pl-bronze', [0, 0, 0, 1], [[0, '#d9a35a'], [0.5, '#8a5a24'], [1, '#3d2410']]),
  LG('pl-flame', [0, 1, 0, 0], [[0, '#fff'], [0.45, '#ffe066'], [1, '#ff9a1f']]),
  LG('pl-drip', [0, 0, 0, 1], [[0, '#ffb24a'], [1, '#e0701c']]),
  RG('pl-glow-w', ['50%', '50%', '50%'], [[0, '#fff', 0.55], [1, '#fff', 0]]),
  RG('pl-myth', ['50%', '50%', '50%'], [[0, '#ff7bd0', 0.35], [1, '#ff7bd0', 0]]),
  LG('pl-wflame', [0, 1, 0, 0], [[0, '#a48ff0', 0.85], [1, '#efe8ff']]),
  LG('pl-tape', [0, 0, 0, 1], [[0, '#f6dcb5'], [1, '#e2bd8a']]),
  '<pattern id="pl-hz" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#1c1f27"/><rect width="4" height="8" fill="#f2b545"/></pattern>',
].join('');
function ensurePlDefs() {
  if (typeof document === 'undefined' || !document.body || document.getElementById('pl-defs')) return;
  document.body.insertAdjacentHTML('afterbegin', `<svg id="pl-defs" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${PL_DEFS}</defs></svg>`);
}

function artCtx(c, rng) {
  const sk = ART_PAL[c.speciesKey] ? c.speciesKey : 'wisp';
  const T = c.rarity && RANK[c.rarity.tier] != null ? c.rarity.tier : 'Common', rk = RANK[T];
  const tr = c.traits || [];
  const night = tr.includes('Nightshift'), sick = c.status === 'sick', healed = c.status === 'healed' || tr.includes('Survivor');
  const pk = (c.parents || []).map((n) => NAME2KEY[String(n).trim()]).filter(Boolean);
  const hybrid = pk.length === 2;
  const other = hybrid ? (pk.find((k) => k !== sk) || null) : null;
  const pal = Object.assign({}, ART_PAL[sk]);
  const j = (rng() - 0.5) * 0.14; pal.body = j > 0 ? lighten(pal.body, j) : darken(pal.body, -j);
  if (hybrid) pal.body = mix(ART_PAL[pk[0]].body, ART_PAL[pk[1]].body, 0.5);
  if (night) pal.glow = '#8f7bff';
  const sid = (c.seed >>> 0).toString(36) + sk[0] + T[0] + (sick ? 's' : '') + (night ? 'n' : '') + (hybrid ? 'x' + pk[0][0] + pk[1][0] : '');
  let rimC = T === 'Common' ? lighten(pal.glow, 0.2) : T === 'Uncommon' ? mix(lighten(pal.glow, 0.35), '#6ee7a5', 0.5) : lighten(pal.glow, 0.35);
  if (night) rimC = '#a99bff';
  if (T === 'Legendary') rimC = '#ffd76a';
  if (T === 'Mythic') rimC = '#ff9be0';
  const irisOf = (k) => (night ? '#a99bff' : ART_PAL[k].iris);
  let iris = irisOf(hybrid ? pk[0] : sk), iris2 = irisOf(hybrid ? pk[1] : sk);
  if (sick) { iris = mix(iris, '#888888', 0.6); iris2 = mix(iris2, '#888888', 0.6); }
  const tilt = (rng() - 0.5) * 5;
  return { c, rng, sk, T, rk, R: 56, sid, pal, night, sick, healed, hybrid, pk, other, rimC, iris, iris2, tr, tilt, lid: Math.max(night ? 0.22 : 0, sick ? 0.45 : 0), defs: [] };
}

// ---- shared drawing helpers ----
function vinylStack(A, K, o) {
  o = o || {};
  const s = A.sid, R = A.R, b = A.pal.body, u = (x) => `<use href="#b-${s}" ${x}/>`;
  let q = u(`fill="none" stroke="${o.outline || darken(b, 0.6)}" stroke-width="4.5" stroke-linejoin="round"`);
  q += o.inner != null ? o.inner : u(`fill="url(#bd-${s})"`);
  if (A.hybrid && o.inner == null) q += u('fill="url(#pl-shade)"');
  if (!o.noAO) q += u('fill="url(#pl-ao)"');
  q += u(`fill="none" stroke="url(#rim-${s})" stroke-width="7" clip-path="url(#cl-${s})"`);
  const sp = K.spec || { x: K.sx - R * 0.3, y: K.sy - R * 0.52 }, hot = K.hot || { x: K.sx - R * 0.58, y: K.sy - R * 0.2 };
  if (!o.noSpec) q += `<ellipse cx="${F(sp.x)}" cy="${F(sp.y)}" rx="${F(R * 0.36)}" ry="${F(R * 0.15)}" transform="rotate(-24 ${F(sp.x)} ${F(sp.y)})" fill="url(#pl-sp)"${o.gloss ? '' : ' opacity=".9"'}/>`;
  if (o.gloss) q += `<ellipse cx="${F(K.sx + R * 0.45)}" cy="${F(K.sy + R * 0.12)}" rx="${F(R * 0.13)}" ry="${F(R * 0.06)}" transform="rotate(-62 ${F(K.sx + R * 0.45)} ${F(K.sy + R * 0.12)})" fill="#fff" opacity=".45"/>`;
  q += `<circle cx="${F(hot.x)}" cy="${F(hot.y)}" r="${F(R * 0.055)}" fill="#fff" opacity=".9"/>`;
  q += `<path d="M${F(K.sx - R * 0.86)} ${F(K.sy + R * 0.22)}Q${F(K.sx - R * 0.74)} ${F(K.sy + R * 0.8)} ${F(K.sx - R * 0.12)} ${F(K.sy + R * 0.92)}" fill="none" stroke="${lighten(b, 0.3)}" stroke-opacity=".35" stroke-width="1.5" stroke-linecap="round" clip-path="url(#cl-${s})"/>`;
  return q;
}
const irisFor = (A, x) => (A.hybrid && x > 100.5 ? `ir2-${A.sid}` : `ir-${A.sid}`);
function drawEye(A, e) {
  const er = e.er, b = A.pal.body, lidC = e.lidC || lighten(b, 0.04);
  let g = `<g transform="translate(${F(e.x)} ${F(e.y)})"><g class="pl-eye"${e.delay ? ` style="animation-delay:${F(e.delay)}s"` : ''}>`;
  let rx = er, ry = er;
  if (e.kind === 'dark') {
    rx = er * 0.8;
    g += `<ellipse rx="${F(rx + 2)}" ry="${F(er + 2)}" fill="#fff6d8" opacity=".55"/><ellipse rx="${F(rx)}" ry="${F(er)}" fill="#2b1608"/>`;
    g += `<ellipse cx="${F(-rx * 0.3)}" cy="${F(-er * 0.42)}" rx="${F(er * 0.28)}" ry="${F(er * 0.2)}" transform="rotate(-22 ${F(-rx * 0.3)} ${F(-er * 0.42)})" fill="#fff2d0"/><circle cx="${F(rx * 0.35)}" cy="${F(er * 0.35)}" r="${F(er * 0.11)}" fill="#fff2d0" opacity=".75"/>`;
  } else {
    const tall = e.kind === 'tall';
    if (tall) { rx = er * 0.72; ry = er * 1.05; }
    const sh = (a, attrs) => (tall ? `<ellipse rx="${F(rx + a)}" ry="${F(ry + a)}" ${attrs}/>` : `<circle r="${F(er + a)}" ${attrs}/>`);
    if (e.kind === 'lens') g += sh(4.5, `fill="${darken(b, 0.55)}"`) + sh(2.4, `fill="none" stroke="${lighten(b, 0.28)}" stroke-width="1.5"`);
    else g += sh(3, `fill="${darken(b, 0.45)}" opacity=".5"`);
    g += sh(0, `fill="url(#${e.iris || irisFor(A, e.x)})"`);
    if (e.kind === 'lens') { let bl = ''; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3 + 0.3; bl += `M${F(Math.cos(a) * er * 0.42)} ${F(Math.sin(a) * er * 0.42)}L${F(Math.cos(a + 0.5) * er * 0.9)} ${F(Math.sin(a + 0.5) * er * 0.9)}`; } g += `<path d="${bl}" stroke="#000" stroke-opacity=".28" stroke-width="1.1"/>`; }
    if (e.pupil) g += `<circle cy="${F(er * 0.06)}" r="${F(er * 0.36)}" fill="#05060a" opacity=".9"/>`;
    const mx = -rx * 0.34, my = -ry * 0.4;
    g += `<ellipse cx="${F(mx)}" cy="${F(my)}" rx="${F(er * 0.36)}" ry="${F(er * 0.27)}" transform="rotate(-22 ${F(mx)} ${F(my)})" fill="#fff" opacity=".95"/>`;
    if (e.star) g += `<path d="${star4(rx * 0.4, ry * 0.3, er * 0.24)}" fill="#fff" opacity=".9"/>`;
    else g += `<circle cx="${F(rx * 0.4)}" cy="${F(ry * 0.3)}" r="${F(er * 0.13)}" fill="#fff" opacity=".75"/>`;
    g += `<path d="M${F(-rx * 0.6)} ${F(ry * 0.45)}Q0 ${F(ry * 0.82)} ${F(rx * 0.6)} ${F(ry * 0.45)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.2"/>`;
  }
  const lid = e.lid != null ? e.lid : A.lid;
  if (lid > 0) {
    const ex = e.kind === 'lens' ? er + 1 : rx + 1, ey = e.kind === 'dark' || e.kind === 'tall' ? ry + 1 : er + 1;
    const y0 = -ey + 2 * ey * lid, w = ex * Math.sqrt(Math.max(0, 1 - (y0 / ey) * (y0 / ey)));
    g += `<path d="M${F(-w)} ${F(y0)}A${F(ex)} ${F(ey)} 0 ${lid > 0.5 ? 1 : 0} 1 ${F(w)} ${F(y0)}Z" fill="${lidC}"/><path d="M${F(-w - 0.5)} ${F(y0)}Q0 ${F(y0 + 2.2)} ${F(w + 0.5)} ${F(y0)}" fill="none" stroke="${darken(b, 0.6)}" stroke-width="1.7" stroke-linecap="round"/>`;
  }
  return g + '</g></g>';
}
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
  [-1, 1].forEach((s, i) => {
    const rot = A.rng() * 45;
    q += `<g transform="translate(${F(100 + s * dx)} ${F(y)})"><g class="pl-spin${i ? ' pl-rev' : ''}"><path d="${gearPath(ro, ri, 8)}" transform="rotate(${F(rot)})" fill="url(#pl-gear)" stroke="#5e4413" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/><circle r="${F(ro * 0.34)}" fill="${darken(A.pal.body, 0.55)}" stroke="#fbe0a6" stroke-opacity=".5" stroke-width="1"/></g></g>`;
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
function crownSVG(x, y) {
  return `<g transform="translate(${F(x)} ${F(y + 4)}) rotate(-10)"><path d="M-17 0L-17 -12L-12.5 -5.5L-8 -18L-4 -7L0 -20.5L4 -7L8 -18L12.5 -5.5L17 -12L17 0Z" fill="url(#pl-gold)" stroke="#5a3a04" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/><path d="M-16.5 -5H16.5" stroke="#7a4e06" stroke-width="1" opacity=".55"/><circle cx="-17" cy="-12.5" r="1.9" fill="#fff3b0"/><circle cx="-8" cy="-18.5" r="1.9" fill="#fff3b0"/><circle cx="0" cy="-21" r="2.1" fill="#fff3b0"/><circle cx="8" cy="-18.5" r="1.9" fill="#fff3b0"/><circle cx="17" cy="-12.5" r="1.9" fill="#fff3b0"/><circle cx="-8" cy="-2.6" r="2.6" fill="#ff4d6d"/><circle cx="0" cy="-2.6" r="2.6" fill="#3fe08a"/><circle cx="8" cy="-2.6" r="2.6" fill="#4aa8ff"/><circle cx="-8.8" cy="-3.4" r=".8" fill="#fff"/><circle cx="-.8" cy="-3.4" r=".8" fill="#fff"/><circle cx="7.2" cy="-3.4" r=".8" fill="#fff"/><path d="M-15.3 -2.5L-15.3 -9.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".75"/></g>`;
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
    q += `<path d="${barbs}" stroke="#f6e7d3" stroke-width="1.4" stroke-linecap="round" opacity=".95"/>`;
    q += `<path d="M${F(p0[0])} ${F(p0[1])}Q${F(p1[0])} ${F(p1[1])} ${F(p2[0])} ${F(p2[1])}q${F(s * 6)} -1 ${F(s * 4.5)} 5.5q${F(-s * 1.5)} 2.5 ${F(-s * 3.5)} .5" fill="none" stroke="${darken(A.pal.body, 0.42)}" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return q;
}
function prismShard(A, x, y, ang, h) {
  const b = A.pal.body, w = A.R * 0.22;
  const pts = [[0, 0], [w / 2, -h * 0.2], [w / 2, -h * 0.85], [0, -h], [-w / 2, -h * 0.85], [-w / 2, -h * 0.2]];
  return `<g transform="translate(${F(x)} ${F(y)}) rotate(${F(ang)})"><path d="${pathOf(pts, true)}" fill="${darken(b, 0.12)}" stroke="${darken(b, 0.6)}" stroke-width="3.6" stroke-linejoin="round" paint-order="stroke"/><path d="${pathOf([[0, 0], [0, -h], [-w / 2, -h * 0.85], [-w / 2, -h * 0.2]], true)}" fill="${lighten(b, 0.42)}"/><path d="M0 0V${F(-h)}" stroke="${lighten(b, 0.85)}" stroke-width=".9" opacity=".8"/><path d="M${F(-w / 2 + 1.5)} ${F(-h * 0.8)}L${F(-w / 2 + 1.5)} ${F(-h * 0.35)}" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".75"/></g>`;
}
function lumenRing(x, y) {
  return `<circle cx="${F(x)}" cy="${F(y)}" r="9" fill="none" stroke="#3d2410" stroke-width="5.5"/><circle cx="${F(x)}" cy="${F(y)}" r="9" fill="none" stroke="url(#pl-bronze)" stroke-width="3.5"/><path d="M${F(x - 7)} ${F(y - 5)}A9 9 0 0 1 ${F(x + 2)} ${F(y - 9)}" fill="none" stroke="#f3c98a" stroke-width="1" opacity=".8"/>`;
}
function wispFlame(A, x, y) {
  return `<g transform="translate(${F(x)} ${F(y + 3)})"><g class="pl-flicker"><path d="M0 0C-10 -3 -9 -14 -1 -17C-4 -12 4 -12 2 -23C12 -15 11 -3 0 0Z" fill="url(#pl-wflame)" stroke="${darken(A.pal.body, 0.35)}" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"/><path d="M-1 -4C-5 -6 -4 -11 0 -12" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".8"/></g></g>`;
}
function stalkEye(A, bx, by, ex, ey, er, delay) {
  const b = A.pal.body;
  const st = `<path d="M${F(bx - 4.2)} ${F(by)}Q${F((bx + ex) / 2 - 3)} ${F((by + ey) / 2)} ${F(ex - 2.2)} ${F(ey + er * 0.6)}L${F(ex + 2.2)} ${F(ey + er * 0.6)}Q${F((bx + ex) / 2 + 3)} ${F((by + ey) / 2)} ${F(bx + 4.2)} ${F(by)}Z" fill="url(#bd-${A.sid})" stroke="${darken(b, 0.6)}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/>`;
  return st + `<circle cx="${F(ex)}" cy="${F(ey)}" r="${F(er + 3)}" fill="${lighten(b, 0.25)}" stroke="${darken(b, 0.6)}" stroke-width="2"/>` + drawEye(A, { x: ex, y: ey, er, delay });
}

// ---- the seven species ----
const SPECIES_PARTS = {};
SPECIES_PARTS.cog = {
  geo(A) {
    const R = A.R, cy = 196 - R * 1.02, x0 = 100 - R, y0 = cy - R * 0.95, w = 2 * R, h = R * 1.9, r = R * 0.5;
    const d = `M${F(x0 + r)} ${F(y0)}H${F(x0 + w - r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0 + w)} ${F(y0 + r)}V${F(y0 + h - r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0 + w - r)} ${F(y0 + h)}H${F(x0 + r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0)} ${F(y0 + h - r)}V${F(y0 + r)}A${F(r)} ${F(r)} 0 0 1 ${F(x0 + r)} ${F(y0)}Z`;
    const two = A.rk >= 3;
    return { d, cy, sx: 100, sy: cy, headTop: { x: 100, y: y0 }, brow: y0 + 8, bw: R * 0.98, eyeY: cy - R * 0.32, er: two ? R * 0.24 : R * 0.32, two, mouthY: cy + R * 0.2, spec: { x: 100 - R * 0.55, y: y0 + R * 0.2 }, hot: { x: 100 - R * 0.82, y: cy - R * 0.05 }, scarAt: { x: 100 + R * 0.62, y: y0 + R * 0.4 } };
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
      q += `<path d="${pathOf(hex, true)}" fill="${lighten(b, 0.12)}" stroke="${darken(b, 0.6)}" stroke-width="1.4"/><circle cx="${F(hx)}" cy="${F(hy)}" r="1.6" fill="${darken(b, 0.5)}"/>`;
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
    if (K.two) for (const s of [-1, 1]) q += drawEye(A, { x: 100 + s * (K.er + 5), y: K.eyeY, er: K.er, kind: 'lens', star: A.rk >= 2 });
    else q += drawEye(A, { x: 100, y: K.eyeY, er: K.er, kind: 'lens', star: A.rk >= 2 });
    if (A.sick) return q + sickMouth(A, 100, my);
    const mw = R * 0.34;
    q += `<rect x="${F(100 - mw / 2)}" y="${F(my - 3.5)}" width="${F(mw)}" height="7" rx="3.5" fill="${darken(b, 0.62)}"/>`;
    q += `<path d="M${F(100 - 4.8)} ${F(my - 2)}v4M100 ${F(my - 2)}v4M${F(100 + 4.8)} ${F(my - 2)}v4" stroke="${lighten(b, 0.15)}" stroke-width="1.6" stroke-linecap="round"/>`;
    q += `<path d="M${F(100 + mw / 2 - 5.5)} ${F(my + 2.5)}l2.3 4.6l2.3 -4.6z" fill="#fff" stroke="${darken(b, 0.6)}" stroke-width=".6"/>`;
    return q;
  },
};
SPECIES_PARTS.scholar = {
  geo(A) {
    const R = A.R, cy = 196 - R * 1.02, rng = A.rng, jt = () => (rng() - 0.5) * 2 * R * 0.04;
    const by = cy + R * 0.95, tLx = 100 - R * 0.62 + jt(), tLy = cy - R * 1.32 + jt(), tRx = 100 + R * 0.62 + jt(), tRy = cy - R * 1.32 + jt(), dipY = cy - R * 0.86;
    const d = `M100 ${F(by)}C${F(100 - R * 0.62)} ${F(by)} ${F(100 - R * 0.95)} ${F(cy + R * 0.55)} ${F(100 - R * 0.9)} ${F(cy - R * 0.2)}C${F(100 - R * 0.87)} ${F(cy - R * 0.66)} ${F(100 - R * 0.8)} ${F(cy - R * 1.04)} ${F(tLx)} ${F(tLy)}Q${F(100 - R * 0.36)} ${F(cy - R * 1.0)} 100 ${F(dipY)}Q${F(100 + R * 0.36)} ${F(cy - R * 1.0)} ${F(tRx)} ${F(tRy)}C${F(100 + R * 0.8)} ${F(cy - R * 1.04)} ${F(100 + R * 0.87)} ${F(cy - R * 0.66)} ${F(100 + R * 0.9)} ${F(cy - R * 0.2)}C${F(100 + R * 0.95)} ${F(cy + R * 0.55)} ${F(100 + R * 0.62)} ${F(by)} 100 ${F(by)}Z`;
    const er = R * 0.28;
    return { d, cy, sx: 100, sy: cy, headTop: { x: 100, y: dipY }, brow: dipY + 6.5, bw: R * 0.84, eyeY: cy - R * 0.2, er, ex: er * 1.175, book: ['#b84a3a', '#3a6cb8', '#3f8f5a'][Math.floor(rng() * 3)], scarAt: { x: 100 + R * 0.6, y: cy - R * 0.62 } };
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
    const R = A.R, b = A.pal.body, cy = K.cy, disc = mix('#cdeee8', b, 0.1); let q = '';
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
    const rr = K.er * 1.65, notch = `M${F(100 - rr * 0.5)} ${F(K.eyeY + rr * 0.62)}L100 ${F(K.eyeY + rr * 1.12)}L${F(100 + rr * 0.5)} ${F(K.eyeY + rr * 0.62)}Z`;
    q += `<g fill="none" stroke="${darken(b, 0.35)}" stroke-width="4" stroke-linejoin="round"><circle cx="${F(100 - K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><circle cx="${F(100 + K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><path d="${notch}"/></g>`;
    q += `<g fill="${disc}"><circle cx="${F(100 - K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><circle cx="${F(100 + K.ex)}" cy="${F(K.eyeY)}" r="${F(rr)}"/><path d="${notch}"/></g>`;
    q += `<g fill="none" stroke="${darken(disc, 0.25)}" stroke-opacity=".45" stroke-width="1.2"><circle cx="${F(100 - K.ex)}" cy="${F(K.eyeY)}" r="${F(rr - 3)}"/><circle cx="${F(100 + K.ex)}" cy="${F(K.eyeY)}" r="${F(rr - 3)}"/></g>`;
    return q;
  },
  face(A, K) {
    const R = A.R, ey = K.eyeY; let q = blushAt(A, ey + K.er * 1.05, R * 0.5);
    for (const s of [-1, 1]) q += drawEye(A, { x: 100 + s * K.ex, y: ey, er: K.er, iris: A.hybrid ? irisFor(A, 100 + s) : 'pl-owl', star: A.rk >= 2, lidC: mix('#cdeee8', A.pal.body, 0.1) });
    if (A.rk >= 2) {
      let sp = ''; for (const s of [-1, 1]) sp += `<circle cx="${F(100 + s * K.ex)}" cy="${F(ey)}" r="${F(K.er + 3.2)}"/>`;
      q += `<g fill="none" stroke="#5a3a04" stroke-width="4.2">${sp}</g><g fill="none" stroke="#f5c451" stroke-width="2.2">${sp}<path d="M${F(100 - K.ex + K.er + 3)} ${F(ey - 2)}Q100 ${F(ey - 8)} ${F(100 + K.ex - K.er - 3)} ${F(ey - 2)}"/></g><circle cx="${F(100 - K.ex - K.er * 0.6)}" cy="${F(ey - K.er * 0.85)}" r="1.2" fill="#fff6c8"/><circle cx="${F(100 + K.ex - K.er * 0.6)}" cy="${F(ey - K.er * 0.85)}" r="1.2" fill="#fff6c8"/>`;
    }
    const by = ey + K.er * 0.95;
    q += `<path d="M100 ${F(by - 6)}L104.6 ${F(by)}L100 ${F(by + 7)}L95.4 ${F(by)}Z" fill="url(#pl-beak)" stroke="#6b4a12" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/><path d="M98.6 ${F(by - 3)}L100 ${F(by - 4.6)}" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".8"/>`;
    if (A.sick) q += sickMouth(A, 100, by + 12);
    return q;
  },
};
SPECIES_PARTS.moth = {
  geo(A) {
    const R = A.R, cy = 196 - R * 0.97, r = R * 0.97, rng = A.rng, pts = [];
    for (let i = 0; i < 30; i++) { const a = -Math.PI / 2 + (Math.PI * 2 * i) / 30, rr = (i % 2 ? r * 0.92 : r) * (1 + (rng() - 0.5) * 0.03); pts.push({ x: 100 + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.96 }); }
    const top = cy - r * 0.94;
    return { d: smoothClosedPath(pts), cy, sx: 100, sy: cy, headTop: { x: 100, y: top }, brow: top + 10, bw: R * 0.6, eyeY: cy - R * 0.34, er: R * 0.3, ex: R * 0.3 * 1.25, flap: (rng() - 0.5) * 8 };
  },
  ornament(A, K) { return mothAntennae(A, 100, K.headTop.y); },
  back(A, K) {
    const R = A.R, b = A.pal.body, cy = K.cy, X = (o) => 100 - o, s = A.sid;
    const up = `M${F(X(R * 0.4))} ${F(cy - R * 0.35)}C${F(X(R * 0.85))} ${F(cy - R * 1.25)} ${F(X(R * 1.4))} ${F(cy - R * 1.38)} ${F(X(R * 1.6))} ${F(cy - R * 1.12)}C${F(X(R * 1.74))} ${F(cy - R * 0.85)} ${F(X(R * 1.72))} ${F(cy - R * 0.08)} ${F(X(R * 1.52))} ${F(cy + R * 0.1)}C${F(X(R * 1.2))} ${F(cy + R * 0.28)} ${F(X(R * 0.8))} ${F(cy + R * 0.15)} ${F(X(R * 0.5))} ${F(cy + R * 0.05)}Z`;
    const lo = `M${F(X(R * 0.45))} ${F(cy + R * 0.02)}C${F(X(R * 1.0))} ${F(cy + R * 0.05)} ${F(X(R * 1.38))} ${F(cy + R * 0.45)} ${F(X(R * 1.18))} ${F(cy + R * 0.78)}C${F(X(R * 1.0))} ${F(cy + R * 0.98)} ${F(X(R * 0.62))} ${F(cy + R * 0.8)} ${F(X(R * 0.42))} ${F(cy + R * 0.45)}Z`;
    const icx = X(R * 1.1), icy = cy - R * 0.55;
    let wing = `<path d="${lo}" fill="url(#wg-${s})" stroke="${darken(b, 0.55)}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/><path d="${lo}" fill="none" stroke="${lighten(b, 0.6)}" stroke-width="1.4"/>`;
    wing += `<path d="${up}" fill="url(#wg-${s})" stroke="${darken(b, 0.55)}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/><path d="${up}" fill="none" stroke="${lighten(b, 0.6)}" stroke-width="1.5"/>`;
    wing += `<path d="${up}" transform="translate(${F(icx)} ${F(icy)}) scale(.74) translate(${F(-icx)} ${F(-icy)})" fill="none" stroke="${lighten(b, 0.65)}" stroke-width="1.3" stroke-dasharray="3 3" opacity=".5"/>`;
    wing += `<path d="M${F(X(R * 0.45))} ${F(cy - R * 0.28)}Q${F(X(R * 1.0))} ${F(cy - R * 0.9)} ${F(X(R * 1.5))} ${F(cy - R * 1.02)}M${F(X(R * 0.45))} ${F(cy - R * 0.25)}Q${F(X(R * 1.1))} ${F(cy - R * 0.5)} ${F(X(R * 1.66))} ${F(cy - R * 0.45)}M${F(X(R * 0.45))} ${F(cy - R * 0.2)}Q${F(X(R * 1.0))} ${F(cy - R * 0.05)} ${F(X(R * 1.45))} ${F(cy + R * 0.05)}M${F(X(R * 0.5))} ${F(cy + R * 0.12)}Q${F(X(R * 0.85))} ${F(cy + R * 0.3)} ${F(X(R * 1.1))} ${F(cy + R * 0.65)}" fill="none" stroke="${lighten(b, 0.7)}" stroke-width="1" opacity=".4"/>`;
    if (A.rk >= 2) { const ex = X(R * 1.18), ey = cy - R * 0.6; wing += `<circle cx="${F(ex)}" cy="${F(ey)}" r="9.5" fill="#f6e7d3" stroke="${darken(b, 0.45)}" stroke-width="1"/><circle cx="${F(ex)}" cy="${F(ey)}" r="6.2" fill="${darken(b, 0.6)}"/><circle cx="${F(ex)}" cy="${F(ey)}" r="3.6" fill="${A.rk >= 3 ? '#b9a6ff' : lighten(b, 0.2)}"/><circle cx="${F(ex - 1.2)}" cy="${F(ey - 1.2)}" r="1.6" fill="#fff"/>`; const lx = X(R * 0.95), ly = cy + R * 0.5; wing += `<circle cx="${F(lx)}" cy="${F(ly)}" r="5" fill="#f6e7d3"/><circle cx="${F(lx)}" cy="${F(ly)}" r="2.8" fill="${darken(b, 0.6)}"/>`; }
    const tr = `rotate(${F(K.flap)} ${F(X(R * 0.45))} ${F(cy - R * 0.2)})`;
    return `<g transform="${tr}"><g class="pl-wing">${wing}</g></g><g transform="matrix(-1 0 0 1 200 0)"><g transform="${tr}"><g class="pl-wing">${wing}</g></g></g>`;
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
    for (const s of [-1, 1]) q += drawEye(A, { x: 100 + s * K.ex, y: ey, er: K.er, star: A.rk >= 2 });
    const my = ey + K.er + 3.5;
    q += A.sick ? sickMouth(A, 100, my + 1) : `<path d="M94.5 ${F(my)}Q97.2 ${F(my + 3.6)} 100 ${F(my)}Q102.8 ${F(my + 3.6)} 105.5 ${F(my)}" fill="none" stroke="${darken(A.pal.body, 0.6)}" stroke-width="1.8" stroke-linecap="round"/>`;
    return q;
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
    return { d: pathOf(P, true), P, cy, sx: 100, sy: cy, Fc: [100 - R * 0.12, cy - R * 0.18], headTop: { x: P[0][0], y: P[0][1] }, brow: cy - R * 0.5, bw: R * 0.78, eyeY: cy - R * 0.14, er: R * 0.25, ex: R * 0.25 * 1.2, hot: { x: 100 - R * 0.6, y: cy - R * 0.1 }, scarAt: { x: 100 + R * 0.55, y: cy - R * 0.38 } };
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
    for (const s of [-1, 1]) q += drawEye(A, { x: 100 + s * K.ex, y: ey, er: K.er, star: true });
    const my = ey + K.er + 5;
    q += A.sick ? sickMouth(A, 100, my) : `<path d="M95 ${F(my - 1)}Q100 ${F(my + 3.5)} 105 ${F(my - 1)}" fill="none" stroke="${darken(A.pal.body, 0.65)}" stroke-width="2.2" stroke-linecap="round"/><path d="${star4(107.5, my - 2.5, 2)}" fill="#fff"/>`;
    return q;
  },
};
SPECIES_PARTS.lumen = {
  geo(A) {
    const R = A.R, cy = 128, rx = R * 0.9, ry = R * 0.98, capBot = cy - ry + 6, capTop = capBot - R * 0.28, ringY = capTop - 7;
    const d = `M${F(100 - rx)} ${cy}A${F(rx)} ${F(ry)} 0 1 1 ${F(100 + rx)} ${cy}A${F(rx)} ${F(ry)} 0 1 1 ${F(100 - rx)} ${cy}Z`;
    const leg = A.T === 'Legendary';
    return { d, cy, rx, ry, capBot, capTop, ringY, sx: 100, sy: cy, headTop: { x: 100, y: leg ? capTop : ringY - 10.7 }, brow: cy - R * 0.6, bw: R * 0.72, eyeY: cy - R * 0.06, er: R * 0.2, spec: { x: 100 - R * 0.42, y: cy - R * 0.5 }, scarAt: { x: 100 + R * 0.5, y: cy - R * 0.45 } };
  },
  aura(A, K) { return `<circle cx="100" cy="${F(K.cy)}" r="${F(A.R + 36)}" fill="url(#la-${A.sid})"/>`; },
  ornament(A, K) { return A.T === 'Legendary' ? '' : lumenRing(100, K.ringY); },
  detail(A, K) {
    const R = A.R, cy = K.cy, rx = K.rx, ry = K.ry; let q = '';
    q += `<g transform="translate(100 ${F(cy + R * 0.62)}) scale(1.05)"><g class="pl-flicker"><path d="M0 10C8 2 6 -8 0 -16C-6 -8 -8 2 0 10Z" fill="url(#pl-flame)" opacity=".7"/></g></g>`;
    const offs = A.rk >= 2 ? [-0.8, -0.4, 0.4, 0.8] : [-0.62, 0.62];
    let bars = ''; for (const o of offs) bars += `M${F(100 + o * rx * 0.62)} ${F(K.capBot - 2)}Q${F(100 + o * rx * 1.28)} ${F(cy)} ${F(100 + o * rx * 0.66)} ${F(cy + ry - 5)}`;
    if (A.rk >= 2) bars += `M${F(100 - rx * 0.92)} ${F(cy + R * 0.38)}Q100 ${F(cy + R * 0.6)} ${F(100 + rx * 0.92)} ${F(cy + R * 0.38)}`;
    q += `<path d="${bars}" fill="none" stroke="#2a180a" stroke-width="5" stroke-linecap="round" opacity=".55"/><path d="${bars}" fill="none" stroke="#4a2c12" stroke-width="3.2" stroke-linecap="round"/><path d="${bars}" transform="translate(-.9 -.3)" fill="none" stroke="#c98a4a" stroke-width="1" stroke-linecap="round"/>`;
    const tw = R * 0.7, bw = R * 1.2;
    q += `<path d="M${F(100 - tw / 2)} ${F(K.capTop)}L${F(100 + tw / 2)} ${F(K.capTop)}L${F(100 + bw / 2)} ${F(K.capBot)}L${F(100 - bw / 2)} ${F(K.capBot)}Z" fill="url(#pl-bronze)" stroke="#2a180a" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/><rect x="${F(100 - bw / 2 - 2)}" y="${F(K.capBot - 3)}" width="${F(bw + 4)}" height="5" rx="2.5" fill="#8a5a24" stroke="#2a180a" stroke-width="1.2"/><path d="M${F(100 - tw / 2 + 3)} ${F(K.capTop + 2.5)}L${F(100 - bw / 2 + 6)} ${F(K.capBot - 4)}" stroke="#f3c98a" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`;
    return q;
  },
  front(A, K) {
    const R = A.R, cy = K.cy, ry = K.ry, top = cy + ry - 7, tw = R * 1.05, bw = R * 0.72; let q = '';
    for (const s of [-1, 1]) q += `<ellipse cx="${F(100 + s * R * 0.24)}" cy="194" rx="5" ry="3" fill="#3d2410"/>`;
    q += `<path d="M${F(100 - tw / 2)} ${F(top)}L${F(100 + tw / 2)} ${F(top)}L${F(100 + bw / 2)} 192L${F(100 - bw / 2)} 192Z" fill="url(#pl-bronze)" stroke="#2a180a" stroke-width="3" stroke-linejoin="round" paint-order="stroke"/><path d="M${F(100 - tw / 2 + 4)} ${F(top + 2)}H${F(100 + tw / 2 - 4)}" stroke="#f3c98a" stroke-width="1.2" opacity=".7"/>`;
    if (A.rk >= 2) for (const s of [-1, 1]) { const x = 100 + s * R * 0.62, y = cy + ry * 0.62; q += `<path d="${dropP(x, y, 9)}" fill="url(#pl-drip)" stroke="#8a3a0c" stroke-width="1.6" paint-order="stroke"/><circle cx="${F(x - 1.2)}" cy="${F(y + 7.5)}" r="1.1" fill="#fff6d8"/>`; }
    if (A.rk >= 3) for (let i = 0; i < 6; i++) { const x = 100 + (A.rng() - 0.5) * R * 1.3, y = K.capTop - 4 - A.rng() * 22; q += `<circle class="pl-rise" cx="${F(x)}" cy="${F(y)}" r="${F(1.2 + A.rng() * 1.2)}" fill="#ffd27a" style="animation-delay:-${F(i * 0.42)}s"/>`; }
    return q;
  },
  face(A, K) {
    const R = A.R, ey = K.eyeY, ex = K.er * 1.15; let q = '';
    for (const s of [-1, 1]) q += drawEye(A, { x: 100 + s * ex, y: ey, er: K.er, kind: A.hybrid ? undefined : 'dark', lidC: '#ffd68a' });
    const my = K.cy + R * 0.2;
    q += A.sick ? sickMouth(A, 100, my) : `<ellipse cx="100" cy="${F(my)}" rx="4.6" ry="5" fill="#fffbe8" stroke="#7a3a10" stroke-width="1.6"/><ellipse cx="100" cy="${F(my)}" rx="7.5" ry="8" fill="none" stroke="#fff2a0" stroke-width="2" opacity=".35"/>`;
    return q;
  },
};
SPECIES_PARTS.hydra = {
  geo(A) {
    const R = A.R, cy = 196 - R * 1.02, top = cy - R * 0.95, sideY = cy + R * 0.55, rimY = cy + R * 0.9, rng = A.rng;
    let d = `M${F(100 - R * 1.15)} ${F(rimY)}C${F(100 - R * 1.02)} ${F(cy + R * 0.78)} ${F(100 - R * 0.96)} ${F(cy + R * 0.68)} ${F(100 - R * 0.95)} ${F(sideY)}C${F(100 - R * 0.98)} ${F(cy - R * 0.3)} ${F(100 - R * 0.55)} ${F(top)} 100 ${F(top)}C${F(100 + R * 0.55)} ${F(top)} ${F(100 + R * 0.98)} ${F(cy - R * 0.3)} ${F(100 + R * 0.95)} ${F(sideY)}C${F(100 + R * 0.96)} ${F(cy + R * 0.68)} ${F(100 + R * 1.02)} ${F(cy + R * 0.78)} ${F(100 + R * 1.15)} ${F(rimY)}`;
    const seg = (2.3 * R) / 4; for (let k = 0; k < 4; k++) { const xa = 100 + R * 1.15 - k * seg, xb = xa - seg, amp = 4 + rng() * 3; d += `Q${F((xa + xb) / 2)} ${F(rimY + (k % 2 ? -amp : amp))} ${F(xb)} ${F(rimY)}`; }
    d += 'Z';
    const n = { Common: 3, Uncommon: 4, Rare: 5, Epic: 6, Mythic: 7, Legendary: 7 }[A.T], stalks = A.rk >= 2 && !A.other ? 2 : 0;
    const eyes = [{ x: 100, y: cy - R * 0.28, er: R * 0.24 }];
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
    return { d, cy, sx: 100, sy: cy, rimY, top, eyes, st, headTop: { x: 100, y: top }, brow: cy - R * 0.62, bw: R * 0.78, eyeY: cy - R * 0.28, er: R * 0.24, nuc: blobPoints(100 + (rng() - 0.5) * 8, cy + R * 0.2, R * 0.3, 8, 0.2, rng), bub: [0, 1, 2, 3, 4].map(() => [100 + (rng() * 2 - 1) * R * 0.7, cy + R * (0.05 + rng() * 0.55), 2 + rng() * 4]), scarAt: { x: 100 + R * 0.58, y: cy - R * 0.55 } };
  },
  ornament(A, K) { let q = ''; for (const e of K.st) q += stalkEye(A, e.bx, e.by, e.x, e.y, e.er, e.delay); return q; },
  back(A, K) {
    const R = A.R, b = A.pal.body, cy = K.cy; let q = '';
    if (A.rk >= 2) {
      const tf = `fill="url(#bd-${A.sid})" stroke="${darken(b, 0.6)}" stroke-width="3" stroke-linejoin="round" paint-order="stroke"`;
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
    if (A.sick) return q + sickMouth(A, 100, my + 3);
    const w = R * 0.25;
    q += `<path d="M${F(100 - w)} ${F(my)}Q100 ${F(my + R * 0.3)} ${F(100 + w)} ${F(my)}Q100 ${F(my + R * 0.08)} ${F(100 - w)} ${F(my)}Z" fill="#0d2417" stroke="${darken(A.pal.body, 0.55)}" stroke-width="1.4" stroke-linejoin="round"/>`;
    q += `<path d="M${F(100 - R * 0.13 - 2.4)} ${F(my + 2.2)}l2.4 4.6l2.4 -4.6zM${F(100 + R * 0.13 - 2.4)} ${F(my + 2.2)}l2.4 4.6l2.4 -4.6z" fill="#fff"/>`;
    q += `<path d="${dropP(100 + w - 2, my + 2, 6)}" fill="#c4ffd9" opacity=".85"/>`;
    return q;
  },
};
SPECIES_PARTS.wisp = {
  geo(A) {
    const R = A.R, cy = 128, s = A.rng() < 0.5 ? -1 : 1, X = (o) => 100 + s * o;
    const d = `M${F(X(-R))} ${cy}A${F(R)} ${F(R)} 0 0 ${s > 0 ? 1 : 0} ${F(X(R))} ${cy}L${F(X(R * 0.98))} ${F(cy + R * 0.7)}Q${F(X(R * 0.75))} ${F(cy + R * 0.98)} ${F(X(R * 0.5))} ${F(cy + R * 0.74)}Q${F(X(R * 0.25))} ${F(cy + R * 1.0)} ${F(X(0))} ${F(cy + R * 0.76)}Q${F(X(-R * 0.25))} ${F(cy + R * 1.02)} ${F(X(-R * 0.5))} ${F(cy + R * 0.8)}Q${F(X(-R * 0.82))} ${F(cy + R * 1.1)} ${F(X(-R * 1.14))} ${F(cy + R * 0.9)}Q${F(X(-R * 1.32))} ${F(cy + R * 0.8)} ${F(X(-R * 1.2))} ${F(cy + R * 0.6)}Q${F(X(-R * 1.06))} ${F(cy + R * 0.74)} ${F(X(-R * 0.98))} ${F(cy + R * 0.5)}Z`;
    return { d, cy, sx: 100, sy: cy, float: true, headTop: { x: 100, y: cy - R }, brow: cy - R * 0.5, bw: R * 0.86, eyeY: cy - R * 0.06, er: R * 0.27, scarAt: { x: 100 + R * 0.55, y: cy - R * 0.5 } };
  },
  ornament(A, K) { return wispFlame(A, K.headTop.x + (A.T === 'Legendary' ? A.R * 0.36 : 0), K.headTop.y + (A.T === 'Legendary' ? 6 : 0)); },
  detail(A, K) { return `<circle cx="100" cy="${F(K.cy - A.R * 0.25)}" r="${F(A.R * 0.5)}" fill="url(#pl-glow-w)" opacity=".75"/>`; },
  face(A, K) {
    const R = A.R, ey = K.eyeY, ex = K.er * 0.95; let q = blushAt(A, ey + K.er * 1.15, R * 0.48);
    for (const s of [-1, 1]) q += drawEye(A, { x: 100 + s * ex, y: ey, er: K.er, kind: 'tall', star: A.rk >= 2 });
    const my = K.cy + R * 0.32;
    q += A.sick ? sickMouth(A, 100, my) : `<ellipse cx="100" cy="${F(my)}" rx="3.6" ry="4.6" fill="#1a1330"/><ellipse cx="100" cy="${F(my + 2)}" rx="2" ry="1.6" fill="#ff8fb0" opacity=".8"/>`;
    return q;
  },
  front(A, K) {
    const n = [0, 1, 3, 5, 5][A.rk], R = A.R; let q = '';
    for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + 0.7 * A.rng()) + (i % 2 ? 0 : Math.PI * 0.05), rr = R * (1.08 + A.rng() * 0.3), side = i % 2 ? 1 : -1; const x = 100 + side * Math.abs(Math.cos(a)) * rr, y = K.cy + Math.sin(a) * rr * 0.9 + R * 0.2; q += `<path class="pl-twinkle" d="${star4(x, y, 3 + A.rng() * 3)}" fill="#efe8ff" style="animation-delay:-${F(i * 0.37)}s"/>`; }
    return q;
  },
};

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
    const mx = ht.x + R * 0.55, my = ht.y - 4;
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
  return q;
}
function drawBand(A, K) {
  const R = A.R, y = K.brow, s = A.sid, bd = `M${F(100 - R * 1.25)} ${F(y + 5)}Q100 ${F(y - 6)} ${F(100 + R * 1.25)} ${F(y + 5)}`, kx = 100 + K.bw, ky = y + 2.5;
  return `<g clip-path="url(#cl-${s})"><path d="${bd}" fill="none" stroke="#a83a35" stroke-width="9"/><path d="${bd}" fill="none" stroke="#e8615b" stroke-width="7"/><path d="${bd}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".9"/></g><path d="M${F(kx - 2)} ${F(ky - 2)}Q${F(kx + 8)} ${F(ky - 9)} ${F(kx + 14)} ${F(ky - 3)}Q${F(kx + 7)} ${F(ky - 1)} ${F(kx + 1)} ${F(ky + 2)}ZM${F(kx - 1)} ${F(ky + 1)}Q${F(kx + 7)} ${F(ky + 3)} ${F(kx + 11)} ${F(ky + 10)}Q${F(kx + 4)} ${F(ky + 7)} ${F(kx - 2)} ${F(ky + 4)}Z" fill="#e8615b" stroke="#a83a35" stroke-width="2" stroke-linejoin="round" paint-order="stroke"/><circle cx="${F(kx - 1)}" cy="${F(ky + 1)}" r="3" fill="#d24f49" stroke="#a83a35" stroke-width="1"/><path d="${dropP(100 - R * 0.62, y + 8, 7)}" fill="#bfe6ff" stroke="#4d86b3" stroke-width="1.2" paint-order="stroke"/>`;
}
function drawSwarm(A, K, front) {
  const R = A.R, c = A.c, n = Math.max(3, Math.min(6, (c.features && c.features.orbiters) || c.subagents || 4)), rot = (-12 * Math.PI) / 180;
  let q = front ? '' : `<ellipse cx="100" cy="${F(K.cy)}" rx="${F(R + 28)}" ry="16" transform="rotate(-12 100 ${F(K.cy)})" fill="none" stroke="${lighten(A.pal.glow, 0.3)}" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="3 4"/>`;
  const r0 = rngFor(((c.seed >>> 0) ^ 0x51ed) >>> 0)();
  for (let i = 0; i < n; i++) {
    const t = (Math.PI * 2 * i) / n + r0 * 6.28, ox = Math.cos(t) * (R + 28), oy = Math.sin(t) * 16, x = 100 + ox * Math.cos(rot) - oy * Math.sin(rot), y = K.cy + ox * Math.sin(rot) + oy * Math.cos(rot);
    if ((y > K.cy) !== front) continue;
    q += `<g class="pl-orbit" style="animation-delay:-${F(i * 0.4)}s"><circle cx="${F(x)}" cy="${F(y)}" r="5.5" fill="url(#bd-${A.sid})" stroke="${darken(A.pal.body, 0.6)}" stroke-width="1.2"/><circle cx="${F(x)}" cy="${F(y)}" r="4.6" fill="none" stroke="${A.rimC}" stroke-opacity=".6" stroke-width=".8"/><circle cx="${F(x + 0.4)}" cy="${F(y - 0.2)}" r="2.2" fill="#10121a"/><circle cx="${F(x - 0.3)}" cy="${F(y - 0.9)}" r=".8" fill="#fff"/></g>`;
  }
  return q;
}
const CREST = {
  cog: (A, K) => cogGears(A, K.headTop.y + 6, A.R * 0.5, 0.85),
  scholar: (A, K) => { const R = A.R, y = K.headTop.y; let q = ''; for (const s of [-1, 1]) q += `<path d="M${F(100 + s * R * 0.12)} ${F(y + 10)}Q${F(100 + s * R * 0.42)} ${F(y - 4)} ${F(100 + s * R * 0.6)} ${F(y - 22)}Q${F(100 + s * R * 0.66)} ${F(y)} ${F(100 + s * R * 0.62)} ${F(y + 14)}Z" fill="url(#bd-${A.sid})" stroke="${darken(A.pal.body, 0.6)}" stroke-width="4.5" stroke-linejoin="round" paint-order="stroke"/>`; return q; },
  moth: (A, K) => mothAntennae(A, 100, K.headTop.y),
  prism: (A, K) => { const R = A.R, y = K.headTop.y + 10; return prismShard(A, 100 - 13, y, -26, R * 0.5) + prismShard(A, 100 + 13, y, 26, R * 0.5) + prismShard(A, 100, y - 2, 0, R * 0.72); },
  lumen: (A, K) => lumenRing(100, K.headTop.y - 4),
  hydra: (A, K) => { const R = A.R, y = K.headTop.y; return stalkEye(A, 100 - R * 0.28, y + 10, 100 - R * 0.42, y - 14, R * 0.12, 0.7) + stalkEye(A, 100 + R * 0.28, y + 10, 100 + R * 0.44, y - 17, R * 0.13, 2.1); },
  wisp: (A, K) => wispFlame(A, 100, K.headTop.y + 4),
};

function creatureInner(c, rng) {
  const A = artCtx(c, rng), SP = SPECIES_PARTS[A.sk], K = SP.geo(A), R = A.R, s = A.sid, b = A.pal.body, T = A.T, rk = A.rk, g = A.pal.glow;
  // per-creature defs (palette-dependent only; static ones live in PL_DEFS)
  const d = [`<path id="b-${s}" d="${K.d}"/>`, `<clipPath id="cl-${s}"><use href="#b-${s}"/></clipPath>`];
  if (A.hybrid) { const pa = ART_PAL[A.pk[0]].body, pb = ART_PAL[A.pk[1]].body; d.push(LG(`bd-${s}`, [0, 0, 1, 1], [[0.1, pa], [0.5, mix(pa, pb, 0.5)], [0.9, pb]])); }
  else if (A.sk === 'hydra') d.push(RG(`bd-${s}`, ['40%', '30%', '80%'], [[0, lighten(b, 0.65), 0.95], [0.45, lighten(b, 0.1), 0.88], [1, darken(b, 0.6), 0.95]]));
  else if (A.sk === 'wisp') d.push(LG(`bd-${s}`, [0, 0, 0, 1], [[0, lighten(b, 0.35), 0.97], [0.55, b, 0.92], [1, b, 0.25]]), LG(`wo-${s}`, [0, 0, 0, 1], [[0, darken(b, 0.6)], [0.6, darken(b, 0.6), 0.9], [1, darken(b, 0.6), 0.1]]));
  else if (A.sk === 'lumen') d.push(RG(`bd-${s}`, ['50%', '55%', '58%'], [[0, '#fffbe8'], [0.25, '#ffe39a'], [0.55, '#ffb24a'], [0.85, '#e0701c'], [1, '#8a3a0c']]));
  else d.push(RG(`bd-${s}`, ['36%', '26%', '88%', '32%', '22%'], [[0, lighten(b, 0.55)], [0.2, lighten(b, 0.22)], [0.55, b], [0.82, darken(b, 0.28)], [1, darken(b, 0.5)]]));
  d.push(LG(`rim-${s}`, [0, 0, 1, 1], [[0, A.rimC, 0], [0.55, A.rimC, 0], [0.8, A.rimC, 0.55], [1, A.rimC, 0.95]]));
  const irisG = (id, ic) => RG(id, ['50%', '80%', '70%'], [[0, lighten(ic, 0.25)], [0.35, ic], [0.62, darken(ic, 0.55)], [0.8, '#07080d'], [1, '#000']]);
  d.push(irisG(`ir-${s}`, A.iris)); if (A.hybrid) d.push(irisG(`ir2-${s}`, A.iris2));
  if (A.sk === 'moth') d.push(LG(`wg-${s}`, [1, 0, 0, 0.3], [[0, darken(b, 0.15)], [0.5, lighten(b, 0.25)]].concat(rk >= 3 ? [[0.72, '#b9a6ff', 0.85]] : []).concat([[1, lighten(b, 0.5)]])));
  if (A.sk === 'lumen') d.push(RG(`la-${s}`, ['50%', '50%', '50%'], [[0, g, 0.55], [0.5, g, 0.15], [1, g, 0]]));
  const auraC = T === 'Legendary' ? mix(g, '#f5c451', 0.6) : T === 'Mythic' ? mix(g, '#ff7bd0', 0.6) : mix(g, '#a970ff', 0.5);
  if (rk >= 3) d.push(RG(`au-${s}`, ['50%', '50%', '50%'], [[0, auraC, 0.5], [0.55, auraC, 0.14], [1, auraC, 0]]));

  const q = [`<defs>${d.join('')}</defs><g style="--d:-${F(((c.seed >>> 0) % 4000) / 1000)}s">`];
  // stage: beams, aura, plinth, floor ring, contact shadow
  if (SP.aura) q.push(SP.aura(A, K));
  if (rk >= 3) q.push(`<circle cx="100" cy="${F(K.cy)}" r="${F(R + 40)}" fill="url(#au-${s})"/>`);
  const pr = T === 'Legendary' ? ' stroke="#f5c451" stroke-width="1.5"' : T === 'Mythic' ? ' stroke="#ff7bd0" stroke-opacity=".6" stroke-width="1.5"' : T === 'Epic' ? ' stroke="#b28dff" stroke-opacity=".5" stroke-width="1.5"' : '';
  q.push(`<ellipse cx="100" cy="203.5" rx="70" ry="11" fill="#090b10"/><ellipse cx="100" cy="200" rx="70" ry="11" fill="url(#pl-plinth)"${pr}/><ellipse cx="100" cy="199.6" rx="67" ry="9.6" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1"/>`);
  if (rk >= 3) q.push(`<ellipse cx="100" cy="192" rx="${F(R + 14)}" ry="${F(R * 0.3)}" fill="none" stroke="${T === 'Legendary' ? '#f5c451' : T === 'Mythic' ? '#ff7bd0' : '#b28dff'}" stroke-opacity=".45" stroke-width="1.5"/>`);
  q.push(K.float ? `<g opacity=".5"><ellipse cx="100" cy="197" rx="${F(R * 0.55)}" ry="6" fill="url(#pl-cs)"/></g>` : `<ellipse cx="100" cy="197" rx="${F(R * 0.85)}" ry="7.5" fill="url(#pl-cs)"/><ellipse cx="100" cy="196.5" rx="${F(R * 0.45)}" ry="3.5" fill="#000" opacity=".35"/>`);
  const swarm = A.tr.includes('Swarm');
  if (swarm) q.push(drawSwarm(A, K, false));
  // the creature
  q.push(`<g class="pl-bob${K.float ? ' pl-float' : ''}"><g class="pl-breathe">`);
  if (A.sick) q.push('<g transform="translate(100 196) scale(1.03 .95) translate(-100 -196)">');
  q.push(`<g transform="rotate(${F(A.tilt)} 100 ${K.float ? F(K.cy) : 196})">`);
  if (SP.back) q.push(SP.back(A, K));
  q.push(A.other ? CREST[A.other](A, K) : SP.ornament ? SP.ornament(A, K) : '');
  q.push(vinylStack(A, K, { inner: SP.inner ? SP.inner(A, K) : null, noSpec: A.sk === 'prism', noAO: A.sk === 'wisp' || A.sk === 'lumen', gloss: A.sk === 'hydra', outline: A.sk === 'wisp' ? `url(#wo-${s})` : A.sk === 'lumen' ? '#5a2a08' : null }));
  if (A.sick) q.push(`<use href="#b-${s}" fill="#6f8f5a" opacity=".3" style="mix-blend-mode:multiply"/>`);
  if (SP.detail) q.push(SP.detail(A, K));
  if (A.tr.includes('Marathon')) q.push(drawBand(A, K));
  if (T === 'Legendary' || T === 'Mythic') q.push(`<g clip-path="url(#cl-${s})" style="mix-blend-mode:overlay"><rect class="pl-foil" x="-160" y="0" width="520" height="220" fill="url(#pl-foil-${T === 'Mythic' ? 'm' : 'l'})" opacity=".55"/></g>`);
  q.push(SP.face(A, K));
  if (SP.front) q.push(SP.front(A, K));
  q.push(drawTraits(A, K));
  if (T === 'Legendary') q.push(crownSVG(K.headTop.x, K.headTop.y));
  if (T === 'Mythic') { const hx = K.headTop.x, hy = K.headTop.y - 14; q.push(`<circle cx="${F(hx)}" cy="${F(hy)}" r="24" fill="url(#pl-myth)"/><ellipse cx="${F(hx)}" cy="${F(hy)}" rx="16" ry="4.5" fill="none" stroke="#ff7bd0" stroke-width="2.5"/><ellipse cx="${F(hx)}" cy="${F(hy)}" rx="16" ry="4.5" fill="none" stroke="#fff" stroke-width=".8" opacity=".8"/>`); }
  q.push('</g>' + (A.sick ? '</g>' : '') + '</g></g>');
  // particles + front drones
  if (rk >= 3) {
    let p = '';
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2, rr = R + 12 + rng() * 18, x = 100 + Math.cos(a) * rr; let y = K.cy + Math.sin(a) * rr * 0.85; if (y > 184) y = 184 - rng() * 30;
      const sz = 1.2 + rng() * 1.2, col = T === 'Mythic' ? (i % 2 ? '#ff9be0' : '#7bf0ff') : T === 'Legendary' ? '#ffe7a0' : lighten(g, 0.4);
      const shape = T === 'Mythic' && i % 2 ? heartP(x, y, sz * 1.6) : rng() < 0.6 ? star4(x, y, sz * 2.4) : null;
      p += shape ? `<path class="pl-twinkle" d="${shape}" fill="${col}" style="animation-delay:-${F(i * 0.31)}s"/>` : `<circle class="pl-twinkle" cx="${F(x)}" cy="${F(y)}" r="${F(sz)}" fill="${col}" style="animation-delay:-${F(i * 0.31)}s"/>`;
    }
    q.push(p);
  }
  if (swarm) q.push(drawSwarm(A, K, true));
  q.push('</g>');
  return q.join('');
}
function creatureSVG(c, size, opts) {
  ensurePlDefs();
  return `<svg class="art${opts && opts.live ? ' live' : ''}" viewBox="0 0 200 220" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${creatureInner(c, rngFor(c.seed))}</svg>`;
}
// ==== ART END ====
let ART = {};
async function loadArt() { try { const m = await (await fetch('/creatures/manifest.json')).json(); ART = (m && m.species) || {}; } catch { ART = {}; } }
// Tiles, modals and cards always use the procedural SVG (it carries per-seed rarity, trait and animation
// layers). A manifest PNG, if one is ever added, is only used for the home hero.
function creatureVisual(c, size, opts) {
  const a = opts && opts.hero ? ART[c.speciesKey + '_' + c.rarity.tier.toLowerCase()] || ART[c.speciesKey] : null;
  if (!a) return creatureSVG(c, size, opts);
  return `<svg class="art" viewBox="0 0 200 220" width="${size}" height="${size}"><image href="/creatures/${a}" x="16" y="8" width="168" height="188" preserveAspectRatio="xMidYMid meet"/></svg>`;
}

// ---- shared bits ----
const initials = (h) => (h || '?').replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
// The first tiles render their art at once; the rest get a sized slot that is filled when it nears
// the viewport, so an 870-creature shelf builds only the SVGs someone can actually see.
let tileSeq = 0;
function tileHTML(c) {
  const art = tileSeq++ < 24 ? creatureVisual(c, 128) : `<div class="art-slot" data-art="${escapeXml(c.id)}"></div>`;
  const care = c.status === 'sick' ? `<div class="care">needs care · a few good tasks will heal it</div>` : c.status === 'healed' ? `<div class="care healed">healed ✓</div>` : '';
  return `<div class="tile ${!firstLoad && !known.has(c.id) ? 'new' : ''}${c.rarity.tier === 'Legendary' ? ' leg' : c.rarity.tier === 'Mythic' ? ' myth' : ''}" style="--tier:${c.rarity.chip}" data-id="${escapeXml(c.id)}">
    <span class="rchip" style="color:${c.rarity.chip}">${c.rarity.tier}</span>
    ${c.att ? `<span class="verified" title="real · verified">✓</span>` : ''}
    ${art}
    <div class="nm">${escapeXml(c.fullName)}</div>
    <div class="sub">${escapeXml(c.speciesName)} · grew from a ${c.durationLabel} task${c.toolCalls ? ' · ' + c.toolCalls + ' tool calls' : ''}</div>
    <div class="lvl"><span>Lv ${c.level || 1} · ${escapeXml(levelLabel(c))}</span><div class="xp"><i style="width:${Math.round(xpPct(c) * 100)}%"></i></div></div>
    ${care}</div>`;
}
function mcardHTML(c, origin) {
  return `<div class="mcard" ${c.id ? `data-id="${escapeXml(c.id)}"` : ''}>
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
  const hero = newest ? `<div class="home-hero">${creatureVisual(newest, 132, { live: true, hero: true })}<div><span class="eyebrow">Newest arrival</span><h2 style="font-size:21px;margin:3px 0">${escapeXml(newest.fullName)}</h2><div class="note">${escapeXml(newest.speciesName)} · grew from a ${newest.durationLabel} task${newest.toolCalls ? ' · ' + newest.toolCalls + ' tool calls' : ''}</div><div class="chips" style="margin-top:8px"><span class="chip" style="color:${newest.rarity.chip}">${newest.rarity.tier}</span><span class="trait">Lv ${newest.level || 1} · ${escapeXml(levelLabel(newest))}</span></div></div></div>` : `<p class="muted" style="margin-top:12px">Your first creature will appear here.</p>`;
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
  const col = s.band.color;
  const glyph = demoCreature(s.name, s.species, s.level >= 60 ? 'Legendary' : s.level >= 40 ? 'Epic' : s.level >= 20 ? 'Rare' : s.level >= 10 ? 'Uncommon' : 'Common', { crown: s.level >= 60, salt: 'sk' });
  const next = s.tracking ? (s.since ? 'tracking since ' + new Date(s.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'tracked from your next run') : s.level >= 99 ? (s.stars >= 5 ? 'max prestige' : fmtN(s.toNext) + ' xp to the next star') : fmtN(s.toNext) + ' xp to Lv ' + (s.level + 1) + (s.nextBand ? ' · ' + s.nextBand.name + ' at Lv ' + s.nextBand.level : '');
  return `<div class="skill" ${s.tracking ? 'style="opacity:.55"' : ''}>
    <div class="skill-glyph">${creatureSVG(glyph, 52)}</div>
    <div class="skill-body">
      <div class="skill-top"><span class="skill-name">${escapeXml(s.name)} <span class="skill-title" style="color:${col}">${escapeXml(s.title)}</span>${s.stars ? ' ' + '★'.repeat(s.stars) : ''}</span><span class="skill-lvl">Lv ${s.level}</span></div>
      <div class="skill-bar"><i style="width:${s.tracking ? 0 : Math.round(s.pct * 100)}%;background:${col}"></i></div>
      <div class="skill-meta">${fmtN(s.xp)} xp · ${s.creatures} run${s.creatures === 1 ? "" : "s"} · ${escapeXml(next)}</div>
    </div></div>`;
}
function sec_skills() {
  const sk = latest.skills;
  if (!latest.creatures.length || !sk) return `<p class="empty">Run some agents and your skills will start filling in.</p>`;
  const top = sk.list.slice().sort((a, b) => b.xp - a.xp)[0];
  const groups = [['work', 'Work'], ['craft', 'Craft'], ['habits', 'Habits']];
  const header = `<div class="grid cols-2">
    <div class="panel tinted"><span class="eyebrow">Total level · ${escapeXml(sk.totalBand.name)}</span>
      <div class="stats-row" style="margin-top:12px">
        <div class="stat"><b>${sk.totalLevel}</b><span>total level</span></div>
        <div class="stat"><b>${fmtN(sk.totalXp)}</b><span>total xp</span></div>
        <div class="stat"><b>${latest.creatures.length}</b><span>runs</span></div></div>
      <p class="note" style="margin-top:12px">Every run pours experience into the skills it exercised, read from the tools it used. Levels run from 1 to 99. Runs from before activity tracking count toward the skill of their species.</p></div>
    <div class="panel"><span class="eyebrow">Signature skill</span>
      <div style="display:flex;gap:16px;align-items:center;margin-top:10px">${creatureSVG(demoCreature(top.name, top.species, 'Legendary', { crown: top.level >= 60, salt: 'sig', orbiters: top.stars }), 104, { live: true })}
        <div><h2 style="font-size:22px">${escapeXml(top.name)}</h2><div class="note" style="margin-top:4px">${escapeXml(top.title)} · Lv ${top.level}</div><div class="note">${top.creatures} runs · ${fmtN(top.xp)} xp</div></div></div></div>
  </div>`;
  return header + groups.map(([g, label]) => `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>${label}</h2></div><div class="skills">${sk.list.filter((s) => s.group === g).map(skillBar).join('')}</div></div>`).join('');
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
      ${creatureSVG(conc, 168, { live: true })}
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
  tileSeq = 0;
  stage.innerHTML = sec.render();
  hydrateArt(stage);
  stage.querySelectorAll('.tile[data-id], .mcard[data-id]').forEach((el) => el.addEventListener('click', () => openModal(findCreature(el.dataset.id))));
  stage.querySelectorAll('.brow[data-handle]').forEach((el) => el.addEventListener('click', () => openProfile(el.dataset.handle)));
  const cfa = stage.querySelector('#cfa'), cfb = stage.querySelector('#cfb');
  if (cfa) cfa.addEventListener('change', doCrossfeed);
  if (cfb) cfb.addEventListener('change', doCrossfeed);
  const wx = stage.querySelector('#wx'); if (wx) wx.onclick = () => { try { localStorage.setItem('pol_welcomed', '1'); } catch {} renderActive(); };
  const seeall = stage.querySelector('#seeall'); if (seeall) seeall.onclick = () => setSection('collection');
  latest.creatures.forEach((c) => known.add(c.id));
}
let artObs = null, artGen = 0;
function hydrateArt(root) {
  const gen = ++artGen;
  if (artObs) artObs.disconnect();
  const fill = (el) => { if (!el.isConnected || !el.dataset.art) return; const c = findCreature(el.dataset.art); el.removeAttribute('data-art'); if (c) el.outerHTML = creatureVisual(c, 128); };
  if (!root.querySelector('.art-slot[data-art]')) return;
  // visible slots first, then the rest in small idle-time batches so no single task gets long
  if (typeof IntersectionObserver !== 'undefined') {
    artObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { artObs.unobserve(e.target); fill(e.target); } }), { rootMargin: '800px 0px' });
    root.querySelectorAll('.art-slot[data-art]').forEach((el) => artObs.observe(el));
  }
  const step = () => {
    if (gen !== artGen) return;
    const next = root.querySelectorAll('.art-slot[data-art]');
    if (!next.length) return;
    for (let i = 0; i < Math.min(30, next.length); i++) { if (artObs) artObs.unobserve(next[i]); fill(next[i]); }
    setTimeout(step, 30);
  };
  setTimeout(step, 120);
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
  document.getElementById('modal-card').innerHTML = creatureVisual(c, 176, { live: true }) + `<h3>${escapeXml(c.fullName)}</h3><div class="rows">${rows}</div>${att}<div class="btns"><button class="primary" id="dl">Save card</button><button id="close">Close</button></div>`;
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
  el.innerHTML = creatureVisual(c, 46, { live: true }) + `<div class="t-txt"><b>${escapeXml(c.fullName)}</b><div>a ${c.rarity.tier} ${c.speciesName} hatched</div></div>`;
  el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 5000);
}
function buildCardSVG(c) {
  const W = 640, H = 800, chip = c.rarity.chip, traits = c.traits.length ? c.traits.join('   ·   ') : 'no traits', bgTop = c.bg === '#0c0e16' ? '#1a1836' : '#20263a';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="bgg" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="${bgTop}"/><stop offset="100%" stop-color="${c.bg}"/></radialGradient>${PL_DEFS}</defs><rect width="${W}" height="${H}" rx="28" fill="url(#bgg)"/><rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="22" fill="none" stroke="${chip}" stroke-opacity="0.55" stroke-width="2"/><g transform="translate(170,64) scale(1.5)">${creatureInner(c, rngFor(c.seed))}</g><text x="${W / 2}" y="516" text-anchor="middle" font-family="Georgia,serif" font-size="34" fill="#f4f2ff">${escapeXml(c.fullName)}</text><text x="${W / 2}" y="552" text-anchor="middle" font-family="system-ui" font-size="18" fill="${chip}">${escapeXml(c.rarity.tier)}   ·   ${escapeXml(c.speciesName)}   ·   Lv ${c.level || 1}</text><text x="${W / 2}" y="596" text-anchor="middle" font-family="system-ui" font-size="16" fill="#9aa3bd">forged from a ${escapeXml(c.durationLabel)} agent run</text><text x="${W / 2}" y="626" text-anchor="middle" font-family="system-ui" font-size="14" fill="#7f88a3">${escapeXml(traits)}</text><text x="${W / 2}" y="726" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="#6b7594">proof of life</text><text x="${W / 2}" y="750" text-anchor="middle" font-family="system-ui" font-size="12" fill="#5f6780">minted from real machine hours</text></svg>`;
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
    const tz = new Date().getTimezoneOffset();
    const [st, bd, be] = await Promise.all([fetch('/api/state?tz=' + tz).then((r) => r.json()), fetch('/api/board').then((r) => r.json()), fetch('/api/bestiary').then((r) => r.json())]);
    // toast on a genuinely new creature, once
    if (!firstLoad) for (const c of st.creatures) if (!known.has(c.id)) { known.add(c.id); showToast(c); }
    latest = st; boardData = bd.board || []; bestiaryData = be;
    if (!cfState.a && be.breeds && be.breeds.length) { cfState.a = be.breeds[0].bredBy[0]; cfState.b = be.breeds[0].bredBy[1]; cfState.result = { creature: be.breeds[0], domain: be.breeds[0].domain }; }
    if (!pubInfo) fetch('/api/pubkey').then((r) => r.json()).then((p) => { pubInfo = p; if (current === 'proof' && document.getElementById('modal').hidden) renderActive(); }).catch(() => {});
    document.getElementById('railme').innerHTML = `<span class="av" style="background:${(st.me && st.me.accent) || '#67e39a'}">${st.me ? initials(st.me.handle) : '?'}</span><span>you</span>`;
    const sig = `${current}|${st.creatures.length}|${st.eggs.length}|${st.me ? st.me.score : 0}|${boardData.length}|${be.network ? be.network.breeds : 0}|${st.skills ? st.skills.list.map((s) => s.level).join() : ''}`;
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
setInterval(() => { if (!document.hidden) poll(false); }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(false); });
setInterval(tickTimers, 1000);
