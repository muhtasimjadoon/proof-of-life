// Offline test of worker.js with an in-memory stand-in for D1. No Cloudflare account needed.
//   node collector/test.mjs
import assert from 'node:assert/strict';
import worker, { isoWeek, validate } from './worker.js';

const rows = new Map();
const DB = {
  prepare(sql) {
    return {
      args: [],
      bind(...a) { this.args = a; return this; },
      async run() {
        assert.match(sql, /^INSERT OR IGNORE INTO heartbeats/);
        const [id, wk, day, ver, runs, days, sp, agent] = this.args;
        const k = id + '|' + wk;
        if (rows.has(k)) return { meta: { changes: 0 } };
        rows.set(k, { install_id: id, iso_week: wk, received_day: day, app_version: ver, runs_hatched: runs, active_days: days, runs_by_species: sp, agent });
        return { meta: { changes: 1 } };
      },
      async all() { return { results: [...rows.values()] }; },
    };
  },
};
const env = { DB, STATS_TOKEN: 'secret' };
const now = Date.now();
const hb = { installId: 'a'.repeat(32), appVersion: '1.0.0', isoWeek: isoWeek(now), runsHatched: 5, activeDays: 2, runsBySpecies: { cog: 3, moth: 2 }, agent: 'claude-code' };
const post = (body, headers = { 'content-type': 'application/json' }) => worker.fetch(new Request('https://x/v1/heartbeat', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);

let r = await post(hb); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, stored: true });
r = await post(hb); assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, stored: false }); // one row a week
r = await post(hb); r = await post(hb); assert.equal(r.status, 429); // burst guard
assert.equal(rows.size, 1);
const bad = [
  [{ ...hb, handle: 'x' }, /unknown field/],
  [{ ...hb, installId: 'XYZ' }, /installId/],
  [{ ...hb, isoWeek: '2020-W01' }, /current week/],
  [{ ...hb, runsBySpecies: { cog: 3, moth: 1 } }, /add up/],
  [{ ...hb, runsBySpecies: { cog: 3, '../etc': 2 } }, /unknown type/],
  [{ ...hb, activeDays: 9 }, /activeDays/],
  [{ ...hb, agent: 'cursor' }, /agent/],
  [{ ...hb, runsHatched: 0, runsBySpecies: {}, activeDays: 1 }, /disagree/],
];
for (const [b, re] of bad) { const [ok, why] = validate(b, now); assert.equal(ok, null); assert.match(why, re); }
assert.equal((await post('not json')).status, 400);
assert.equal((await post(hb, { 'content-type': 'text/plain' })).status, 415);
assert.equal((await post({ ...hb, pad: 'x'.repeat(3000) })).status, 413);
assert.equal((await worker.fetch(new Request('https://x/v1/stats'), env)).status, 401);
r = await worker.fetch(new Request('https://x/v1/stats', { headers: { authorization: 'Bearer secret' } }), env);
assert.equal(r.status, 200);
const s = await r.json(); assert.equal(s.rows.length, 1); assert.ok(!('ip' in s.rows[0]));
assert.equal(isoWeek(Date.UTC(2021, 0, 3)), '2020-W53'); assert.equal(isoWeek(Date.UTC(2024, 11, 30)), '2025-W01');
console.log('collector: all checks passed');
