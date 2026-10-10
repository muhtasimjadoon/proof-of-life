// Proof of Life — installer. Wires the four hooks into Claude Code's global
// settings (~/.claude/settings.json), pointing at this folder. Safe to re-run:
// it backs the file up first (only when it changes), keeps every other hook you
// have, and never adds the same hook twice. Only one Proof of Life install is
// active at a time: installing from another copy replaces the old hooks.
//
//   node install.mjs              install
//   node install.mjs --uninstall  remove only the Proof of Life hooks
//   node install.mjs --telemetry=on|off   set the usage-stats choice (no question)
//
// Usage stats (TELEMETRY.md) are off by default. Run in a terminal, it asks
// once (y/N); run without one (CI, scripts) it never asks and stays off.
// POL_SETTINGS=<path> points it at a different settings file (for testing).
// POL_DATA_DIR=<dir> is where the choice is stored (default: paths.js, data/ in a
// git clone, ~/.proof-of-life/data in an npm, npx or plugin copy).
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = process.env.POL_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
const uninstall = process.argv.includes('--uninstall');
const MARK = '--pol'; // every hook command we write ends with this marker
const KEEP_BACKUPS = 3;
const dataDir = createRequire(import.meta.url)('./paths.js').dataDir(here);
const Telemetry = createRequire(import.meta.url)('./telemetry.js');
const telArg = (process.argv.find((a) => a.startsWith('--telemetry=')) || '').split('=')[1];
if (telArg !== undefined && !/^(on|off)$/.test(telArg)) { console.error('--telemetry takes on or off'); process.exit(2); }

// ask once, only in a real terminal; anything but y/yes is no
async function telemetryChoice() {
  if (uninstall) return;
  const prev = Telemetry.readFile(dataDir);
  if (telArg) { Telemetry.setChoice(dataDir, telArg === 'on'); console.log(`Usage stats: ${telArg}.`); return; }
  if (typeof prev.enabled === 'boolean') { console.log(`Usage stats: ${prev.enabled ? 'on' : 'off'} (change with: node install.mjs --telemetry=${prev.enabled ? 'off' : 'on'})`); return; }
  if (!process.stdin.isTTY || !process.stdout.isTTY) { console.log('Usage stats: off (not asked: no terminal). Turn on with: node install.mjs --telemetry=on'); return; }
  console.log('\nShare anonymous weekly usage counts to help improve Proof of Life?');
  console.log('Once a week: a random install ID, app version, week, number of runs, active days, runs per type of work.');
  console.log('Never: names, handles, prompts, paths, file contents or commands. Details: TELEMETRY.md');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let ans = '';
  try { ans = await rl.question('Share usage counts? [y/N] '); } catch {} finally { rl.close(); }
  const yes = /^y(es)?$/i.test(ans.trim());
  Telemetry.setChoice(dataDir, yes);
  console.log(`Usage stats: ${yes ? 'on' : 'off'}. Change any time: node install.mjs --telemetry=${yes ? 'off' : 'on'}`);
}

const HOOKS = {
  UserPromptSubmit: 'run-start.mjs',
  Stop: 'run-end.mjs',
  SubagentStop: 'run-subagent.mjs',
  Notification: 'run-notify.mjs', // live status: needs your input
};

const cmdFor = (file) => `node "${path.join(here, 'hooks', file)}" ${MARK}`;
// ours: carries the marker, or (installs before the marker existed) points at a
// hooks/run-*.mjs inside any folder that holds a Proof of Life engine
const HOOK_RE = /hooks[\\/]+run-(start|end|subagent|notify)\.mjs/;
function isOurs(h) {
  if (!h || typeof h.command !== 'string' || !HOOK_RE.test(h.command)) return false;
  if (/(^|\s)--pol(\s|$)/.test(h.command)) return true;
  const m = h.command.match(/"([^"]*hooks[\\/]+run-(?:start|end|subagent|notify)\.mjs)"/) || h.command.match(/(\S*hooks[\\/]+run-(?:start|end|subagent|notify)\.mjs)/);
  if (!m) return false;
  const dir = path.dirname(path.dirname(m[1]));
  return h.command.includes('proof-of-life') || fs.existsSync(path.join(dir, 'engine.js'));
}

let settings = {};
let raw = null;
if (fs.existsSync(settingsPath)) {
  raw = fs.readFileSync(settingsPath, 'utf8');
  try { settings = JSON.parse(raw); } catch {
    console.error(`Could not parse ${settingsPath}. Fix the JSON first; nothing was changed.`);
    process.exit(1);
  }
} else {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
}

settings.hooks = settings.hooks || {};
const replaced = new Set();
for (const [event, file] of Object.entries(HOOKS)) {
  const groups = (settings.hooks[event] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => { if (isOurs(h)) { if (h.command !== cmdFor(file)) replaced.add(h.command); return false; } return true; }) }))
    .filter((g) => g.hooks.length);
  if (!uninstall) groups.push({ hooks: [{ type: 'command', command: cmdFor(file) }] });
  if (groups.length) settings.hooks[event] = groups;
  else delete settings.hooks[event];
}
if (!Object.keys(settings.hooks).length) delete settings.hooks;

const out = JSON.stringify(settings, null, 2) + '\n';
if (raw !== null && raw === out) {
  console.log(uninstall ? 'No Proof of Life hooks were installed; nothing changed.' : 'Proof of Life hooks already installed; nothing changed.');
  await telemetryChoice();
  process.exit(0);
}
if (raw !== null) {
  const backup = `${settingsPath}.pol-backup-${Date.now()}`;
  fs.writeFileSync(backup, raw);
  console.log(`Backed up settings to ${backup}`);
  // keep only the most recent few backups
  const dir = path.dirname(settingsPath), base = path.basename(settingsPath) + '.pol-backup-';
  const olds = fs.readdirSync(dir).filter((f) => f.startsWith(base)).sort().reverse().slice(KEEP_BACKUPS);
  for (const f of olds) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
}
const tmp = settingsPath + '.pol-tmp';
fs.writeFileSync(tmp, out);
fs.renameSync(tmp, settingsPath);

if (replaced.size && !uninstall) console.log(`Replaced hooks from another Proof of Life copy:\n  ${[...replaced].join('\n  ')}`);
if (uninstall) {
  console.log(`Proof of Life hooks removed. Your creatures are still in ${dataDir}`);
} else {
  console.log('Proof of Life hooks installed.');
  if (!process.env.POL_FROM_CLI) console.log('Next: run `node server.js` in this folder and open http://localhost:4855 (or run `node cli.mjs` to do both)');
  console.log('Then use Claude Code as usual. Every run longer than 10 seconds hatches a creature.');
}
await telemetryChoice();
