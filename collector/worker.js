// Proof of Life telemetry collector: a Cloudflare Worker + D1.
// Accepts the opt-in weekly heartbeat (schema: ../TELEMETRY.md), validates it
// strictly, keeps one row per install per ISO week, and stores no IP address,
// no user agent and no request headers. Nothing here logs the request.
//
//   POST /v1/heartbeat   the heartbeat (JSON, at most 2 KB)
//   GET  /v1/stats       every stored row as JSON; needs  Authorization: Bearer <STATS_TOKEN>
//   GET  /               health text
//
// Deploy: DEPLOY.md.

const SPECIES = ['cog', 'scholar', 'moth', 'prism', 'lumen', 'hydra', 'wisp'];
const AGENTS = ['claude-code'];
const KEYS = ['installId', 'appVersion', 'isoWeek', 'runsHatched', 'activeDays', 'runsBySpecies', 'agent'];
const MAX_BODY = 2048;
const DAY = 86400000;

// per-isolate burst guard by install ID (D1 below is the real limit: one row a week)
const recent = new Map();
const BURST_WINDOW_MS = 60 * 1000, BURST_MAX = 3;
function burst(id, now) {
  if (recent.size > 5000) recent.clear();
  const hits = (recent.get(id) || []).filter((t) => now - t < BURST_WINDOW_MS);
  hits.push(now);
  recent.set(id, hits);
  return hits.length > BURST_MAX;
}

// ISO week in UTC: '2026-W41'
export function isoWeek(ms) {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const jan1 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return `${t.getUTCFullYear()}-W${String(1 + Math.floor(Math.round((t - jan1) / DAY) / 7)).padStart(2, '0')}`;
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// returns [heartbeat, null] or [null, reason]
export function validate(b, now) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return [null, 'body must be a JSON object'];
  const extra = Object.keys(b).filter((k) => !KEYS.includes(k));
  if (extra.length) return [null, 'unknown field(s): ' + extra.join(', ')];
  if (typeof b.installId !== 'string' || !/^[0-9a-f]{32}$/.test(b.installId)) return [null, 'installId: 32 lowercase hex'];
  if (typeof b.appVersion !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}(-[0-9A-Za-z.]{1,20})?$/.test(b.appVersion)) return [null, 'appVersion: semver'];
  if (typeof b.isoWeek !== 'string' || !/^\d{4}-W\d{2}$/.test(b.isoWeek)) return [null, 'isoWeek: YYYY-Www'];
  // only this week, give or take one (time zones, clocks): no back-filling old weeks
  const ok = [isoWeek(now - 7 * DAY), isoWeek(now), isoWeek(now + 7 * DAY)];
  if (!ok.includes(b.isoWeek)) return [null, 'isoWeek: not the current week'];
  if (!isInt(b.runsHatched, 0, 100000)) return [null, 'runsHatched: integer 0-100000'];
  if (!isInt(b.activeDays, 0, 7)) return [null, 'activeDays: integer 0-7'];
  if (!b.runsBySpecies || typeof b.runsBySpecies !== 'object' || Array.isArray(b.runsBySpecies)) return [null, 'runsBySpecies: object'];
  let sum = 0;
  const species = {};
  for (const [k, v] of Object.entries(b.runsBySpecies)) {
    if (!SPECIES.includes(k)) return [null, 'runsBySpecies: unknown type ' + k.slice(0, 20)];
    if (!isInt(v, 0, 100000)) return [null, 'runsBySpecies: integer counts'];
    if (v) species[k] = v;
    sum += v;
  }
  if (sum !== b.runsHatched) return [null, 'runsBySpecies must add up to runsHatched'];
  if ((b.runsHatched === 0) !== (b.activeDays === 0)) return [null, 'activeDays and runsHatched disagree'];
  if (!AGENTS.includes(b.agent)) return [null, 'agent: unknown'];
  return [{ installId: b.installId, appVersion: b.appVersion, isoWeek: b.isoWeek, runsHatched: b.runsHatched, activeDays: b.activeDays, runsBySpecies: species, agent: b.agent }, null];
}

const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function heartbeat(request, env, now) {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return reply(415, { error: 'send application/json' });
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return reply(413, { error: 'too large' });
  const text = await request.text();
  if (text.length > MAX_BODY) return reply(413, { error: 'too large' });
  let body;
  try { body = JSON.parse(text); } catch { return reply(400, { error: 'invalid JSON' }); }
  const [hb, why] = validate(body, now);
  if (!hb) return reply(400, { error: why });
  if (burst(hb.installId, now)) return reply(429, { error: 'slow down' });
  // one row per install per ISO week: a repeat is accepted but not stored again
  const r = await env.DB.prepare(
    'INSERT OR IGNORE INTO heartbeats (install_id, iso_week, received_day, app_version, runs_hatched, active_days, runs_by_species, agent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)'
  ).bind(hb.installId, hb.isoWeek, new Date(now).toISOString().slice(0, 10), hb.appVersion, hb.runsHatched, hb.activeDays, JSON.stringify(hb.runsBySpecies), hb.agent).run();
  const stored = !!(r && r.meta && r.meta.changes);
  return reply(200, { ok: true, stored });
}

async function stats(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!env.STATS_TOKEN || auth !== `Bearer ${env.STATS_TOKEN}`) return reply(401, { error: 'token required' });
  const { results } = await env.DB.prepare('SELECT install_id, iso_week, received_day, app_version, runs_hatched, active_days, runs_by_species, agent FROM heartbeats ORDER BY iso_week, install_id').all();
  return reply(200, { rows: results || [] });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const now = Date.now();
    try {
      if (url.pathname === '/v1/heartbeat') return request.method === 'POST' ? await heartbeat(request, env, now) : reply(405, { error: 'POST only' });
      if (url.pathname === '/v1/stats' && request.method === 'GET') return await stats(request, env);
      if (url.pathname === '/') return new Response('proof-of-life collector: ok\n', { headers: { 'content-type': 'text/plain' } });
      return reply(404, { error: 'not found' });
    } catch {
      return reply(500, { error: 'server error' });
    }
  },
};
