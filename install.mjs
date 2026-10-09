// Proof of Life — installer. Wires the three hooks into Claude Code's global
// settings (~/.claude/settings.json), pointing at this folder. Safe to re-run:
// it backs the file up first (only when it changes), keeps every other hook you
// have, and never adds the same hook twice. Only one Proof of Life install is
// active at a time: installing from another copy replaces the old hooks.
//
//   node install.mjs              install
//   node install.mjs --uninstall  remove only the Proof of Life hooks
//
// POL_SETTINGS=<path> points it at a different settings file (for testing).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = process.env.POL_SETTINGS || path.join(os.homedir(), '.claude', 'settings.json');
const uninstall = process.argv.includes('--uninstall');
const MARK = '--pol'; // every hook command we write ends with this marker
const KEEP_BACKUPS = 3;

const HOOKS = {
  UserPromptSubmit: 'run-start.mjs',
  Stop: 'run-end.mjs',
  SubagentStop: 'run-subagent.mjs',
};

const cmdFor = (file) => `node "${path.join(here, 'hooks', file)}" ${MARK}`;
// ours: carries the marker, or (installs before the marker existed) points at a
// hooks/run-*.mjs inside any folder that holds a Proof of Life engine
const HOOK_RE = /hooks[\\/]+run-(start|end|subagent)\.mjs/;
function isOurs(h) {
  if (!h || typeof h.command !== 'string' || !HOOK_RE.test(h.command)) return false;
  if (/(^|\s)--pol(\s|$)/.test(h.command)) return true;
  const m = h.command.match(/"([^"]*hooks[\\/]+run-(?:start|end|subagent)\.mjs)"/) || h.command.match(/(\S*hooks[\\/]+run-(?:start|end|subagent)\.mjs)/);
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
  console.log('Proof of Life hooks removed. Your creatures are still in data/.');
} else {
  console.log('Proof of Life hooks installed.');
  console.log('Next: run `node server.js` in this folder and open http://localhost:4855');
  console.log('Then use Claude Code as usual. Every run longer than 10 seconds hatches a creature.');
}
