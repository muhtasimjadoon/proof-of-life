// node scripts/metrics.test.mjs  (fixtures: 5 installs over ISO weeks 42-44 of 2026)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseInput, compute, format, isoWeek } from './metrics.mjs';

const fx = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fromJson = compute(parseInput(fs.readFileSync(path.join(fx, 'telemetry-d1.json'), 'utf8')), '2026-W45');
const fromCsv = compute(parseInput(fs.readFileSync(path.join(fx, 'telemetry.csv'), 'utf8')), '2026-W45');
assert.deepEqual(fromCsv, fromJson, 'CSV and D1 JSON give the same metrics');
// the stats-endpoint shape too
const rows = JSON.parse(fs.readFileSync(path.join(fx, 'telemetry-d1.json'), 'utf8'))[0].results;
assert.deepEqual(compute(parseInput(JSON.stringify({ rows })), '2026-W45'), fromJson);

const m = fromJson;
assert.equal(m.installs, 5);
assert.equal(m.heartbeats, 10);
assert.equal(m.everActive, 5);
assert.deepEqual(m.weekly.map((w) => [w.week, w.newInstalls, w.actives, w.heartbeats, w.runs, w.nonCodePct]), [
  ['2026-W42', 3, 2, 3, 13, 46.2],
  ['2026-W43', 1, 3, 3, 19, 57.9],
  ['2026-W44', 1, 4, 4, 9, 77.8],
]);
assert.deepEqual([m.d7.retained, m.d7.eligible, m.d7.pct], [3, 4, 75]); // W44 cohort not eligible yet
assert.deepEqual([m.d14.retained, m.d14.eligible, m.d14.pct], [2, 3, 66.7]);
assert.deepEqual([m.nonCode.runs, m.runs, m.nonCode.pct], [24, 41, 58.5]);
// weeks roll across a year boundary
const y = compute(parseInput(JSON.stringify([{ install_id: 'f'.repeat(32), iso_week: '2026-W53', runs_hatched: 1, runs_by_species: '{"cog":1}' }, { install_id: 'f'.repeat(32), iso_week: '2027-W01', runs_hatched: 1, runs_by_species: '{"moth":1}' }])), '2027-W03');
assert.deepEqual([y.d7.retained, y.d7.eligible], [1, 1]);
assert.equal(isoWeek(Date.UTC(2027, 0, 1)), '2026-W53');
assert.match(format(m), /D7 {2}retention/);
console.log('metrics: all checks passed');
