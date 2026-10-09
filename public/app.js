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
// "a" or "an" by sound: an Uncommon, an Epic, an 8m run, an 11s run, an 18m run
const aAn = (w) => (/^(8|11(?!\d)|18(?!\d)|[aeiou])/i.test(String(w)) ? 'an' : 'a');
const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : many || one + 's'}`;
const shortDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now'; const m = Math.floor(s / 60); if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago'; const d = Math.floor(h / 24); return d < 30 ? d + 'd ago' : shortDate(ms);
}
// the real signals a creature grew from, as one honest line
function originLine(c) {
  if (c.bredBy) return `bred by @${c.bredBy[0]} + @${c.bredBy[1]} from ${c.domain || 'shared'} work`;
  const parts = [`grew from ${aAn(c.durationLabel)} ${c.durationLabel} run`];
  if (c.toolCalls) parts.push(plural(c.toolCalls, 'tool call'));
  if (c.subagents) parts.push(plural(c.subagents, 'subagent'));
  return parts.join(' · ');
}
const skillName = (k) => { const s = latest.skills && latest.skills.list.find((x) => x.key === k); return s ? s.name : k.charAt(0).toUpperCase() + k.slice(1); };
function gainsOf(c) { return Object.entries(c.skillXp || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]); }
// a 0..1 ring in a band colour; Mythic bands are iridescent, Paragon is gold
let ringSeq = 0;
function ringSVG(size, pct, band, inner, o) {
  o = o || {};
  const sw = o.sw || Math.max(4, size * 0.08), r = size / 2 - sw / 2 - 1, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
  const id = 'rg' + (++ringSeq); let stroke = band ? band.color : '#8b90a0', defs = '';
  if (band && (band.gradient || band.key === 'mythic')) { defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7bd0"/><stop offset=".35" stop-color="#7bf0ff"/><stop offset=".7" stop-color="#b28dff"/><stop offset="1" stop-color="#f5c451"/></linearGradient></defs>`; stroke = `url(#${id})`; }
  if (band && (band.ring === 'gold' || band.key === 'paragon')) { defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#f5c451"/><stop offset="1" stop-color="#b07a10"/></linearGradient></defs>`; stroke = `url(#${id})`; }
  const dash = o.fill ? `stroke-dasharray="${F(C)}" stroke-dashoffset="${F(C)}" style="--c:${F(C)};--to:${F(C * (1 - p))}" class="ring-fill"` : `stroke-dasharray="${F(C * p)} ${F(C)}"`;
  return `<svg class="ring${o.cls ? ' ' + o.cls : ''}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${defs}<circle cx="${size / 2}" cy="${size / 2}" r="${F(r)}" fill="none" stroke="#1c1e26" stroke-width="${F(sw)}"/>${p > 0 || o.fill ? `<circle cx="${size / 2}" cy="${size / 2}" r="${F(r)}" fill="none" stroke="${stroke}" stroke-width="${F(sw)}" stroke-linecap="round" ${dash} transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ''}${inner || ''}</svg>`;
}
const FLAME = '<svg class="flame" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><defs><linearGradient id="flm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a2a"/><stop offset=".6" stop-color="#ffb23d"/><stop offset="1" stop-color="#ffe7a0"/></linearGradient></defs><path d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.6A4.8 4.8 0 0 1 12 18a4.8 4.8 0 0 1-4.8-4.9c0-2.2 1.1-3.6 2.2-4.8.3 1.5 1 2.4 2 2.7-.6-3.1.2-6 .6-8.5z" fill="url(#flm)"/><path d="M12 21.5c-2.3 0-3.6-1.5-3.6-3.3 0-1.6 1.1-2.6 1.9-3.4.2 1 .8 1.5 1.5 1.7-.3-1.6.3-3 .6-4.1 1.4 1.4 3.2 3 3.2 5.6 0 2-1.4 3.5-3.6 3.5z" fill="#fff3c8" opacity=".85"/></svg>';
// The first tiles render their art at once; the rest get a sized slot that is filled when it nears
// the viewport, so an 870-creature shelf builds only the SVGs someone can actually see.
let tileSeq = 0;
function tileHTML(c, o) {
  const art = tileSeq++ < 24 ? creatureVisual(c, 128) : `<div class="art-slot" data-art="${escapeXml(c.id)}"></div>`;
  const care = c.status === 'sick' ? `<div class="care">needs care · a few good tasks will heal it</div>` : c.status === 'healed' ? `<div class="care healed">healed ✓</div>` : '';
  const isNew = !(o && o.noNew) && !firstLoad && !known.has(c.id);
  return `<div class="tile ${isNew ? 'new' : ''}${c.rarity.tier === 'Legendary' ? ' leg' : c.rarity.tier === 'Mythic' ? ' myth' : ''}" style="--tier:${c.rarity.chip}" data-id="${escapeXml(c.id)}">
    <span class="rchip" style="color:${c.rarity.chip}">${c.rarity.tier}</span>
    ${c.att ? `<span class="verified" title="real · verified">✓</span>` : ''}
    ${art}
    <div class="nm">${escapeXml(c.fullName)}</div>
    <div class="sub">${escapeXml(c.speciesName)} · ${escapeXml(originLine(c))}</div>
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
  const g = eggGeo(seed), id = 'eg' + (seed >>> 0).toString(36) + (o.k || ''), shell = lighten(glow, 0.12), deep = darken(glow, 0.55);
  const zz = pathOf(g.pts, false), top = pathOf([[-10, g.pts[0][1]], ...g.pts, [210, g.pts[g.pts.length - 1][1]], [210, -10], [-10, -10]], true), bot = pathOf([[-10, g.pts[0][1]], ...g.pts, [210, g.pts[g.pts.length - 1][1]], [210, 250], [-10, 250]], true);
  const body = (clip) => `<g${clip ? ` clip-path="url(#${clip})"` : ''}><path d="${EGG_D}" fill="url(#${id}-f)" stroke="${darken(glow, 0.7)}" stroke-width="4"/>${g.spots.map(([x, y, r]) => `<ellipse cx="${F(x)}" cy="${F(y)}" rx="${F(r)}" ry="${F(r * 0.8)}" fill="${deep}" opacity=".28"/>`).join('')}<path d="${EGG_D}" fill="url(#${id}-s)"/><ellipse cx="78" cy="88" rx="13" ry="22" transform="rotate(24 78 88)" fill="#fff" opacity=".5"/><circle cx="70" cy="122" r="3.4" fill="#fff" opacity=".75"/></g>`;
  const defs = `<defs><radialGradient id="${id}-f" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${lighten(shell, 0.6)}"/><stop offset=".45" stop-color="${shell}"/><stop offset="1" stop-color="${darken(glow, 0.45)}"/></radialGradient><radialGradient id="${id}-s" cx="50%" cy="50%" r="55%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient><radialGradient id="${id}-w" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${glow}" stop-opacity=".55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient><clipPath id="${id}-t"><path d="${top}"/></clipPath><clipPath id="${id}-b"><path d="${bot}"/></clipPath></defs>`;
  const warm = `<ellipse cx="100" cy="140" rx="96" ry="100" fill="url(#${id}-w)" class="egg-warm"/><ellipse cx="100" cy="216" rx="56" ry="7" fill="#000" opacity=".45"/>`;
  if (!o.crack) return `<svg class="eggart" viewBox="0 0 200 230" width="${size}" height="${Math.round(size * 1.15)}" aria-hidden="true">${defs}${warm}<g class="egg-wob" style="transform-origin:100px 212px">${body()}</g></svg>`;
  const cp = (d, cls, w) => '<path class="rv-crack' + cls + '" pathLength="1" d="' + d + '" fill="none" stroke="#fff8e0" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"/>';
  const crack = cp(zz, '', 3.2) + cp(pathOf(g.branch, false), ' rv-c2', 2.2) + cp(pathOf(g.branch2, false), ' rv-c2', 2.2);
  return `<svg class="eggart rv-eggsvg" viewBox="0 0 200 230" width="${size}" height="${Math.round(size * 1.15)}" aria-hidden="true">${defs}${warm}<g class="rv-egg" style="transform-origin:100px 212px"><g class="rv-top">${body(id + '-t')}</g><g class="rv-bot">${body(id + '-b')}</g><g class="rv-cracks">${crack}</g></g></svg>`;
}
function eggBox(e) {
  const col = (ART_PAL[e.domainKey] || ART_PAL.wisp).glow;
  return `<div class="egg" data-start="${Number(e.startedAt) || 0}">${eggSVG(hashString(String(e.id)), col, 46)}<div><b>A creature is growing</b><div>Claude is working · <span class="timer">0s</span>${e.subagents ? ` · ${plural(e.subagents, 'subagent')}` : ''}</div></div></div>`;
}

// ---- section: home (the friendly default) ----
const GOALS = [['runs', 3], ['runs', 5], ['runs', 10], ['minutes', 30], ['minutes', 60], ['minutes', 120]];
function goalPanel(en) {
  const g = en.goal, pct = Math.min(1, g.progress / g.target), met = g.met;
  const unit = g.type === 'runs' ? (g.target === 1 ? 'run' : 'runs') : 'min';
  const ring = ringSVG(112, pct, { color: met ? '#f5c451' : '#6ee7a5', key: met ? 'paragon' : '' , ring: met ? 'gold' : null }, '', { sw: 10, cls: met ? 'ring-met' : '' });
  const opts = GOALS.map(([t, n]) => `<option value="${t}:${n}" ${t === g.type && n === g.target ? 'selected' : ''}>${n} ${t === 'runs' ? 'runs' : 'machine-min'} a day</option>`).join('');
  const custom = GOALS.some(([t, n]) => t === g.type && n === g.target) ? '' : `<option selected value="${g.type}:${g.target}">${g.target} ${g.type === 'runs' ? 'runs' : 'machine-min'} a day</option>`;
  return `<div class="goal ${met ? 'met' : ''}"><div class="goal-ring">${ring}<div class="goal-num"><b>${fmtN(g.progress)}</b><span>of ${g.target} ${unit}</span></div></div>
    <div class="goal-txt"><span class="eyebrow">Daily goal</span><h3>${met ? 'Goal met today' : g.progress ? `${fmtN(g.target - g.progress)} ${g.type === 'runs' ? 'more ' + (g.target - g.progress === 1 ? 'run' : 'runs') : 'more machine-min'} to go` : 'Nothing hatched yet today'}</h3>
    <div class="note">Today: ${plural(en.today.runs, 'run')} · ${fmtN(en.today.minutes)} machine-min</div>
    <select id="goalsel" class="sel" aria-label="daily goal">${custom}${opts}</select></div></div>`;
}
function streakPanel(en) {
  const days = []; // last 7 local days, oldest first, from the real week series
  const wk = (latest.skills && latest.skills.list.reduce((acc, s) => { (s.week || []).forEach((v, i) => (acc[i] = (acc[i] || 0) + v)); return acc; }, [])) || [];
  for (let i = 0; i < 7; i++) days.push(wk[i] > 0);
  const dn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'], today = new Date().getDay();
  return `<div class="streak ${en.streak ? 'on' : ''}"><div class="streak-top">${FLAME}<b>${en.streak}</b><span>day streak</span></div>
    <div class="week-dots">${days.map((on, i) => `<div class="wd ${on ? 'on' : ''}"><i></i><span>${dn[(today - 6 + i + 14) % 7]}</span></div>`).join('')}</div>
    <div class="note">Best ${plural(en.bestStreak, 'day')} · ${plural(en.activeDays, 'active day')} on record</div></div>`;
}
function sec_home() {
  const cs = latest.creatures, en = latest.engagement;
  const welcome = welcomed() ? '' : `<div class="welcome"><button class="wx" id="wx" title="dismiss">✕</button><h2>Meet your creatures</h2><p>Every time Claude works on a task for you, a creature hatches from what really happened in that run. Longer runs hatch rarer creatures, and the tools it used decide its species and the skills you level up.</p></div>`;
  if (!cs.length) return `${welcome}<div class="panel hero-empty">${eggSVG(1234, '#a48ff0', 120)}<h2>Your first egg is waiting</h2><p class="p-desc">The next time Claude works on a task for you, an egg appears here and hatches when the run ends.</p>${latest.eggs.length ? `<div class="eggs" style="justify-content:center;margin-top:16px">${latest.eggs.map(eggBox).join('')}</div>` : ''}</div>`;
  const newest = cs[0], gains = gainsOf(newest).slice(0, 3);
  const spotlight = `<div class="panel spot" style="--tier:${newest.rarity.chip}">
    <div class="spot-art">${creatureVisual(newest, 230, { live: true, hero: true })}</div>
    <div class="spot-txt"><span class="eyebrow">Newest arrival · ${ago(newest.bornAt)}</span>
      <h2>${escapeXml(newest.fullName)}</h2>
      <div class="chips"><span class="chip" style="color:${newest.rarity.chip}">${newest.rarity.tier}</span><span class="trait">${escapeXml(newest.speciesName)}</span><span class="trait">Lv ${newest.level || 1} · ${escapeXml(levelLabel(newest))}</span>${newest.traits.map((t) => `<span class="trait">${escapeXml(t)}</span>`).join('')}</div>
      <p class="note" style="margin-top:10px">${escapeXml(originLine(newest))}</p>
      ${gains.length ? `<div class="gains">${gains.map(([k, v]) => `<span class="gain">+${fmtN(v)} ${escapeXml(skillName(k))}</span>`).join('')}</div>` : ''}
      <div class="btns left"><button class="primary" id="replay">Replay the hatch</button><button id="opennew">Details</button></div></div></div>`;
  const growing = latest.eggs.length ? `<div class="eggs">${latest.eggs.map(eggBox).join('')}</div>` : `<p class="note" style="margin:0">Nothing is hatching right now. The next run Claude starts lays an egg here.</p>`;
  const today = en ? `<div class="panel today">${goalPanel(en)}<div class="divider"></div>${streakPanel(en)}</div>` : '';
  const rw = en && en.rarestWeek ? findCreature(en.rarestWeek.creatureId) : null;
  const rarest = rw ? `<div class="panel rare-week" data-id="${escapeXml(rw.id)}" style="--tier:${rw.rarity.chip}"><span class="eyebrow">Rarest this week</span>
      <div class="rw-body">${creatureVisual(rw, 150, { live: true })}<div><h3>${escapeXml(rw.fullName)}</h3><span class="chip" style="color:${rw.rarity.chip}">${rw.rarity.tier}</span><div class="note" style="margin-top:8px">${escapeXml(en.rarestWeek.durationLabel)} run · ${shortDate(rw.bornAt)}</div></div></div></div>` : '';
  const wg = en && en.weekGains && en.weekGains.length ? en.weekGains : null, wmax = wg ? Math.max(...wg.map((g) => g.xp)) : 1;
  const week = wg ? `<div class="panel"><div class="p-head"><h2>This week</h2><span class="note link" data-go="skills">all skills →</span></div>${wg.map((g) => { const s = latest.skills.list.find((x) => x.key === g.key); return `<div class="wk-row"><span>${escapeXml(g.name)}</span><b>+${fmtN(g.xp)} xp</b><div class="wk-bar"><i style="width:${Math.round((g.xp / wmax) * 100)}%;background:${s ? s.band.color : 'var(--green)'}"></i></div></div>`; }).join('')}</div>` : '';
  const os = latest.stats.openSessions;
  const stats = `<div class="panel tinted"><div class="stats-row"><div class="stat"><b>${fmtN(cs.length)}</b><span>creatures</span></div><div class="stat"><b>${latest.stats.machineHours}</b><span>hours Claude worked</span></div><div class="stat"><b>${latest.skills ? fmtN(latest.skills.totalLevel) : '—'}</b><span>total level</span></div></div>
    ${os && os.count ? `<p class="note">Not counted: ${plural(os.count, 'session')} left open for ${os.hours} h. ${os.count === 1 ? 'It still has its creature,' : 'They still have their creatures,'} it just isn't work time.</p>` : ''}
    <div class="divider"></div><span class="eyebrow">Growing now</span><div style="margin-top:10px">${growing}</div></div>`;
  const preview = `<div class="p-head"><h2>Your creatures</h2><span class="note link" id="seeall">see all ${fmtN(cs.length)} →</span></div><div class="shelf">${cs.slice(0, 10).map((c) => tileHTML(c)).join('')}</div>`;
  return `${welcome}
    <div class="home-top">${spotlight}${today}</div>
    <div class="home-row">${rarest}${week}${stats}</div>
    <div class="panel" style="margin-top:16px">${preview}</div>`;
}

// ---- section: collection (all your creatures) ----
function sec_collection() {
  const cs = latest.creatures;
  if (!cs.length) return `<p class="empty">No creatures yet. The next time Claude does a task for you, your first one is born.</p>`;
  return `<div class="p-head"><h2>Your collection</h2><span class="note">${cs.length} creatures, each grew from a real Claude task</span></div><div class="shelf">${cs.map(tileHTML).join('')}</div>`;
}
function welcomed() { try { return localStorage.getItem('pol_welcomed') === '1'; } catch { return false; } }

// ---- section: how it works (rules drawn by the real renderer; your own runs as the examples) ----
const RARITY_RULES = [['Common', 'up to 20s'], ['Uncommon', 'up to 90s'], ['Rare', 'up to 5m'], ['Epic', 'up to 20m'], ['Legendary', 'over 20m']];
const SPECIES_RULES = [['cog', 'Engineering', 'code files, build and package commands'], ['scholar', 'Research', 'web search and fetch'], ['moth', 'Writing', 'docs and text files'], ['prism', 'Design', 'design tools and image files'], ['lumen', 'Video', 'video tools, ffmpeg, media files'], ['hydra', 'Outreach', 'mail, LinkedIn, CRM and chat tools'], ['wisp', 'General', 'browser automation, or nothing classifiable']];
function sec_proof() {
  const mk = (latest.me && NAME2KEY[latest.me.topSpecies]) || 'hydra';
  const rarity = `<div class="rar-ladder">${RARITY_RULES.map(([t, rule]) => `<div class="rar"><div class="rar-art">${creatureSVG(demoCreature('rule-' + t, mk, t, { salt: 'rule' }), 104)}</div><span class="chip" style="color:${TIERC[t]}">${t}</span><div class="note">${rule}</div></div>`).join('')}
    <div class="rar myth"><div class="rar-art">${creatureSVG(Object.assign(demoCreature('rule-myth', mk, 'Mythic', { salt: 'rule' }), { parents: ['Hydra', 'Moth'] }), 104)}</div><span class="chip" style="color:${TIERC.Mythic}">Mythic</span><div class="note">only by breeding</div></div></div>`;
  const species = `<div class="sp-grid">${SPECIES_RULES.map(([k, d, sig]) => `<div class="sp">${creatureSVG(demoCreature('sp-' + k, k, 'Rare', { salt: 'sp' }), 64)}<div><b>${SPECIES[k].name} <span class="note">· ${d}</span></b><span>${sig}</span></div></div>`).join('')}</div>`;
  const hooks = `<div class="hooks">
    <div class="hook"><b>UserPromptSubmit</b><span>egg laid</span></div><span class="arrow">→</span>
    <div class="hook"><b>SubagentStop</b><span>each subagent, counted</span></div><span class="arrow">→</span>
    <div class="hook"><b>Stop</b><span>hatched and signed</span></div><span class="arrow">→</span>
    <div class="hook born"><b>Creature born</b><span>species, rarity, skills</span></div></div>`;
  // your real runs as the examples, never made-up run ids
  const real = latest.creatures.filter((c) => !c.bredBy && (c.durationMs || 0) <= 24 * 3600e3);
  const longest = real.slice().sort((a, b) => b.durationMs - a.durationMs)[0];
  const failed = latest.creatures.find((c) => c.error);
  const exCard = (c, label) => `<div class="hcard" data-id="${escapeXml(c.id)}"><span class="eyebrow">${label}</span>
      <div class="flow">${eggSVG(c.seed, (ART_PAL[c.speciesKey] || ART_PAL.wisp).glow, 60)}<span class="arrow">→</span>${creatureSVG(c, 104)}</div>
      <div class="rundata">run       ${escapeXml(c.att ? c.att.fp : c.id.slice(-8))}<br>duration  ${escapeXml(c.durationLabel)}<br>tools     ${c.toolCalls != null ? plural(c.toolCalls, 'call') : 'not recorded'}<br>status    ${c.error ? 'ended in an error ✗' : 'success ✓'}</div>
      <div class="verdict">Hatched <b style="color:${c.rarity.chip}">${c.rarity.tier.toUpperCase()}</b> ${escapeXml(c.speciesName)}${c.status === 'sick' ? ' · <b class="tag-sick">sick</b>, raised back by later runs' : c.status === 'healed' ? ' · healed survivor' : ''}</div></div>`;
  const examples = longest ? `<div class="hero2">${exCard(longest, 'Your longest real run')}${failed ? exCard(failed, 'A run that really failed') : `<div class="hcard"><span class="eyebrow">When a run fails</span><div class="flow">${eggSVG(77, '#e8615b', 60)}<span class="arrow">→</span>${creatureSVG(demoCreature('Example', 'cog', 'Rare', { status: 'sick', salt: 'bad' }), 104)}</div><p class="note">None of your runs has ended in an error yet. One that does hatches sick with a scar, and heals once later runs of the same kind raise it. Drawn here as an example, not a real run.</p></div>`}</div>` : `<p class="note">Your own runs appear here as examples once the first one hatches.</p>`;

  const rungs = [[1, 'sick'], [2, 'healed'], [4], [7], [10]];
  const ladder = rungs.map(([lv, st], i) => {
    const c = demoCreature('Ladder', mk, 'Rare', { salt: 'L', status: st === 'sick' ? 'sick' : 'healthy', traits: st === 'healed' ? ['Survivor'] : [], level: lv });
    if (st === 'healed') c.status = 'healed';
    return `<div class="rung">${creatureSVG(c, 70 + i * 9)}<div class="rname">Lv ${lv}</div><div class="rl">${LEVEL_LABELS[lv - 1]}${st === 'sick' ? ' · sick' : ''}</div></div>`;
  }).join('');

  const mine = latest.creatures.slice().sort((a, b) => (b.level || 1) - (a.level || 1) || b.rarity.index - a.rarity.index)[0];
  const survivor = mine ? `<div class="survivor">
    <div style="text-align:center" class="link-c" data-id="${escapeXml(mine.id)}">${creatureVisual(mine, 180)}<div class="mono" style="color:var(--faint);font-size:11px;margin-top:6px">#${escapeXml(mine.att ? mine.att.fp : mine.id.slice(-8).toUpperCase())} ${mine.att ? '<span class="verified inline" title="signed">✓</span>' : ''}</div></div>
    <div><span class="eyebrow">Most raised creature</span><h2 style="font-size:22px;margin:4px 0 2px">${escapeXml(mine.fullName)}</h2>
      <div class="note" style="margin:0 0 12px">Lv ${mine.level || 1} · ${escapeXml(levelLabel(mine))} · ${escapeXml(mine.speciesName)}</div>
      <div class="sv-stats">
        <div class="stat"><b>${fmtN(latest.creatures.length)}</b><span>runs hatched</span></div>
        <div class="stat"><b>${latest.stats.machineHours}</b><span>machine hours</span></div>
        <div class="stat"><b>${latest.me ? latest.me.score.toFixed(1) : '0.0'}</b><span>flex score</span></div>
        <div class="stat"><b>${latest.me ? fmtN(latest.me.scars) : 0}</b><span>scars collected</span></div>
      </div>
      ${latest.me && latest.me.scars ? `<div class="scars-grid">${Array.from({ length: Math.min(12, latest.me.scars) }).map(() => '<div class="scar-dot">✕</div>').join('')}</div>` : '<p class="note">No scars yet: none of your runs has ended in an error.</p>'}</div></div>`
    : `<p class="empty">Your most raised creature appears once your first one hatches.</p>`;

  const prov = `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Provenance</h2><span class="note">ed25519 attestation</span></div>
    <div class="stats-row"><div class="stat"><b>${fmtN(latest.creatures.filter((c) => c.att).length)}</b><span>of your creatures signed</span></div><div class="stat"><b class="mono" style="font-size:15px">${pubInfo ? escapeXml(pubInfo.fingerprint.slice(0, 12)) : '—'}</b><span>attestor key</span></div><div class="stat"><b>ed25519</b><span>algorithm</span></div></div>
    <p class="note" style="margin-top:12px">Every creature carries an Ed25519 signature over its run's real facts: owner, duration, domain, rarity and seed. Change any one and the signature breaks, so rarity is proven rather than claimed. Open any creature and press Verify.</p></div>`;

  return `<div class="panel tinted"><div class="p-head"><h2>Rarity is how long Claude really worked</h2><span class="note">the same renderer your creatures use</span></div>${rarity}</div>
  <div class="grid cols-2" style="margin-top:16px">
    <div class="panel"><div class="p-head"><h2>Species is what the run did</h2></div>${species}<p class="note">Read from tool names, file extensions and command names only. Never prompts, paths, file contents or arguments.</p></div>
    <div class="panel"><div class="p-head"><h2>Built on Claude Code hooks</h2></div>${hooks}<div class="divider"></div><span class="eyebrow">Examples from your own runs</span><div style="margin-top:12px">${examples}</div></div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="p-head"><h2>Raised by the runs that follow</h2><span class="note">each good run raises the 20 most recent creatures of its kind</span></div><div class="ladder">${ladder}</div></div>
  <div class="panel" style="margin-top:16px">${survivor}</div>
  ${prov}`;
}

// ---- section: skills (computed server-side in skills.js; rendered here) ----
const TOTAL_BANDS = [[0, 'Initiate'], [100, 'Operator'], [250, 'Veteran'], [450, 'Elite'], [700, 'Archon'], [1000, 'Ascendant']];
const GROUP_INFO = { work: ['Work', 'What the runs did, read from their tools. One run splits its experience across the skills it exercised.'], craft: ['Craft', 'How you run agents: bonuses on top of each run.'], habits: ['Habits', 'Showing up: computed per day across all your runs.'] };
const tierForLevel = (L) => (L >= 60 ? 'Legendary' : L >= 40 ? 'Epic' : L >= 20 ? 'Rare' : L >= 10 ? 'Uncommon' : 'Common');
function sparkSVG(week, color) {
  const w = 84, h = 22, mx = Math.max(1, ...week), pts = week.map((v, i) => [4 + (i * (w - 8)) / 6, h - 4 - (v / mx) * (h - 8)]);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${pathOf(pts, false)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" opacity=".7"/>${pts.map(([x, y], i) => `<circle cx="${F(x)}" cy="${F(y)}" r="${week[i] > 0 ? 2.2 : 1.4}" fill="${week[i] > 0 ? color : '#3a3d4a'}"/>`).join('')}</svg>`;
}
function trackingLine(s) { return s.since ? 'Tracking since ' + shortDate(s.since) : 'Tracked from your next run'; }
function nextLine(s) {
  if (s.tracking) return trackingLine(s);
  if (s.level >= 99) return s.stars >= 5 ? 'Max prestige' : `${fmtN(s.toNext)} xp to prestige star ${s.stars + 1}`;
  return s.nextBand ? `next: ${s.nextBand.name} at Lv ${s.nextBand.level} (${fmtN(s.nextBand.xp)} xp)` : `${fmtN(s.toNext)} xp to Lv ${s.level + 1}`;
}
function skillCard(s) {
  const col = s.band.color, glyph = demoCreature('skill-' + s.key, s.species, tierForLevel(s.level), { salt: 'sk' });
  const ring = ringSVG(64, s.tracking ? 0 : s.pct, s.band, `<text x="32" y="39" text-anchor="middle" class="ring-n">${s.level}</text>`, { sw: 5 });
  const last = s.lastGain ? `+${fmtN(s.lastGain.xp)} xp · ${ago(s.lastGain.at)}` : 'no gains yet';
  return `<button class="skill-card ${s.tracking ? 'tracking' : ''}" data-skill="${s.key}" style="--band:${col}">
    <div class="sc-ring">${ring}</div>
    <div class="sc-body">
      <div class="sc-top"><span class="sc-name">${escapeXml(s.name)}</span><span class="band-chip" style="color:${col}">${escapeXml(s.title)}</span></div>
      ${s.stars ? `<div class="stars">${'★'.repeat(s.stars)}</div>` : ''}
      <div class="sc-sig">${escapeXml(s.signal || '')}</div>
      <div class="sc-next">${escapeXml(nextLine(s))}</div>
      <div class="sc-foot"><span>${escapeXml(last)}</span>${s.tracking ? '' : sparkSVG(s.week || [0, 0, 0, 0, 0, 0, 0], col)}</div>
    </div>
    <div class="sc-glyph">${creatureSVG(glyph, 46)}</div>
    ${s.tracking ? '' : `<div class="sc-bar"><i style="width:${Math.round(s.pct * 100)}%"></i></div>`}</button>`;
}
let shownTotal = null; // count up only after a real level-up, never on first view
function sec_skills() {
  const sk = latest.skills;
  if (!latest.creatures.length || !sk) return `<p class="empty">Run some agents and your skills will start filling in.</p>`;
  const top = sk.list.slice().sort((a, b) => b.xp - a.xp)[0];
  const nb = TOTAL_BANDS.find(([from]) => from > sk.totalLevel), cb = TOTAL_BANDS.filter(([from]) => from <= sk.totalLevel).pop();
  const tpct = nb ? (sk.totalLevel - cb[0]) / (nb[0] - cb[0]) : 1;
  const live = sk.list.filter((s) => !s.tracking).length;
  const sig = demoCreature('sig-' + top.key, top.species, top.level >= 60 ? 'Legendary' : tierForLevel(top.level), { crown: top.level >= 60, salt: 'sig', orbiters: top.stars });
  const hero = `<div class="sk-hero">
    <div class="panel tinted sk-total">
      <span class="eyebrow">Total level</span>
      <div class="tl-row"><b class="tl-num" id="tlnum" data-to="${sk.totalLevel}">${fmtN(shownTotal != null && shownTotal !== sk.totalLevel ? shownTotal : sk.totalLevel)}</b><span class="tl-max">/ ${fmtN(sk.maxTotalLevel)}</span><span class="band-chip big">${escapeXml(sk.totalBand.name)}</span></div>
      <div class="tl-bar"><i style="width:${Math.round(tpct * 100)}%"></i></div>
      <div class="note">${nb ? `${fmtN(nb[0] - sk.totalLevel)} levels to ${nb[1]} (${fmtN(nb[0])})` : 'Top band reached'} · ${fmtN(sk.totalXp)} xp · ${live} of ${sk.list.length} skills active</div>
      <p class="note" style="margin-top:12px">Every run pours experience into the skills it exercised. Levels run 1 to 99, with prestige stars past 99. Runs from before activity tracking count toward the skill of their species; runs whose kind was never known count as Automation. A run counts at most 4 hours of length, so a session left open cannot inflate a skill.</p>
    </div>
    <div class="panel sk-sig" style="--band:${top.band.color}">
      <div class="sig-art">${creatureSVG(sig, 190, { live: true })}</div>
      <div><span class="eyebrow">Signature skill</span><h2>${escapeXml(top.name)}</h2>
        <div class="chips"><span class="band-chip" style="color:${top.band.color}">${escapeXml(top.title)}</span><span class="trait">Lv ${top.level}</span>${top.stars ? `<span class="trait stars">${'★'.repeat(top.stars)}</span>` : ''}</div>
        <div class="note" style="margin-top:8px">${plural(top.creatures, 'run')} · ${fmtN(top.xp)} xp · ${escapeXml(nextLine(top))}</div>
        <div class="btns left"><button class="primary" id="skcard" data-skill="${top.key}">Save skill card</button></div></div>
    </div></div>`;
  const ms = (sk.milestones || []).slice(0, 14);
  const miles = ms.length ? `<div class="panel" style="margin-top:16px"><div class="p-head"><h2>Milestones</h2><span class="note">replayed from your real runs</span></div><div class="miles">${ms.map((m) => `<div class="mile ${m.creatureId ? 'link-c' : ''}" ${m.creatureId ? `data-id="${escapeXml(m.creatureId)}"` : ''} style="--mc:${m.color || (m.kind === 'legendary' ? '#f5c451' : m.kind === 'streak' ? '#ff9a3d' : m.kind === 'total' ? '#b28dff' : '#67a8f0')}"><i></i><b>${escapeXml(m.text)}</b><span>${shortDate(m.at)}</span></div>`).join('')}</div></div>` : '';
  const groups = ['work', 'craft', 'habits'].map((g) => { const list = sk.list.filter((s) => s.group === g); return list.length ? `<div class="sk-group"><div class="sk-ghead"><h2>${GROUP_INFO[g][0]}</h2><span class="note">${GROUP_INFO[g][1]}</span></div><div class="skill-grid">${list.map(skillCard).join('')}</div></div>` : ''; }).join('');
  return hero + miles + groups;
}
function openSkill(key) {
  const s = latest.skills && latest.skills.list.find((x) => x.key === key); if (!s) return;
  const rows = (s.top || []).map((t) => { const c = findCreature(t.creatureId); return c ? `<div class="contrib" data-id="${escapeXml(c.id)}">${creatureSVG(c, 44)}<div><b>${escapeXml(c.fullName)}</b><span>${c.rarity.tier} · ${escapeXml(c.durationLabel)} · ${shortDate(c.bornAt)}</span></div><em>+${fmtN(t.xp)}</em></div>` : ''; }).join('');
  document.getElementById('modal-card').innerHTML = `<div class="sk-modal" style="--band:${s.band.color}">${ringSVG(120, s.tracking ? 0 : s.pct, s.band, `<text x="60" y="70" text-anchor="middle" class="ring-n big">${s.level}</text>`, { sw: 8 })}
    <h3>${escapeXml(s.name)}</h3><div class="chips" style="justify-content:center"><span class="band-chip" style="color:${s.band.color}">${escapeXml(s.title)}</span>${s.stars ? `<span class="trait stars">${'★'.repeat(s.stars)}</span>` : ''}</div>
    <div class="rows"><div class="row"><span>experience</span><span>${fmtN(s.xp)} xp</span></div><div class="row"><span>runs that fed it</span><span>${fmtN(s.creatures)}</span></div><div class="row"><span>next</span><span>${escapeXml(nextLine(s))}</span></div><div class="row"><span>signal</span><span>${escapeXml(s.signal || '')}</span></div>${s.legacyXp ? `<div class="row"><span>from runs before tracking</span><span>${fmtN(s.legacyXp)} xp</span></div>` : ''}</div>
    ${rows ? `<span class="eyebrow">Top contributing runs</span><div class="contribs">${rows}</div>` : `<p class="note">${s.tracking ? escapeXml(trackingLine(s)) + '. No made-up level until a real run feeds it.' : 'Daily habits are computed across days, not single runs.'}</p>`}
    <div class="btns"><button class="primary" id="skdl">Save skill card</button><button id="close">Close</button></div></div>`;
  document.getElementById('modal').hidden = false;
  document.getElementById('close').onclick = closeModal;
  document.getElementById('skdl').onclick = () => downloadSkillCard(s);
  document.querySelectorAll('#modal-card .contrib[data-id]').forEach((el) => el.addEventListener('click', () => openModal(findCreature(el.dataset.id))));
}

// ---- section: board ----
let boardSamples = false;
function sec_board() {
  if (!boardData.length) return `<p class="empty">No operators with creatures yet.</p>`;
  const rows = boardData.map((r) => `<div class="brow ${r.you ? 'you' : ''}" data-handle="${escapeXml(r.handle)}">
    <div class="rank">${r.rank}</div><div class="ava" style="background:${r.accent || '#67e39a'}">${initials(r.handle)}</div>
    <div class="who"><b>@${escapeXml(r.handle)}</b>${r.you ? ' <span class="chip" style="color:var(--green)">you</span>' : r.sample ? ' <span class="chip" style="color:var(--violet)">sample</span>' : ''}<span>${plural(r.runs, 'run')} · ${Number(r.hours || 0).toFixed(1)} hrs · ${escapeXml(r.topSpecies || '—')}</span></div>
    <div class="surv">${fmtN(r.survivors || 0)}<span>survivors</span></div>
    <div class="score" style="color:${r.you ? 'var(--green)' : 'var(--ink)'}">${r.score.toFixed(1)}</div></div>`).join('');
  const real = boardData.filter((r) => !r.sample).length;
  const note = boardSamples ? 'Rows marked sample are generated operators, shown because the server runs with --samples. They are not real people.' : real <= 1 ? 'Only operators on this server appear here. Right now that is just you.' : 'Every row is an operator on this server.';
  return `<div class="section-lead">The flex is machine hours, not money. Standing comes from the compute you really commanded, and it cannot be bought. The highest possible score is 10.</div><div class="board">${rows}</div><p class="note">${note}</p>`;
}

// ---- section: bestiary (real, computed cross-breeding) ----
function crossfeedPanel() {
  const ops = (bestiaryData && bestiaryData.operators) || [];
  if (ops.length < 2) return `<div class="cf-empty">${creatureSVG(Object.assign(demoCreature('cf-wait', 'moth', 'Mythic', { salt: 'cf' }), { parents: ['Moth', 'Prism'] }), 110)}<p class="note">Breeding needs two operators whose real, signed work landed in the same domain. ${ops.length ? 'You are the only operator here so far.' : 'No operators have creatures yet.'} When a second operator joins this server, hybrids appear here on their own.</p></div>`;
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
function sec_bestiary() {
  const bd = bestiaryData;
  if (!bd) return `<p class="empty">summoning the menagerie…</p>`;
  const net = `<div class="net">
    <div class="n"><b>${fmtN(bd.network.operators)}</b><span>operators</span></div>
    <div class="n"><b>${fmtN(bd.network.species)}</b><span>species discovered</span></div>
    <div class="n"><b>${fmtN(bd.network.breeds)}</b><span>cross-fed breeds</span></div>
    ${bd.network.samples ? `<p class="note" style="margin:2px 0 0">${plural(bd.network.samples, 'sample operator')} included because the server runs with --samples. Their creatures are generated, not real.</p>` : ''}</div>`;
  const menagerie = (bd.breeds.map((c) => mcardHTML(c, 'bred by @' + c.bredBy[0] + ' + @' + c.bredBy[1])).join('') + latest.creatures.slice(0, bd.breeds.length ? 3 : 5).map((c) => mcardHTML(c, 'you · solo · ' + c.durationLabel + ' run')).join('')) || '<p class="note">No creatures yet.</p>';
  const duos = bd.duos.map((d) => `<div class="ritual"><div><b>${escapeXml(d.species)}</b><span>@${escapeXml(d.pair[0])} + @${escapeXml(d.pair[1])} · ${escapeXml(d.domain)} work</span></div><span class="rchip" style="color:${d.chip};position:static">${d.tier}</span></div>`).join('') || '<p class="note">No duos yet. A duo forms when two operators run the same kind of work.</p>';
  const principles = [['Co-created', 'Mythic species need two operators whose real work collided.'], ['Shared', 'One menagerie per server, every operator, one registry.'], ['Hard to fake', 'Every parent is Ed25519-signed, so a hybrid needs two signed histories.'], ['Grows with people', 'Each operator who joins adds new pairings.']];
  return `<div class="section-lead">Mythic creatures cannot be hatched alone. They appear only when two operators who ran the same kind of work cross-feed, minting a hybrid neither could make on their own. Hybrids are computed from signed runs on this server.</div>
  <div class="grid cols-2">
    <div class="panel"><div class="p-head"><h2>Cross-feed breeding</h2><span class="note">two operators who share a domain</span></div>${crossfeedPanel()}</div>
    <div class="panel tinted"><div class="p-head"><h2>Network</h2></div>${net}</div>
  </div>
  <div class="panel" style="margin-top:16px"><div class="p-head"><h2>The menagerie</h2><span class="note">${bd.breeds.length ? plural(bd.breeds.length, 'cross-fed species') + ' · rarest first' : 'your newest, until the first hybrid'}</span></div><div class="menagerie">${menagerie}</div></div>
  <div class="grid cols-2" style="margin-top:16px">
    <div class="panel"><div class="p-head"><h2>Top breeding duos</h2></div><div class="rituals">${duos}</div></div>
    <div class="panel"><div class="p-head"><h2>Why it matters</h2></div><div class="principles" style="margin-top:0;grid-template-columns:1fr 1fr">${principles.map(([b, s]) => `<div class="principle"><b>${b}</b><span>${s}</span></div>`).join('')}</div></div>
  </div>`;
}

// ---- section: lounge (open only while an agent is really running) ----
function sec_antechamber() {
  const open = latest.eggs.length > 0;
  const conc = demoCreature('The Concierge', 'scholar', 'Legendary', { crown: true, salt: 'concierge' });
  const hour = new Date().getHours();
  const part = hour < 5 ? 'These are the deep hours. Only the devoted are still running.' : hour < 12 ? 'Good morning. The machines are just waking.' : hour < 18 ? 'Good afternoon. A steady day of work behind you.' : 'Good evening. The fire is lit and the seats are warm.';
  const top = latest.me && latest.me.topSpecies && latest.me.topSpecies !== '—' ? `Mostly ${latest.me.topSpecies.toLowerCase()} work, I see.` : '';
  const line = open ? `${part} You have ${fmtN(latest.creatures.length)} in your menagerie. ${top} Your agents are running, so the door is open. Sit, the usual seat by the fire.` : `${part} But your agents are still. The door stays shut until the machines are thinking again. Come back mid-run.`;
  const night = latest.creatures.filter((c) => c.traits.includes('Nightshift'));
  const owl = latest.skills && latest.skills.list.find((s) => s.key === 'nightowl');
  const lastNight = night[0];
  return `<div class="section-lead">Not a place to be productive. A candlelit room that opens only while your agents are really running, where a concierge who knows your day receives you.</div>
  <div class="grid cols-2">
    <div class="lounge ${open ? '' : 'closed'}">
      <div class="doorstate">${open ? '● the door is open' : '○ the door is closed'}</div>
      ${creatureSVG(conc, 168, { live: true })}
      <div class="concierge-name">Barnaby, the Concierge</div>
      <div class="concierge-line">"${escapeXml(line.replace(/\s+/g, ' ').trim())}"</div>
    </div>
    <div>
      <div class="panel"><div class="p-head"><h2>Right now</h2></div>
        <div class="net"><div class="n"><b>${latest.eggs.length}</b><span>${latest.eggs.length === 1 ? 'agent' : 'agents'} running</span></div><div class="n"><b>${latest.me ? latest.me.score.toFixed(1) : '0.0'}</b><span>your standing</span></div></div></div>
      <div class="panel" style="margin-top:16px"><div class="p-head"><h2>After hours</h2><span class="note">runs that finished between midnight and 5am</span></div>
        <div class="net"><div class="n"><b>${fmtN(night.length)}</b><span>Nightshift creatures</span></div>${owl ? `<div class="n"><b>Lv ${owl.level}</b><span>Night Owl · ${escapeXml(owl.title)}</span></div>` : ''}</div>
        ${lastNight ? `<div class="contrib" data-id="${escapeXml(lastNight.id)}" style="margin-top:12px">${creatureSVG(lastNight, 44)}<div><b>${escapeXml(lastNight.fullName)}</b><span>latest night run · ${shortDate(lastNight.bornAt)}</span></div></div>` : '<p class="note">No night runs yet.</p>'}</div>
    </div>
  </div>`;
}

// ---- topbar + nav ----
function topRight() {
  const running = latest.eggs.length, en = latest.engagement;
  const streak = en && en.streak ? `<div class="pill streak-pill" title="best ${en.bestStreak} days">${FLAME}<b>${en.streak}</b><span>day streak</span></div>` : '';
  return `<div class="pill ${running ? '' : 'idle'}"><span class="live"></span>${running ? (running > 1 ? running + ' agents working' : 'Claude is working') : 'idle'}</div>${streak}<div class="pill"><b>${fmtN(latest.creatures.length)}</b> creatures</div>`;
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
  stage.querySelectorAll('.tile[data-id], .mcard[data-id], .hcard[data-id], .rare-week[data-id], .link-c[data-id], .contrib[data-id]').forEach((el) => el.addEventListener('click', () => openModal(findCreature(el.dataset.id))));
  stage.querySelectorAll('.brow[data-handle]').forEach((el) => el.addEventListener('click', () => openProfile(el.dataset.handle)));
  stage.querySelectorAll('.skill-card[data-skill]').forEach((el) => el.addEventListener('click', () => openSkill(el.dataset.skill)));
  stage.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => setSection(el.dataset.go)));
  const cfa = stage.querySelector('#cfa'), cfb = stage.querySelector('#cfb');
  if (cfa) cfa.addEventListener('change', doCrossfeed);
  if (cfb) cfb.addEventListener('change', doCrossfeed);
  const wx = stage.querySelector('#wx'); if (wx) wx.onclick = () => { try { localStorage.setItem('pol_welcomed', '1'); } catch {} renderActive(); };
  const seeall = stage.querySelector('#seeall'); if (seeall) seeall.onclick = () => setSection('collection');
  const rp = stage.querySelector('#replay'); if (rp) rp.onclick = () => { sfx.unlock(); queueReveals([latest.creatures[0]], true); };
  const on = stage.querySelector('#opennew'); if (on) on.onclick = () => openModal(latest.creatures[0]);
  const gs = stage.querySelector('#goalsel'); if (gs) gs.onchange = async () => { const [type, target] = gs.value.split(':'); try { await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal: { type, target: Number(target) } }) }); } catch {} poll(true); };
  const skc = stage.querySelector('#skcard'); if (skc) skc.onclick = () => downloadSkillCard(latest.skills.list.find((s) => s.key === skc.dataset.skill));
  // total level counts up only after a real level-up seen in this tab
  const tl = stage.querySelector('#tlnum');
  if (tl) { const to = Number(tl.dataset.to); if (shownTotal != null && shownTotal !== to && !reduceMotion()) countUp(tl, shownTotal, to); shownTotal = to; }
  latest.creatures.forEach((c) => known.add(c.id));
}
const reduceMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el, from, to) {
  const t0 = performance.now(), dur = 1100;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtN(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); else el.classList.add('bump'); };
  requestAnimationFrame(step);
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
const HASH_ALIAS = { antechamber: 'lounge', shelf: 'collection', how: 'proof' };
function setSection(key, fromHash) {
  key = HASH_ALIAS[key] || key;
  if (!SECTIONS.find((s) => s.key === key)) key = 'home';
  current = key;
  if (!PRIMARY_KEYS.includes(key)) moreOpen = true; // reveal the More group if landing on an advanced page
  buildRail();
  if (!fromHash && location.hash.replace('#', '') !== key) location.hash = key; // a real history entry, so Back works
  renderActive();
  if (!fromHash) window.scrollTo(0, 0);
}
function buildRail() {
  const item = (s) => `<button class="rbtn ${s.key === current ? 'active' : ''}" data-key="${s.key}">${s.icon}<span class="rlabel">${s.label}</span></button>`;
  const primary = SECTIONS.filter((s) => PRIMARY_KEYS.includes(s.key)).map(item).join('');
  const advanced = SECTIONS.filter((s) => !PRIMARY_KEYS.includes(s.key)).map(item).join('');
  document.getElementById('rail').innerHTML = primary +
    `<button class="more-toggle" id="moreToggle">More <span class="chev">${moreOpen ? '▴' : '▾'}</span></button>` +
    `<div class="more-items" ${moreOpen ? '' : 'hidden'}>${advanced}</div>`;
  document.querySelectorAll('.rbtn[data-key]').forEach((b) => b.addEventListener('click', () => setSection(b.dataset.key)));
  document.getElementById('moreToggle').addEventListener('click', () => { moreOpen = !moreOpen; buildRail(); });
  document.getElementById('mark').innerHTML = creatureSVG(demoCreature('mark', 'hydra', 'Epic', { crown: false, salt: 'mk' }), 32) + '<span class="mark-txt">Proof of Life</span>';
  const st = document.getElementById('sound');
  if (st) { st.innerHTML = (sfx.on ? IC.soundOn : IC.soundOff) + `<span class="rlabel">Sound ${sfx.on ? 'on' : 'off'}</span>`; st.setAttribute('aria-pressed', sfx.on ? 'true' : 'false'); st.title = sfx.on ? 'Sound on' : 'Sound off'; }
}
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
  tileSeq = 0;
  const grid = p.creatures && p.creatures.length ? `<div class="shelf" style="margin-top:12px">${p.creatures.slice(0, 6).map((c) => tileHTML(c, { noNew: true })).join('')}</div>` : `<p class="note">No creatures yet.</p>`;
  document.getElementById('modal-card').innerHTML = `<div class="ava big" style="background:${p.accent || '#67e39a'};margin:0 auto">${initials(p.handle)}</div>
    <h3>@${escapeXml(p.handle)} ${p.you ? '<span class="chip" style="color:var(--green)">you</span>' : p.sample ? '<span class="chip" style="color:var(--violet)">sample</span>' : ''}</h3>
    <div class="stats-row" style="justify-content:center;margin:14px 0">
      <div class="stat"><b>${p.score.toFixed(1)}</b><span>flex</span></div><div class="stat"><b>${fmtN(p.runs)}</b><span>runs</span></div><div class="stat"><b>${Number(p.hours || 0).toFixed(1)}</b><span>hrs</span></div><div class="stat"><b>${fmtN(p.survivors || 0)}</b><span>survivors</span></div></div>
    <div class="pshare"><input id="plink" readonly value="${escapeXml(link)}"/><button class="primary" id="copy">Copy link</button>${p.you ? '<button id="edit">Edit</button>' : ''}</div>${grid}
    <div class="btns" style="margin-top:14px"><button id="close">Close</button></div>`;
  document.getElementById('modal-card').classList.add('wide');
  document.getElementById('modal').hidden = false;
  document.getElementById('close').onclick = closeModal;
  const cp = document.getElementById('copy'); cp.onclick = () => { try { navigator.clipboard.writeText(link); } catch {} cp.textContent = 'Copied'; setTimeout(() => (cp.textContent = 'Copy link'), 1400); };
  const ed = document.getElementById('edit'); if (ed) ed.onclick = editIdentity;
  document.getElementById('modal-card').querySelectorAll('.tile[data-id]').forEach((t) => t.addEventListener('click', () => openModal((p.creatures || []).find((c) => c.id === t.dataset.id))));
}
async function editIdentity() {
  const handle = prompt('Your handle (letters, numbers, underscore):', (latest.me && latest.me.handle) || ''); if (handle == null) return;
  const displayName = prompt('Display name:', (latest.me && latest.me.displayName) || '') || undefined;
  const r = await fetch('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle, displayName }) });
  if (r.status === 409) { alert('That handle is already taken on this server.'); return; }
  closeModal(); poll(true);
}

// ---- modal (creature) ----
function closeModal() { const m = document.getElementById('modal'); m.hidden = true; document.getElementById('modal-card').classList.remove('wide'); }
function openModal(c) {
  if (!c) return;
  const gains = gainsOf(c).slice(0, 4);
  const rows = [['species', c.speciesName], ['rarity', c.rarity.tier], ['level', `Lv ${c.level || 1} · ${levelLabel(c)}`], ['forged from', c.bredBy ? 'cross-feed · ' + c.domain + ' work' : originLine(c).replace(/^grew from /, '')], ['traits', c.traits.length ? c.traits.join(', ') : 'none'], ['status', c.status === 'healthy' ? 'healthy' : c.status === 'healed' ? 'healed survivor' : 'sick · needs care'], [c.bredBy ? 'bred by' : 'born', c.bredBy ? '@' + c.bredBy.join(' + @') : new Date(c.bornAt).toLocaleString()]].map(([k, v]) => `<div class="row"><span>${k}</span><span>${escapeXml(v)}</span></div>`).join('');
  const att = `<div class="att"><div class="att-row"><span>attestation</span><span class="mono">${c.att ? escapeXml(c.att.fp) + ' · ed25519' : 'unsigned'}</span></div><button id="verify" class="ghost">Verify signature</button><div id="vres" class="vres"></div></div>`;
  document.getElementById('modal-card').classList.remove('wide');
  document.getElementById('modal-card').innerHTML = `<div class="m-art" style="--tier:${c.rarity.chip}">${creatureVisual(c, 196, { live: true })}</div><span class="chip" style="color:${c.rarity.chip}">${c.rarity.tier}</span><h3>${escapeXml(c.fullName)}</h3>${gains.length ? `<div class="gains center">${gains.map(([k, v]) => `<span class="gain">+${fmtN(v)} ${escapeXml(skillName(k))}</span>`).join('')}</div>` : ''}<div class="rows">${rows}</div>${att}
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
      vres.innerHTML = r.valid ? `✓ Verified · signed by attestor ${escapeXml(r.signer || '')}` : `✗ Invalid signature${r.reason ? ' · ' + escapeXml(r.reason) : ''}`;
    } catch { vres.className = 'vres bad'; vres.textContent = 'verify request failed'; }
  };
}
document.getElementById('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!document.getElementById('reveal').hidden) closeReveal(); else closeModal(); } });
document.getElementById('sound').addEventListener('click', () => sfx.toggle());

// ---- hatch reveal ceremony: egg wobbles and cracks, rarity flash, creature lands ----
// revealMarkup is a pure function of the creature: same seed, same ceremony, byte for byte.
const FLASH_OP = { Common: 0.35, Uncommon: 0.45, Rare: 0.55, Epic: 0.66, Mythic: 0.74, Legendary: 0.8 };
const CONFETTI_N = { Epic: 40, Mythic: 80, Legendary: 120 };
function confettiSVG(c) {
  const n = CONFETTI_N[c.rarity.tier]; if (!n) return '';
  const rng = rngFor((c.seed ^ 0xc0ffee) >>> 0), pal = [c.rarity.chip, (ART_PAL[c.speciesKey] || ART_PAL.wisp).glow, '#f5c451', '#ffffff', '#ff7bd0', '#7bf0ff', '#6ee7a5'];
  let q = '';
  for (let i = 0; i < n; i++) {
    const x = rng() * 1000, y = -40 - rng() * 260, col = pal[Math.floor(rng() * pal.length)], s = 6 + rng() * 9, dl = (0.85 + rng() * 0.9).toFixed(2), du = (1.9 + rng() * 1.6).toFixed(2), dx = Math.round((rng() - 0.5) * 220), rot = Math.round((rng() - 0.5) * 1080);
    const shape = rng() < 0.62 ? `<rect x="${F(-s / 2)}" y="${F(-s * 0.3)}" width="${F(s)}" height="${F(s * 0.6)}" rx="1.2" fill="${col}"/>` : `<circle r="${F(s * 0.38)}" fill="${col}"/>`;
    q += `<g transform="translate(${F(x)} ${F(y)})"><g class="cf" style="--dx:${dx}px;--rot:${rot}deg;animation-delay:${dl}s;animation-duration:${du}s">${shape}</g></g>`;
  }
  return `<svg class="rv-confetti" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${q}</svg>`;
}
function revealMarkup(c, more) {
  const T = c.rarity.tier, chip = c.rarity.chip, glow = (ART_PAL[c.speciesKey] || ART_PAL.wisp).glow;
  const gains = gainsOf(c).slice(0, 4);
  const sig = [c.durationLabel ? `${c.durationLabel} run` : '', c.toolCalls ? plural(c.toolCalls, 'tool call') : '', c.subagents ? plural(c.subagents, 'subagent') : ''].filter(Boolean);
  const rays = T === 'Legendary' || T === 'Mythic' ? `<div class="rv-rays ${T === 'Mythic' ? 'myth' : ''}"></div>` : '';
  return `<div class="rv-flash" style="--chip:${chip};--fo:${FLASH_OP[T] || 0.4}"></div>${confettiSVG(c)}
    <div class="rv-stage" style="--chip:${chip};--glow:${glow}">
      <div class="rv-eyebrow">${c.bredBy ? 'A hybrid was bred' : 'A new creature hatched'}</div>
      <div class="rv-pod">${rays}<div class="rv-halo"></div><div class="rv-eggwrap">${eggSVG(c.seed, glow, 230, { crack: true, k: 'rv' })}</div><div class="rv-creature">${creatureSVG(c, 300, { live: true })}</div></div>
      <div class="rv-tier" style="color:${chip}">${T}</div>
      <h2 class="rv-name">${escapeXml(c.fullName)}</h2>
      <div class="rv-sig">${escapeXml(c.speciesName)}${sig.length ? ' · ' + sig.map(escapeXml).join(' · ') : ''}${c.traits.length ? ' · ' + c.traits.map(escapeXml).join(', ') : ''}</div>
      ${gains.length ? `<div class="gains center rv-gains">${gains.map(([k, v]) => `<span class="gain">+${fmtN(v)} ${escapeXml(skillName(k))}</span>`).join('')}</div>` : ''}
      ${more ? `<div class="note rv-more">and ${plural(more, 'more creature')} hatched with it</div>` : ''}
      <div class="btns rv-btns"><button class="primary" data-rv="save">Save card</button><button data-rv="close">Close</button></div>
    </div>`;
}
let revealQ = [], revealing = null, revealTimers = [];
function queueReveals(list, replay) {
  const sorted = list.slice().sort((a, b) => b.rarity.index - a.rarity.index || (b.durationMs || 0) - (a.durationMs || 0));
  const show = sorted.slice(0, 3), more = sorted.length - show.length;
  show.forEach((c, i) => revealQ.push({ c, more: i === show.length - 1 ? more : 0, replay }));
  if (!revealing) nextReveal();
}
function nextReveal() {
  const it = revealQ.shift(); const el = document.getElementById('reveal');
  if (!it) { revealing = null; el.hidden = true; el.innerHTML = ''; document.body.classList.remove('rv-open'); flushToasts(); return; }
  revealing = it.c;
  el.className = 'reveal t-' + it.c.rarity.tier.toLowerCase() + (reduceMotion() ? ' rv-still' : '');
  el.innerHTML = revealMarkup(it.c, it.more);
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

// ---- level-up and milestone toasts (stacked bottom-right, never on first load) ----
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
    const p = prev.lv[s.key]; if (!p || s.level <= p.l && s.stars <= p.s) continue;
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
    el.className = 'ltoast' + (t.big ? ' big' : '');
    el.style.setProperty('--band', t.band.color);
    el.innerHTML = `<div class="lt-ring">${t.flame ? FLAME : ringSVG(t.big ? 52 : 40, t.pct, t.band, `<text x="${t.big ? 26 : 20}" y="${t.big ? 31 : 24.5}" text-anchor="middle" class="ring-n${t.big && t.n < 100 ? "" : " sm"}">${t.n}</text>`, { sw: t.big ? 5 : 4, fill: true })}</div><div><b>${escapeXml(t.title)}</b><span>${escapeXml(t.sub)}</span></div>`;
    el.onclick = () => el.remove();
    stack.appendChild(el);
    setTimeout(() => el.classList.add('out'), t.big ? 5200 : 4000); setTimeout(() => el.remove(), t.big ? 5600 : 4400);
    t.big ? sfx.chord() : sfx.chime();
  }
}

// ---- shareable cards: one SVG, rasterized at 2x ----
const CARD_PRESETS = { portrait: [1080, 1350], og: [1200, 630] };
function cardFoil(c, W, H) {
  if (c.rarity.index < 3 && c.rarity.tier !== 'Mythic') return { defs: '', layer: '' };
  const rng = rngFor((c.seed ^ 0xf011) >>> 0), ang = Math.round(15 + rng() * 60);
  const stops = c.rarity.tier === 'Mythic' ? ['#ff7bd0', '#7bf0ff', '#b28dff', '#ff7bd0', '#7bf0ff'] : ['#ff7bd0', '#f5c451', '#6ee7a5', '#67a8f0', '#b28dff', '#ff7bd0'];
  return { defs: `<linearGradient id="foil" gradientTransform="rotate(${ang} .5 .5)">${stops.map((s, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('')}</linearGradient>`, layer: `<clipPath id="cardclip"><rect width="${W}" height="${H}" rx="40"/></clipPath><g clip-path="url(#cardclip)"><rect x="${-W}" y="${F(H / 2 - H * 0.16)}" width="${W * 3}" height="${F(H * 0.32)}" transform="rotate(${ang - 60} ${W / 2} ${H / 2})" fill="url(#foil)" opacity=".25" style="mix-blend-mode:screen"/></g>` };
}
function buildCardSVG(c, preset) {
  const [W, H] = CARD_PRESETS[preset] || CARD_PRESETS.portrait, chip = c.rarity.chip, bgTop = c.bg === '#0c0e16' ? '#1d1a3c' : '#222a40';
  const foil = cardFoil(c, W, H), g = gainsOf(c)[0], fp = c.att ? c.att.fp : null, handle = c.bredBy ? '@' + c.bredBy.join(' + @') : latest.me ? '@' + latest.me.handle : '';
  const origin = c.bredBy ? `bred from ${c.domain || 'shared'} work` : `forged from ${aAn(c.durationLabel)} ${c.durationLabel} agent run${c.toolCalls ? ' · ' + plural(c.toolCalls, 'tool call') : ''}`;
  const traits = c.traits.length ? c.traits.join('  ·  ') : '';
  const T = (x, y, size, fill, txt, o) => `<text x="${x}" y="${y}" ${o && o.start ? '' : 'text-anchor="middle"'} font-family="${o && o.serif ? 'Georgia,serif' : 'system-ui,Segoe UI,sans-serif'}" font-size="${size}" fill="${fill}"${o && o.ls ? ` letter-spacing="${o.ls}"` : ''}${o && o.w ? ` font-weight="${o.w}"` : ''}>${escapeXml(txt)}</text>`;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="bgg" cx="50%" cy="34%" r="75%"><stop offset="0%" stop-color="${bgTop}"/><stop offset="100%" stop-color="${c.bg || '#141821'}"/></radialGradient><radialGradient id="spot" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${chip}" stop-opacity=".32"/><stop offset="1" stop-color="${chip}" stop-opacity="0"/></radialGradient>${foil.defs}${PL_DEFS}</defs><rect width="${W}" height="${H}" rx="40" fill="url(#bgg)"/>${foil.layer}<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="30" fill="none" stroke="${chip}" stroke-opacity=".6" stroke-width="3"/>`;
  const verify = fp ? `verify: ${fp} · ed25519` : 'unsigned';
  if (preset === 'og') {
    return head + `<circle cx="330" cy="315" r="270" fill="url(#spot)"/><g transform="translate(110 40) scale(2.2)">${creatureInner(c, rngFor(c.seed))}</g>` +
      T(640, 120, 22, '#8d96b3', 'PROOF OF LIFE', { start: 1, ls: 5, w: 600 }) + T(640, 200, 30, chip, c.rarity.tier.toUpperCase(), { start: 1, ls: 6, w: 700 }) + T(640, 268, Math.min(56, Math.floor(1000 / c.fullName.length)), '#f4f2ff', c.fullName, { start: 1, serif: 1 }) +
      T(640, 318, 24, '#aab2cc', `${c.speciesName} · Lv ${c.level || 1}`, { start: 1 }) + T(640, 360, 22, '#8d96b3', origin, { start: 1 }) +
      (g ? `<rect x="640" y="392" width="${Math.min(460, 34 + (fmtN(g[1]).length + skillName(g[0]).length + 2) * 15)}" height="46" rx="23" fill="${chip}" fill-opacity=".14" stroke="${chip}" stroke-opacity=".5"/>` + T(662, 423, 22, '#f4f2ff', `+${fmtN(g[1])} ${skillName(g[0])}`, { start: 1, w: 600 }) : '') +
      T(640, 520, 20, '#7e88a6', verify, { start: 1 }) + T(640, 552, 20, '#646d88', `${handle} · minted from real machine hours`, { start: 1 }) + '</svg>';
  }
  return head + `<circle cx="540" cy="520" r="420" fill="url(#spot)"/>` + T(80, 104, 24, '#8d96b3', 'PROOF OF LIFE', { start: 1, ls: 6, w: 600 }) +
    `<rect x="${W - 80 - (c.rarity.tier.length * 20 + 48)}" y="70" width="${c.rarity.tier.length * 20 + 48}" height="48" rx="24" fill="none" stroke="${chip}" stroke-width="2.5"/>` + T(W - 80 - (c.rarity.tier.length * 20 + 48) / 2, 103, 22, chip, c.rarity.tier.toUpperCase(), { ls: 4, w: 700 }) +
    `<g transform="translate(140 150) scale(4)">${creatureInner(c, rngFor(c.seed))}</g>` +
    T(540, 1070, Math.min(68, Math.floor(1800 / c.fullName.length)), '#f4f2ff', c.fullName, { serif: 1 }) + T(540, 1124, 28, chip, `${c.rarity.tier} · ${c.speciesName} · Lv ${c.level || 1}`, { w: 600 }) + T(540, 1172, 26, '#a2abc6', origin) + (traits ? T(540, 1212, 22, '#7e88a6', traits) : '') +
    `<path d="M80 1250H${W - 80}" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/>` +
    (g ? T(80, 1298, 26, '#f4f2ff', `+${fmtN(g[1])} ${skillName(g[0])}`, { start: 1, w: 600 }) : T(80, 1298, 24, '#7e88a6', handle, { start: 1 })) +
    `<text x="${W - 80}" y="1290" text-anchor="end" font-family="ui-monospace,Consolas,monospace" font-size="20" fill="#8d96b3">${escapeXml(verify)}</text><text x="${W - 80}" y="1318" text-anchor="end" font-family="system-ui,sans-serif" font-size="18" fill="#646d88">${escapeXml((g ? handle + ' · ' : '') + 'minted from real machine hours')}</text></svg>`;
}
function buildSkillCardSVG(s) {
  const W = 1080, H = 1350, sk = latest.skills, col = s.band.color, r = 230, C = 2 * Math.PI * r, p = s.tracking ? 0 : s.pct;
  const sig = demoCreature('sig-' + s.key, s.species, s.level >= 60 ? 'Legendary' : tierForLevel(s.level), { crown: s.level >= 60, salt: 'sig', orbiters: s.stars });
  const ringStroke = s.band.gradient || s.band.key === 'mythic' ? 'url(#iri)' : s.band.ring === 'gold' || s.band.key === 'paragon' ? '#f5c451' : col;
  const T = (x, y, size, fill, txt, o) => `<text x="${x}" y="${y}" text-anchor="${(o && o.a) || 'middle'}" font-family="${o && o.serif ? 'Georgia,serif' : 'system-ui,Segoe UI,sans-serif'}" font-size="${size}" fill="${fill}"${o && o.ls ? ` letter-spacing="${o.ls}"` : ''}${o && o.w ? ` font-weight="${o.w}"` : ''}>${escapeXml(txt)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="bgg" cx="50%" cy="36%" r="75%"><stop offset="0" stop-color="#20263a"/><stop offset="1" stop-color="#0d0f16"/></radialGradient><radialGradient id="spot" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${col}" stop-opacity=".3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><linearGradient id="iri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7bd0"/><stop offset=".35" stop-color="#7bf0ff"/><stop offset=".7" stop-color="#b28dff"/><stop offset="1" stop-color="#f5c451"/></linearGradient>${PL_DEFS}</defs>
    <rect width="${W}" height="${H}" rx="40" fill="url(#bgg)"/><rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="30" fill="none" stroke="${col}" stroke-opacity=".55" stroke-width="3"/>
    ${T(80, 104, 24, '#8d96b3', 'PROOF OF LIFE · SKILL', { a: 'start', ls: 6, w: 600 })}
    <circle cx="540" cy="520" r="330" fill="url(#spot)"/>
    <circle cx="540" cy="520" r="${r}" fill="none" stroke="#1c1e26" stroke-width="34"/><circle cx="540" cy="520" r="${r}" fill="none" stroke="${ringStroke}" stroke-width="34" stroke-linecap="round" stroke-dasharray="${F(C * p)} ${F(C)}" transform="rotate(-90 540 520)"/>
    <g transform="translate(380 340) scale(1.6)">${creatureInner(sig, rngFor(sig.seed))}</g>
    ${T(540, 840, 34, col, s.title.toUpperCase(), { ls: 8, w: 700 })}
    ${T(540, 930, 84, '#f4f2ff', s.name, { serif: 1 })}
    ${T(540, 1010, 44, '#d8dcea', 'Level ' + s.level + (s.stars ? '  ' + '★'.repeat(s.stars) : ''), { serif: 1 })}
    ${T(540, 1064, 26, '#a2abc6', `${fmtN(s.xp)} xp · ${plural(s.creatures, 'run')} · ${nextLine(s)}`)}
    <path d="M80 1180H${W - 80}" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/>
    ${T(80, 1240, 28, '#f4f2ff', `Total level ${fmtN(sk.totalLevel)} · ${sk.totalBand.name}`, { a: 'start', w: 600 })}
    ${T(80, 1282, 22, '#7e88a6', `${latest.me ? '@' + latest.me.handle : ''} · ${fmtN(sk.totalXp)} xp across ${sk.list.filter((x) => !x.tracking).length} skills`, { a: 'start' })}
    ${T(W - 80, 1282, 20, '#646d88', 'from real agent runs', { a: 'end' })}</svg>`;
}
function saveSVG(svg, W, H, name) {
  const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.onload = () => { const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; const ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url); const a = document.createElement('a'); a.download = name + '.png'; a.href = cv.toDataURL('image/png'); a.click(); };
  img.onerror = () => { URL.revokeObjectURL(url); alert('Could not render the card in this browser.'); };
  img.src = url;
}
function downloadCard(c, preset) { if (!c) return; const [W, H] = CARD_PRESETS[preset] || CARD_PRESETS.portrait; saveSVG(buildCardSVG(c, preset), W, H, c.fullName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + (preset === 'og' ? '-wide' : '')); }
function downloadSkillCard(s) { if (s) saveSVG(buildSkillCardSVG(s), 1080, 1350, 'skill-' + s.key + '-lv' + s.level); }

// ---- loop ----
let lastSig = '';
async function poll(force) {
  try {
    const tz = new Date().getTimezoneOffset();
    const [st, bd, be] = await Promise.all([fetch('/api/state?tz=' + tz).then((r) => r.json()), fetch('/api/board').then((r) => r.json()), fetch('/api/bestiary').then((r) => r.json())]);
    // a genuinely new creature gets its hatch ceremony, once; ids are marked known here so an open modal can't repeat it
    const fresh = firstLoad ? [] : st.creatures.filter((c) => !known.has(c.id));
    st.creatures.forEach((c) => known.add(c.id));
    const prevSnap = seenSkills;
    latest = st; boardData = bd.board || []; boardSamples = !!bd.samples; bestiaryData = be;
    if (!cfState.a && be.breeds && be.breeds.length) { cfState.a = be.breeds[0].bredBy[0]; cfState.b = be.breeds[0].bredBy[1]; cfState.result = { creature: be.breeds[0], domain: be.breeds[0].domain }; }
    if (!pubInfo) fetch('/api/pubkey').then((r) => r.json()).then((p) => { pubInfo = p; if (current === 'proof' && document.getElementById('modal').hidden) renderActive(); }).catch(() => {});
    document.getElementById('railme').innerHTML = `<span class="av" style="background:${(st.me && st.me.accent) || '#67e39a'}">${st.me ? initials(st.me.handle) : '?'}</span><span>@${escapeXml(st.me ? st.me.handle : 'you')}</span>`;
    if (fresh.length) queueReveals(fresh);
    // level-up toasts: diff against what this browser last saw (never on first load)
    const snap = snapSkills(st);
    if (!firstLoad) diffSkills(prevSnap, st);
    if (snap) { seenSkills = snap; try { localStorage.setItem('pol_seen', JSON.stringify(snap)); } catch {} }
    const sig = `${current}|${st.rev}|${st.creatures.length}|${st.eggs.length}|${st.me ? st.me.score : 0}|${boardData.length}|${be.network ? be.network.breeds : 0}|${st.skills ? st.skills.list.map((s) => s.level).join() : ''}|${st.engagement ? st.engagement.goal.progress + ':' + st.engagement.goal.target : ''}`;
    if ((force || sig !== lastSig) && document.getElementById('modal').hidden) { lastSig = sig; renderActive(); }
    firstLoad = false;
  } catch (e) {}
}
function tickTimers() {
  document.querySelectorAll('.egg[data-start]').forEach((el) => { const s = Math.max(0, Math.round((Date.now() - Number(el.dataset.start)) / 1000)), t = el.querySelector('.timer'); if (t) t.textContent = s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm'; });
}
function readHash() {
  const h = decodeURIComponent(location.hash.replace('#', ''));
  if (h.startsWith('u/')) { if (current !== 'board') setSection('board', true); openProfile(h.slice(2)); }
  else { const k = HASH_ALIAS[h] || h || 'home'; if (k !== current || !document.getElementById('stage').innerHTML) setSection(k, true); }
}
window.addEventListener('hashchange', readHash);

seenSkills = loadSeen();
buildRail();
loadArt().then(() => poll(true)).then(readHash);
setInterval(() => { if (!document.hidden) poll(false); }, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(false); });
setInterval(tickTimers, 1000);
