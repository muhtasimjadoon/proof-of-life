#!/usr/bin/env node
// Proof of Life: own-data stats. Read-only.
// Prints the share of your creatures by work type (species), counting only
// creatures whose type was read from what the agent actually did
// (domainSource 'activity'), hatched on or after 2026-10-09 (local time).
// Gives the honest "X% of my agent work is not code" line.
//
//   node scripts/stats.mjs [path/to/state.json] [--since YYYY-MM-DD] [--json]
//
// Default path: data/state.json next to this repo. The file is only read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const since = flag('--since') || '2026-10-09';
const asJson = args.includes('--json');
const file = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(here, '..', 'data', 'state.json'));
if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error('--since must be YYYY-MM-DD'); process.exit(2); }

let state;
try { state = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error(`cannot read ${file}: ${e.message}`); process.exit(1); }

const [y, m, d] = since.split('-').map(Number);
const fromMs = new Date(y, m - 1, d).getTime(); // local midnight
const LABEL = { cog: 'Code (Cog)', scholar: 'Research (Scholar)', moth: 'Writing (Moth)', prism: 'Design (Prism)', lumen: 'Video (Lumen)', hydra: 'Outreach (Hydra)', wisp: 'General / browser (Wisp)' };

const ops = Object.values(state.operators || {}).filter((o) => !o.sample);
let total = 0, skippedSource = 0, skippedOld = 0;
const count = {};
for (const op of ops) {
  for (const c of op.creatures || []) {
    if (c.bredBy) continue;
    if (!(c.bornAt >= fromMs)) { skippedOld++; continue; }
    if (c.domainSource !== 'activity') { skippedSource++; continue; }
    count[c.domainKey] = (count[c.domainKey] || 0) + 1;
    total++;
  }
}
const pct = (n) => (total ? Math.round((1000 * n) / total) / 10 : 0);
const rows = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ type: k, label: LABEL[k] || k, creatures: n, pct: pct(n) }));
const notCode = total - (count.cog || 0);
const out = {
  file, since, operators: ops.map((o) => o.handle), creatures: total,
  excluded: { beforeSince: skippedOld, typeNotFromActivity: skippedSource },
  byType: rows, notCode: { creatures: notCode, pct: pct(notCode) },
};
if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }

console.log(`Proof of Life stats · ${file}`);
console.log(`Creatures hatched since ${since} whose type came from what the agent did: ${total}`);
console.log(`(left out: ${skippedOld} before ${since}, ${skippedSource} typed from the prompt only)`);
console.log('');
const w = Math.max(...rows.map((r) => r.label.length), 10);
for (const r of rows) console.log(`  ${r.label.padEnd(w)}  ${String(r.creatures).padStart(5)}  ${r.pct.toFixed(1).padStart(5)}%`);
console.log('');
console.log(total ? `${pct(notCode).toFixed(1)}% of my agent work is not code (${notCode} of ${total} runs, by run count, since ${since}).` : 'No activity-typed creatures in range yet.');
