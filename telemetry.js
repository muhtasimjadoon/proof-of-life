// Proof of Life: opt-in, counts-only usage heartbeat. OFF unless you said yes.
// Zero dependencies. Sent by the server process only (never by the hooks), at
// most once per ISO week. What it sends and never sends: TELEMETRY.md.
//
//   data/telemetry.json  { enabled, installId, decidedAt, via, lastSentWeek, lastSentAt }
//   written by the installer (asks once in a terminal), by the yes/no on the page
//   (POST /api/telemetry, this machine only), or by the hooks-free command
//   `npx proof-of-life telemetry on|off` (`node cli.mjs telemetry on|off` in a clone)
//   POL_TELEMETRY=off        always off, whatever the file says
//   POL_TELEMETRY_URL=<url>  where to send (else TELEMETRY_URL below; empty = never send)

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

// Paste the deployed collector URL here (collector/DEPLOY.md). Empty: nothing is ever sent.
const TELEMETRY_URL = '';
const SPECIES_KEYS = ['cog', 'scholar', 'moth', 'prism', 'lumen', 'hydra', 'wisp'];
const DAY = 86400000;
const FIRST_GRACE_MS = DAY; // with no run yet, the very first heartbeat waits a day after you opted in
const CHECK_EVERY_MS = 60 * 60 * 1000;
const FIRST_CHECK_MS = Number(process.env.POL_TELEMETRY_FIRST_CHECK_MS) || 10 * 1000;
const TIMEOUT_MS = 8000;

let appVersion = '0.0.0';
try { appVersion = String(JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).version || '0.0.0'); } catch {}

function newInstallId() { return crypto.randomBytes(16).toString('hex'); }

// ISO 8601 week of a moment, in local time: '2026-W41'
function isoWeek(ms) {
  const d = new Date(ms);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (t.getDay() + 6) % 7; // Mon=0
  t.setDate(t.getDate() - dow + 3); // the Thursday of this week decides its year
  const jan1 = new Date(t.getFullYear(), 0, 1);
  const wk = 1 + Math.floor(Math.round((t - jan1) / DAY) / 7);
  return `${t.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}
function weekStartMs(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function localDay(ms) { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

function fileOf(dataDir) { return path.join(dataDir, 'telemetry.json'); }
function readFile(dataDir) {
  try { const v = JSON.parse(fs.readFileSync(fileOf(dataDir), 'utf8')); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function writeFile(dataDir, obj) {
  const f = fileOf(dataDir), tmp = f + '.tmp';
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, f);
}
// record a yes/no. via: 'install' | 'command' | 'page'. Keeps the install ID; a yes creates one if missing.
function setChoice(dataDir, enabled, via) {
  const cur = readFile(dataDir);
  const next = Object.assign({}, cur, { enabled: !!enabled, decidedAt: Date.now(), via: ['install', 'command', 'page'].includes(via) ? via : 'install' });
  if (enabled && !/^[0-9a-f]{32}$/.test(cur.installId || '')) next.installId = newInstallId();
  writeFile(dataDir, next);
  return next;
}

function endpoint() { return String(process.env.POL_TELEMETRY_URL != null ? process.env.POL_TELEMETRY_URL : TELEMETRY_URL).trim(); }
function envOff() { return /^(off|0|false|no)$/i.test(String(process.env.POL_TELEMETRY || '').trim()); }

// how this copy was installed, so the page names a command that exists for you:
// 'plugin' (Claude Code plugin), 'npx' (npm or npx copy) or 'clone' (a git clone)
function installKind(root = __dirname) {
  const p = path.resolve(root) + path.sep, plug = process.env.CLAUDE_PLUGIN_ROOT;
  if ((plug && p.startsWith(path.resolve(plug) + path.sep)) || /[\\/]\.claude[\\/]plugins[\\/]/.test(p)) return 'plugin';
  return require('./paths.js').isManaged(root) ? 'npx' : 'clone';
}
// the command that changes the answer and leaves the hooks alone
function changeCommand(on, kind = installKind()) {
  return (kind === 'clone' ? 'node cli.mjs telemetry ' : 'npx proof-of-life telemetry ') + (on ? 'on' : 'off');
}

// what the page shows: on/off, why, and how to change it
function status(dataDir, kind = installKind()) {
  const f = readFile(dataDir);
  const on = f.enabled === true && !envOff();
  const where = f.via === 'page' ? 'on this page' : f.via === 'command' ? 'with a command' : 'at install';
  return {
    enabled: on,
    decided: typeof f.enabled === 'boolean',
    reason: envOff() ? 'POL_TELEMETRY=off' : f.enabled === true ? `you said yes ${where}` : f.enabled === false ? `you said no ${where}` : 'never asked, so off by default',
    envOff: envOff(),
    endpointSet: !!endpoint(),
    lastSentWeek: f.lastSentWeek || null,
    install: kind,
    change: envOff() ? 'unset POL_TELEMETRY, then ' + changeCommand(true, kind) : changeCommand(!on, kind),
    doc: 'TELEMETRY.md',
  };
}

// The heartbeat: counts only, for one operator's own hatched runs (bred creatures
// left out), over the 7 days before it is sent. No handle, name, path, prompt.
function buildHeartbeat(installId, creatures, now) {
  const from = now - 7 * DAY;
  const runsBySpecies = {};
  const days = new Set();
  let runs = 0;
  for (const c of creatures || []) {
    if (!c || c.bredBy || !(c.bornAt >= from && c.bornAt <= now)) continue;
    const k = SPECIES_KEYS.includes(c.domainKey) ? c.domainKey : 'wisp';
    runsBySpecies[k] = (runsBySpecies[k] || 0) + 1;
    days.add(localDay(c.bornAt));
    runs++;
  }
  return { installId, appVersion, isoWeek: isoWeek(now), runsHatched: runs, activeDays: days.size, runsBySpecies, agent: 'claude-code' };
}

function post(url, body) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch { return resolve({ ok: false, error: 'bad url' }); }
    const lib = u.protocol === 'https:' ? https : u.protocol === 'http:' ? http : null;
    if (!lib) return resolve({ ok: false, error: 'unsupported protocol' });
    const data = Buffer.from(JSON.stringify(body));
    const req = lib.request(u, { method: 'POST', timeout: TIMEOUT_MS, headers: { 'content-type': 'application/json', 'content-length': data.length, 'user-agent': `proof-of-life/${appVersion}` } }, (res) => {
      res.resume();
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.end(data);
  });
}

// start(dataDir, getCreatures): checks shortly after start, hourly, and soon after
// each hatch (nudge). Sends for this ISO week once, when you ran something this
// week, or (first heartbeat ever) a day after you opted in even with no run yet.
function start(dataDir, getCreatures, log = console) {
  let busy = false, nudgeTimer = null;
  async function check() {
    if (busy) return;
    const url = endpoint();
    const f = readFile(dataDir);
    if (envOff() || f.enabled !== true || !url || !/^[0-9a-f]{32}$/.test(f.installId || '')) return;
    const now = Date.now(), wk = isoWeek(now);
    if (f.lastSentWeek === wk) return;
    const creatures = getCreatures() || [];
    const ranThisWeek = creatures.some((c) => c && !c.bredBy && c.bornAt >= weekStartMs(now));
    const firstEver = !f.lastSentWeek && now - (Number(f.decidedAt) || 0) >= FIRST_GRACE_MS;
    if (!ranThisWeek && !firstEver) return;
    busy = true;
    try {
      const r = await post(url, buildHeartbeat(f.installId, creatures, now));
      if (r.ok) {
        const cur = readFile(dataDir); // the installer may have changed it meanwhile
        writeFile(dataDir, Object.assign(cur, { lastSentWeek: wk, lastSentAt: now }));
      } else log.error(`[pol] telemetry heartbeat not accepted (${r.status || r.error}); will retry within the hour`);
    } catch (e) { log.error('[pol] telemetry error:', e.message); }
    finally { busy = false; }
  }
  setTimeout(check, FIRST_CHECK_MS).unref();
  setInterval(check, CHECK_EVERY_MS).unref();
  return {
    check,
    nudge() { if (nudgeTimer) return; nudgeTimer = setTimeout(() => { nudgeTimer = null; check(); }, 5000); nudgeTimer.unref(); },
  };
}

module.exports = { TELEMETRY_URL, SPECIES_KEYS, isoWeek, buildHeartbeat, status, setChoice, installKind, changeCommand, readFile, start, newInstallId, appVersion };
