// Proof of Life — collectible variants
// Every creature's look is read off its signed seed: a colorway, a pattern, an
// accessory, an expression, an eye style and, about 1 in 64, a Shiny. None of
// it is stored or signed; the same seed always gives the same variant, so all
// existing creatures gained their variety the moment this file shipped.
// Shared: the page draws from it, the server counts it (Collector, the Dex).
// Zero dependencies. Every pick comes from a seeded stream, never a random source.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.POLVariants = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hashString(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; }
  function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // an independent stream per purpose: the shiny roll never correlates with the
  // engine's seed % 12 'Restless' temperament or with any other pick
  const stream = (seed, salt) => mulberry32(hashString(salt + '#' + (seed >>> 0)));

  const SPECIES_KEYS = ['cog', 'scholar', 'moth', 'prism', 'lumen', 'hydra', 'wisp'];
  const TIERS = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const TIER_RANK = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 };

  // ---- colorways: eight per species, the first is the classic (twice as common) ----
  // body: vinyl color, iris: eye color, glow: aura/light color, trim: a second
  // color for details. Lumen colorways recolor the light inside the lantern.
  const C = (key, name, body, iris, glow, trim) => ({ key, name, body, iris, glow, trim });
  const COLORWAYS = {
    cog: [C('gunmetal', 'Gunmetal', '#6d7a94', '#ffb53d', '#8fa2c9', '#f2b545'), C('copper', 'Copper', '#b8693f', '#7ef0e0', '#ffb07a', '#5fd4c4'), C('mint', 'Mint', '#5fb59d', '#ff8a5c', '#7ee0c4', '#ffd36b'), C('cherry', 'Cherry', '#c9505c', '#ffe27a', '#ff8a96', '#ffd36b'), C('arctic', 'Arctic', '#b9c6d8', '#4aa8ff', '#d8e6ff', '#4aa8ff'), C('graphite', 'Graphite', '#3c4254', '#ff5a4e', '#7d88a8', '#ff5a4e'), C('brass', 'Brass', '#a88a46', '#7bd3ff', '#ffd98a', '#e9d8a6'), C('grape', 'Grape', '#7a5fb5', '#9dffbf', '#b49aff', '#9dffbf')],
    scholar: [C('teal', 'Teal', '#2f8f8c', '#ffcf4a', '#65d6d6', '#f5c451'), C('snowy', 'Snowy', '#d7dee6', '#ffcf4a', '#eef4ff', '#9aa6b8'), C('barn', 'Barn', '#b0835a', '#1f1a14', '#f0c89a', '#f6e7c8'), C('midnight', 'Midnight', '#33406e', '#ffd36b', '#7d8cff', '#c8d2ff'), C('moss', 'Moss', '#5d8a4a', '#ffb24a', '#a8d68a', '#e8f0c0'), C('plum', 'Plum', '#7a4d86', '#ffd36b', '#c99ae0', '#f0d0ff'), C('ember', 'Ember', '#bd5c3a', '#ffe27a', '#ff9a6a', '#ffd9b0'), C('slate', 'Slate', '#5c6b7e', '#7ef0ff', '#9fb4cc', '#dfe8f2')],
    moth: [C('rose', 'Rose', '#cf87a0', '#ff9ec4', '#e6a3b6', '#f6e7d3'), C('luna', 'Luna', '#8fd1ad', '#4fb0ff', '#b6f0d0', '#f0fff6'), C('lilac', 'Lilac', '#ab93dc', '#ffcf6b', '#cdbcff', '#f4edff'), C('peach', 'Peach', '#eea37e', '#5a8cff', '#ffc8a8', '#fff0e3'), C('ghost', 'Ghost', '#e2dcec', '#b06bff', '#ffffff', '#c9bce0'), C('atlas', 'Atlas', '#c06a3c', '#ffe27a', '#ffad6b', '#ffe8c8'), C('dusk', 'Dusk', '#665894', '#ff9ec4', '#a99bff', '#e6dcff'), C('butter', 'Butter', '#e9cc72', '#7a5cff', '#fff0a8', '#fffbe6')],
    prism: [C('aqua', 'Aqua', '#5cc4ef', '#9be8ff', '#7bd6ff', '#ffffff'), C('amethyst', 'Amethyst', '#a07ae8', '#f3d9ff', '#c4a6ff', '#ffffff'), C('rosequartz', 'Rose Quartz', '#ef98bf', '#ffe0ef', '#ffb8d6', '#ffffff'), C('emerald', 'Emerald', '#36c487', '#d6ffe9', '#6ef0b0', '#ffffff'), C('citrine', 'Citrine', '#eec24a', '#fff3c4', '#ffd96b', '#ffffff'), C('ruby', 'Ruby', '#e0546c', '#ffd6dd', '#ff8a9c', '#ffffff'), C('obsidian', 'Obsidian', '#3a4152', '#b8c4ff', '#7a86b0', '#c8d2ff'), C('opal', 'Opal', '#cfe3ef', '#ffb8e0', '#ffffff', '#ffd6f0')],
    lumen: [C('amber', 'Amber', '#e59a3d', '#ffb24a', '#ffb959', '#ffe39a'), C('jade', 'Jade', '#3fbf86', '#56e0a0', '#6ef0b0', '#c8ffe4'), C('rose', 'Rose', '#e5708f', '#ff8fb0', '#ff9ec0', '#ffd6e2'), C('cobalt', 'Cobalt', '#4f84e0', '#6aa8ff', '#7ab8ff', '#d6e8ff'), C('violet', 'Violet', '#9a6ae5', '#b98cff', '#c4a0ff', '#ecdeff'), C('ember', 'Ember', '#e5583a', '#ff6a3d', '#ff7a4c', '#ffd0b8'), C('frost', 'Frost', '#7fc9e0', '#bff3ff', '#c8f6ff', '#ffffff'), C('lime', 'Lime', '#a5cc3f', '#c6f06a', '#d4f58a', '#f4ffd0')],
    hydra: [C('lime', 'Lime', '#3fbf74', '#9dffbf', '#67e39a', '#c4ffd9'), C('bubblegum', 'Bubblegum', '#f07aae', '#ffe0f0', '#ff9ec8', '#ffd6ea'), C('grape', 'Grape', '#9468e8', '#e6d8ff', '#b99aff', '#e6d8ff'), C('tangerine', 'Tangerine', '#f39437', '#fff0c4', '#ffb46b', '#ffe6c4'), C('ocean', 'Ocean', '#3aa2dc', '#d8f4ff', '#6ec4ff', '#d8f4ff'), C('lemon', 'Lemon', '#dccc3c', '#fffbd0', '#f0e46b', '#fffbd0'), C('toxic', 'Toxic', '#86e03e', '#f4ffd0', '#b4ff6b', '#f4ffd0'), C('ink', 'Ink', '#3b4468', '#9df0ff', '#7a86c8', '#c8d2ff')],
    wisp: [C('lavender', 'Lavender', '#8f7bd6', '#c8b8ff', '#a48ff0', '#efe8ff'), C('mint', 'Mint', '#6fd2b6', '#d6fff2', '#8ef0d6', '#e6fff8'), C('peach', 'Peach', '#f4a580', '#fff0e6', '#ffc0a0', '#fff0e6'), C('sky', 'Sky', '#7fb8f0', '#e6f4ff', '#a6d0ff', '#e6f4ff'), C('blush', 'Blush', '#f08cb8', '#ffe6f2', '#ffaed0', '#ffe6f2'), C('cream', 'Cream', '#e8dcc0', '#7a5cff', '#fff6dc', '#fffaf0'), C('shadow', 'Shadow', '#4a4468', '#ff7bd0', '#8a7bd0', '#d6ccff'), C('teal', 'Teal', '#47a8a8', '#d6ffff', '#6ad8d8', '#e0ffff')],
  };

  // ---- patterns (Uncommon and up), clipped to the body ----
  const PATTERNS = [
    { key: 'spots', adj: 'Spotted' }, { key: 'stripes', adj: 'Striped' }, { key: 'panel', adj: 'Two-Tone' },
    { key: 'freckles', adj: 'Freckled' }, { key: 'zigzag', adj: 'Zigzag' }, { key: 'stars', adj: 'Starry' },
  ];
  // ---- accessories (Uncommon and up), one slot, only what fits each body ----
  const ACCESSORIES = {
    scarf: { key: 'scarf', name: 'Scarf' }, headphones: { key: 'headphones', name: 'Headphones' }, goggles: { key: 'goggles', name: 'Goggles' },
    beanie: { key: 'beanie', name: 'Beanie' }, bow: { key: 'bow', name: 'Bow' }, sprout: { key: 'sprout', name: 'Sprout' }, visor: { key: 'visor', name: 'Visor' },
  };
  const ACC_FOR = {
    cog: ['headphones', 'goggles', 'sprout', 'bow', 'visor'],
    scholar: ['beanie', 'scarf', 'headphones', 'goggles', 'bow', 'sprout'],
    moth: ['beanie', 'bow', 'headphones', 'goggles', 'sprout', 'visor'],
    prism: ['visor', 'headphones', 'goggles', 'bow', 'sprout'],
    lumen: ['scarf', 'headphones', 'goggles', 'bow', 'visor'],
    hydra: ['beanie', 'sprout', 'bow', 'headphones', 'visor'],
    wisp: ['scarf', 'beanie', 'headphones', 'bow', 'goggles', 'visor'],
  };
  // accessory colors (knits, plastics) picked per creature
  const ACC_COLORS = ['#e8615b', '#f5c451', '#4aa8ff', '#6ee7a5', '#ff7bd0', '#f4f1ea', '#3fc1c9', '#b28dff'];

  // ---- faces ----
  const EXPRESSIONS = [
    { key: 'grin', name: 'Toothy grin', w: 3 }, { key: 'smug', name: 'Smug', w: 2 }, { key: 'sleepy', name: 'Sleepy', w: 1.5 },
    { key: 'wink', name: 'Wink', w: 1.5 }, { key: 'tongue', name: 'Tongue out', w: 2 }, { key: 'determined', name: 'Determined', w: 2 },
    { key: 'calm', name: 'Calm', w: 2 },
  ];
  const EYES = [{ key: 'classic', name: 'Classic' }, { key: 'sparkle', name: 'Sparkle' }, { key: 'slit', name: 'Cat-eye' }, { key: 'ring', name: 'Ringed' }];

  // ---- growth: the look follows the level the herd raised it to ----
  const STAGES = [
    { key: 'hatchling', name: 'Hatchling', from: 1 },
    { key: 'juvenile', name: 'Juvenile', from: 3 },
    { key: 'adult', name: 'Adult', from: 5 },
    { key: 'elder', name: 'Elder', from: 7 },
    { key: 'exalted', name: 'Exalted', from: 9 },
  ];
  function stageOf(c) {
    if (c && (c.bredBy || c.parents)) return STAGES[2]; // a hybrid arrives grown
    const L = Math.max(1, (c && c.level) || 1);
    let s = STAGES[0]; for (const x of STAGES) if (L >= x.from) s = x;
    return s;
  }

  const SHINY_ODDS = 64;
  function weighted(list, r) { const tot = list.reduce((a, x) => a + (x.w || 1), 0); let t = r * tot; for (const x of list) { t -= x.w || 1; if (t < 0) return x; } return list[list.length - 1]; }
  function speciesOf(c) { return c && COLORWAYS[c.speciesKey] ? c.speciesKey : 'wisp'; }
  function tierOf(c) { const t = c && c.rarity && c.rarity.tier; return TIER_RANK[t] != null ? t : 'Common'; }

  // c: { seed, speciesKey, rarity: { tier }, level, bredBy?, parents?, vo? (demo overrides) }
  const memo = new Map();
  function variantOf(c) {
    const seed = (c && c.seed) >>> 0, sk = speciesOf(c), T = tierOf(c), rank = TIER_RANK[T];
    const key = seed + '|' + sk + '|' + T + '|' + ((c && c.vo) ? JSON.stringify(c.vo) : '');
    let v = memo.get(key);
    if (v) return v;
    const r = stream(seed, 'variant'), roll = [r(), r(), r(), r(), r(), r(), r(), r(), r()]; // fixed draw order
    const shiny = stream(seed, 'shiny')() * SHINY_ODDS < 1;
    const cws = COLORWAYS[sk];
    const cwi = roll[0] < 2 / 9 ? 0 : 1 + Math.floor(((roll[0] - 2 / 9) / (7 / 9)) * 7);
    let colorway = cws[Math.min(cws.length - 1, cwi)];
    let pattern = rank >= 1 ? PATTERNS[Math.floor(roll[1] * PATTERNS.length)] : null;
    const accList = ACC_FOR[sk];
    let accessory = rank >= 1 ? ACCESSORIES[accList[Math.floor(roll[2] * accList.length)]] : null;
    let expression = weighted(EXPRESSIONS, roll[3]);
    let eyes = EYES[Math.floor(roll[4] * EYES.length)];
    const accColor = ACC_COLORS[Math.floor(roll[5] * ACC_COLORS.length)];
    let material = 'vinyl';
    if (T === 'Mythic') material = 'iridescent';
    else if (shiny) material = roll[6] < 0.5 ? 'chrome' : 'holo';
    else if (T === 'Legendary') material = roll[6] < 0.6 ? 'gold' : 'holo';
    if (T === 'Legendary' || T === 'Mythic') eyes = { key: T === 'Mythic' ? 'galaxy' : 'star', name: T === 'Mythic' ? 'Galaxy' : 'Star' };
    // demo creatures (the rules pages, skill glyphs) can pin any part
    const vo = c && c.vo;
    if (vo) {
      if (vo.colorway) colorway = vo.colorway === 'classic' ? cws[0] : cws.find((x) => x.key === vo.colorway) || cws[0];
      if (vo.pattern !== undefined) pattern = vo.pattern ? PATTERNS.find((x) => x.key === vo.pattern) || null : null;
      if (vo.accessory !== undefined) accessory = vo.accessory ? ACCESSORIES[vo.accessory] || null : null;
      if (vo.expression) expression = EXPRESSIONS.find((x) => x.key === vo.expression) || expression;
      if (vo.eyes) eyes = EYES.find((x) => x.key === vo.eyes) || eyes;
      if (vo.material) material = vo.material;
    }
    const isShiny = vo && vo.shiny != null ? !!vo.shiny : shiny;
    const MAT = { gold: 'Gold Chrome', holo: 'Holo', chrome: 'Chrome', iridescent: 'Iridescent' };
    const base = MAT[material] || colorway.name;
    const name = [isShiny ? 'Shiny' : '', pattern ? pattern.adj : '', base].filter(Boolean).join(' ');
    v = {
      species: sk, tier: T, rank,
      colorway, pattern, accessory, accColor, expression, eyes, material,
      shiny: isShiny,
      flip: roll[7] < 0.5 ? -1 : 1,  // which side asymmetric details sit on
      fine: roll[8],                  // one spare number for small offsets
      name,
      full: name + (accessory ? ' · ' + accessory.name : ''),
    };
    if (memo.size > 4000) memo.clear();
    memo.set(key, v);
    return v;
  }

  // ---- one ranking of 'rarest' for every page and the server ----
  // tier first; inside a tier a Shiny outranks the rest, then the Legendary
  // editions (Holo over Gold Chrome). Ties go to the longer run.
  function rankScore(c) {
    if (!c || !c.rarity) return -1;
    const v = variantOf(c);
    return TIER_RANK[tierOf(c)] * 10 + (v.shiny ? 5 : 0) + (v.material === 'holo' ? 2 : v.material === 'gold' ? 1 : 0);
  }
  function rarer(a, b) { return rankScore(b) - rankScore(a) || (b.durationMs || 0) - (a.durationMs || 0) || (a.bornAt || 0) - (b.bornAt || 0); }

  // ---- the Dex: every slot a collector can fill (308) ----
  // per species: the full set of 8 colorways x 5 hatch tiers (40), a Mythic,
  // a Shiny, and the two Legendary editions (Gold Chrome, Holo)
  const SET_TIERS = TIERS.slice(0, 5);
  function dexSlots() {
    const out = [];
    for (const sk of SPECIES_KEYS) {
      for (const t of SET_TIERS) for (const cw of COLORWAYS[sk]) out.push({ kind: 'set', id: 'ct:' + sk + ':' + cw.key + ':' + t, species: sk, tier: t, colorway: cw.key, name: cw.name });
      out.push({ kind: 'mythic', id: 'my:' + sk, species: sk, tier: 'Mythic' });
      out.push({ kind: 'shiny', id: 's:' + sk, species: sk });
      out.push({ kind: 'edition', id: 'm:' + sk + ':gold', species: sk, material: 'gold', name: 'Gold Chrome' });
      out.push({ kind: 'edition', id: 'm:' + sk + ':holo', species: sk, material: 'holo', name: 'Holo' });
    }
    return out;
  }
  // the slot ids one creature fills; a cross-fed hybrid fills its species' Mythic
  function slotsOf(c) {
    if (!c || !c.rarity) return [];
    const v = variantOf(c), sk = v.species, ids = [];
    if (v.tier === 'Mythic') ids.push('my:' + sk);
    else if (!c.bredBy) ids.push('ct:' + sk + ':' + v.colorway.key + ':' + v.tier);
    if (!c.bredBy && v.shiny) ids.push('s:' + sk);
    if (!c.bredBy && v.tier === 'Legendary' && !v.shiny && (v.material === 'gold' || v.material === 'holo')) ids.push('m:' + sk + ':' + v.material);
    return ids;
  }

  return {
    SPECIES_KEYS, TIERS, SET_TIERS, TIER_RANK, COLORWAYS, PATTERNS, ACCESSORIES, ACC_FOR, EXPRESSIONS, EYES, STAGES, SHINY_ODDS,
    variantOf, stageOf, rankScore, rarer, dexSlots, slotsOf, hashString, mulberry32,
  };
});
