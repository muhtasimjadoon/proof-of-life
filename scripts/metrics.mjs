#!/usr/bin/env node
// Proof of Life: launch metrics from the telemetry collector. Read-only.
// Prints installs (counted by install ID, not npm downloads), weekly actives,
// D7/D14 retention and the non-code share of runs.
//
//   node scripts/metrics.mjs <export.json|export.csv> [--asof YYYY-Www] [--json]
//   node scripts/metrics.mjs --url https://<worker>/v1/stats --token <STATS_TOKEN>   (or POL_STATS_TOKEN)
//
// Inputs it reads: the Worker's /v1/stats JSON ({rows:[...]}), the output of
//   npx wrangler d1 execute pol-telemetry --remote --json --command "SELECT * FROM heartbeats"
// a plain JSON array of rows, or a CSV with a header row (same column names).
//
// Definitions (weeks are ISO weeks; one heartbeat per install per week):
//   active in a week   the install sent that week's heartbeat with runsHatched > 0
//   cohort             the week of an install's first heartbeat
//   D7 retention       share of a cohort active in cohort week + 1 (week-granular D7)
//   D14 retention      share of a cohort active in cohort week + 2
//   Only cohorts whose target week has fully ended (before --asof) count.
//   non-code share     runs of every type except Cog (code), over all runs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 86400000;
export function isoWeek(ms) {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const jan1 = Date.UTC(t.getUTCFullYear(), 0, 1);
  return `${t.getUTCFullYear()}-W${String(1 + Math.floor(Math.round((t - jan1) / DAY) / 7)).padStart(2, '0')}`;
}
// week string <-> a running week number, so weeks add across years
function weekNum(w) {
  const m = /^(\d{4})-W(\d{2})$/.exec(w);
  if (!m) return NaN;
  const jan4 = Date.UTC(+m[1], 0, 4);
  const mon1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY;
  return Math.round((mon1 + (+m[2] - 1) * 7 * DAY) / (7 * DAY));
}
const weekOf = (n) => isoWeek(n * 7 * DAY + 3 * DAY);

function parseCSV(text) {
  const out = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x !== '')) out.push(row); row = []; }
    else f += ch;
  }
  if (f !== '' || row.length) { row.push(f); out.push(row); }
  const [head, ...body] = out;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i]])));
}

// any accepted shape -> [{installId, isoWeek, runsHatched, activeDays, runsBySpecies, appVersion}]
export function parseInput(text) {
  const t = text.replace(/^﻿/, '').trim();
  let raw;
  if (t.startsWith('[') || t.startsWith('{')) {
    const j = JSON.parse(t);
    if (Array.isArray(j) && j.length && j[0] && Array.isArray(j[0].results)) raw = j.flatMap((x) => x.results);
    else if (Array.isArray(j)) raw = j;
    else if (j && Array.isArray(j.rows)) raw = j.rows;
    else if (j && Array.isArray(j.results)) raw = j.results;
    else throw new Error('unrecognised JSON: expected rows, {rows}, or wrangler --json output');
  } else raw = parseCSV(t);
  return raw.map((r) => {
    let sp = r.runs_by_species ?? r.runsBySpecies ?? {};
    if (typeof sp === 'string') { try { sp = JSON.parse(sp || '{}'); } catch { sp = {}; } }
    return {
      installId: String(r.install_id ?? r.installId ?? ''),
      isoWeek: String(r.iso_week ?? r.isoWeek ?? ''),
      appVersion: String(r.app_version ?? r.appVersion ?? ''),
      runsHatched: Number(r.runs_hatched ?? r.runsHatched ?? 0) || 0,
      activeDays: Number(r.active_days ?? r.activeDays ?? 0) || 0,
      runsBySpecies: sp && typeof sp === 'object' ? sp : {},
    };
  }).filter((r) => r.installId && !Number.isNaN(weekNum(r.isoWeek)));
}

export function compute(rows, asof = isoWeek(Date.now())) {
  const asofN = weekNum(asof);
  const first = new Map(), active = new Map(); // installId -> first week n; installId -> Set(active week n)
  const weeks = new Map();
  const species = {};
  let runs = 0, cog = 0;
  for (const r of rows) {
    const n = weekNum(r.isoWeek);
    if (!first.has(r.installId) || n < first.get(r.installId)) first.set(r.installId, n);
    const w = weeks.get(n) || { heartbeats: 0, actives: 0, newInstalls: 0, runs: 0, cog: 0 };
    w.heartbeats++;
    if (r.runsHatched > 0) { w.actives++; if (!active.has(r.installId)) active.set(r.installId, new Set()); active.get(r.installId).add(n); }
    w.runs += r.runsHatched; w.cog += Number(r.runsBySpecies.cog) || 0;
    weeks.set(n, w);
    runs += r.runsHatched; cog += Number(r.runsBySpecies.cog) || 0;
    for (const [k, v] of Object.entries(r.runsBySpecies)) species[k] = (species[k] || 0) + (Number(v) || 0);
  }
  for (const n of first.values()) weeks.get(n).newInstalls++;
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  const weekly = [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([n, w]) => ({ week: weekOf(n), ...w, nonCodePct: pct(w.runs - w.cog, w.runs) }));
  const ret = (k) => {
    const cohorts = new Map();
    for (const [id, n] of first) {
      if (n + k >= asofN) continue; // target week not over yet
      const c = cohorts.get(n) || { cohort: weekOf(n), size: 0, retained: 0 };
      c.size++;
      if (active.has(id) && active.get(id).has(n + k)) c.retained++;
      cohorts.set(n, c);
    }
    const list = [...cohorts.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => ({ ...c, pct: pct(c.retained, c.size) }));
    const size = list.reduce((a, c) => a + c.size, 0), kept = list.reduce((a, c) => a + c.retained, 0);
    return { eligible: size, retained: kept, pct: pct(kept, size), cohorts: list };
  };
  return {
    asof, installs: first.size, heartbeats: rows.length,
    everActive: active.size,
    weekly, d7: ret(1), d14: ret(2),
    runs, nonCode: { runs: runs - cog, pct: pct(runs - cog, runs) },
    bySpecies: Object.entries(species).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ type: k, runs: v, pct: pct(v, runs) })),
  };
}

export function format(m) {
  const f = (v) => (v == null ? '  n/a' : `${v.toFixed(1).padStart(5)}%`);
  const L = [];
  L.push(`Proof of Life metrics (as of ${m.asof}; weeks are ISO weeks)`);
  L.push(`Installs (distinct install IDs that opted in): ${m.installs}   ever active: ${m.everActive}   heartbeats: ${m.heartbeats}`);
  L.push('');
  L.push('  week       new  active  heartbeats   runs  non-code');
  for (const w of m.weekly) L.push(`  ${w.week}  ${String(w.newInstalls).padStart(4)}  ${String(w.actives).padStart(6)}  ${String(w.heartbeats).padStart(10)}  ${String(w.runs).padStart(5)}    ${f(w.nonCodePct)}`);
  L.push('');
  L.push(`D7  retention (active in cohort week + 1): ${f(m.d7.pct)}  (${m.d7.retained} of ${m.d7.eligible})`);
  L.push(`D14 retention (active in cohort week + 2): ${f(m.d14.pct)}  (${m.d14.retained} of ${m.d14.eligible})`);
  L.push('');
  L.push(`Non-code share of runs: ${f(m.nonCode.pct)}  (${m.nonCode.runs} of ${m.runs} runs)`);
  for (const s of m.bySpecies) L.push(`  ${s.type.padEnd(8)} ${String(s.runs).padStart(6)}  ${f(s.pct)}`);
  return L.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const url = flag('--url'), token = flag('--token') || process.env.POL_STATS_TOKEN, asof = flag('--asof') || undefined;
  const asJson = args.includes('--json');
  const file = args.find((a) => !a.startsWith('--'));
  if (asof && Number.isNaN(weekNum(asof))) { console.error('--asof must be YYYY-Www'); process.exit(2); }
  let text;
  if (url) {
    const r = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (!r.ok) { console.error(`stats endpoint answered ${r.status}`); process.exit(1); }
    text = await r.text();
  } else if (file) text = fs.readFileSync(path.resolve(file), 'utf8');
  else { console.error('usage: node scripts/metrics.mjs <export.json|.csv> | --url <worker>/v1/stats --token <t>  [--asof YYYY-Www] [--json]'); process.exit(2); }
  const m = compute(parseInput(text), asof);
  console.log(asJson ? JSON.stringify(m, null, 2) : format(m));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e.message); process.exit(1); });
