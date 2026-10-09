// Proof of Life — installer. Wires the three hooks into Claude Code's global
// settings (~/.claude/settings.json), pointing at this folder. Safe to re-run:
// it backs the file up first, keeps every other hook you have, and never adds
// the same hook twice.
//
//   node install.mjs              install
//   node install.mjs --uninstall  remove only the Proof of Life hooks
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
const uninstall = process.argv.includes('--uninstall');
const MARK = 'proof-of-life';

const HOOKS = {
  UserPromptSubmit: 'run-start.mjs',
  Stop: 'run-end.mjs',
  SubagentStop: 'run-subagent.mjs',
};

const cmdFor = (file) => `node "${path.join(here, 'hooks', file)}"`;
const isOurs = (h) => typeof h.command === 'string' && h.command.includes(MARK) && /run-(start|end|subagent)\.mjs/.test(h.command);

let settings = {};
if (fs.existsSync(settingsPath)) {
  const raw = fs.readFileSync(settingsPath, 'utf8');
  try { settings = JSON.parse(raw); } catch {
    console.error(`Could not parse ${settingsPath}. Fix the JSON first; nothing was changed.`);
    process.exit(1);
  }
  const backup = `${settingsPath}.pol-backup-${Date.now()}`;
  fs.writeFileSync(backup, raw);
  console.log(`Backed up settings to ${backup}`);
} else {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
}

settings.hooks = settings.hooks || {};
for (const [event, file] of Object.entries(HOOKS)) {
  const groups = (settings.hooks[event] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
    .filter((g) => g.hooks.length);
  if (!uninstall) groups.push({ hooks: [{ type: 'command', command: cmdFor(file) }] });
  if (groups.length) settings.hooks[event] = groups;
  else delete settings.hooks[event];
}
if (!Object.keys(settings.hooks).length) delete settings.hooks;

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

if (uninstall) {
  console.log('Proof of Life hooks removed. Your creatures are still in data/.');
} else {
  console.log('Proof of Life hooks installed.');
  console.log('Next: run `node server.js` in this folder and open http://localhost:4855');
  console.log('Then use Claude Code as usual. Every run longer than 10 seconds hatches a creature.');
}
