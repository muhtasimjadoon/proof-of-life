#!/usr/bin/env node
// Proof of Life: one command to install, start and open it.
//
//   npx proof-of-life              install the hooks, start the server, open the page
//   npx proof-of-life uninstall    remove the hooks and stop the server it started
//   npx proof-of-life start|stop   start or stop the server only
//   npx proof-of-life telemetry on|off|status   usage stats answer only (hooks untouched)
//   node cli.mjs ...               the same from a git clone
//
// Flags: --no-open (never open a browser), --no-start (hooks only),
// --telemetry=on|off (passed to install.mjs).
//
// `ensure` is what the Claude Code plugin runs at session start: it starts the
// server if it is not running, says nothing and always exits 0.
//
// Where things go (paths.js): a git clone keeps its data in ./data. An npx run
// copies the app to ~/.proof-of-life/app first, because the npx cache is not a
// stable place for hooks to point at; data goes to ~/.proof-of-life/data.
// It only ever stops a server it started itself (its pid is in server.pid).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Paths = require('./paths.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8')).version;
const PORT = Number(process.env.POL_PORT) || 4855;
const URL_ = `http://localhost:${PORT}`;
const argv = process.argv.slice(2);
const cmd = (argv.find((a) => !a.startsWith('-')) || 'install').toLowerCase();
const flag = (f) => argv.includes(f);
const quiet = cmd === 'ensure';
const log = (...a) => { if (!quiet) console.log(...a); };
const noOpen = flag('--no-open') || !!process.env.CI || !!process.env.POL_NO_OPEN;

// ---- server ---------------------------------------------------------------
function getVersion(ms = 1000) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/api/version', headers: { Host: `127.0.0.1:${PORT}` } }, (res) => {
      let b = ''; res.on('data', (d) => (b += d));
      res.on('end', () => { try { const v = JSON.parse(b); resolve(v && typeof v === 'object' && 'build' in v ? v : null); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(ms, () => { req.destroy(); resolve(null); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pidFile = (dataDir) => path.join(dataDir, 'server.pid');
function readPid(dataDir) { try { return JSON.parse(fs.readFileSync(pidFile(dataDir), 'utf8')); } catch { return null; } }

async function startServer(root) {
  const dataDir = Paths.dataDir(root);
  fs.mkdirSync(dataDir, { recursive: true });
  const out = fs.openSync(path.join(dataDir, 'server.log'), 'a');
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: dataDir, detached: true, windowsHide: true, stdio: ['ignore', out, out],
    env: { ...process.env, POL_DATA_DIR: dataDir, POL_PORT: String(PORT) },
  });
  child.unref();
  fs.closeSync(out);
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    const v = await getVersion(500);
    if (v && v.pid === child.pid) {
      fs.writeFileSync(pidFile(dataDir), JSON.stringify({ pid: child.pid, port: PORT, root, version: VERSION }) + '\n');
      return true;
    }
    if (child.exitCode !== null) break;
  }
  log(`Could not start the server on port ${PORT}. See ${path.join(dataDir, 'server.log')}`);
  return false;
}

// stop only the server this tool started: the pid on that port must match server.pid
async function stopServer(root) {
  const dataDir = Paths.dataDir(root);
  const pf = readPid(dataDir);
  const v = await getVersion();
  if (!pf || !v || v.pid !== pf.pid || pf.port !== PORT) {
    try { if (pf && (!v || v.pid !== pf.pid)) fs.unlinkSync(pidFile(dataDir)); } catch {}
    return v ? 'not-ours' : 'not-running';
  }
  try { process.kill(pf.pid); } catch {}
  for (let i = 0; i < 40 && (await getVersion(300)); i++) await sleep(150);
  try { fs.unlinkSync(pidFile(dataDir)); } catch {}
  return 'stopped';
}

// start, or restart our own server when it runs another copy or version
async function ensureServer(root) {
  const v = await getVersion();
  if (!v) return (await startServer(root)) ? 'started' : 'failed';
  const pf = readPid(Paths.dataDir(root));
  const ours = pf && pf.pid === v.pid;
  if (ours && (pf.root !== root || pf.version !== VERSION || v.stale)) {
    await stopServer(root);
    return (await startServer(root)) ? 'restarted' : 'failed';
  }
  if (!ours && v.stale) log(`A Proof of Life server is already running on port ${PORT} with older code. Restart it to load this version.`);
  return 'running';
}

function openBrowser(url) {
  if (noOpen) return;
  const o = { detached: true, stdio: 'ignore', windowsHide: true };
  try {
    const c = process.platform === 'win32' ? spawn('cmd', ['/c', 'start', '""', url], { ...o, windowsVerbatimArguments: true })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], o);
    c.on('error', () => {}); c.unref();
  } catch {}
}

// ---- install --------------------------------------------------------------
// the npx cache can be cleared or replaced, so hooks must not point into it
function stableRoot() {
  if (!/[\\/]_npx[\\/]/.test(HERE + path.sep)) return HERE;
  const dest = path.join(Paths.homeDir(), 'app');
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(HERE)) {
    if (name === 'data' || name === 'node_modules') continue;
    fs.cpSync(path.join(HERE, name), path.join(dest, name), { recursive: true, force: true });
  }
  log(`Copied Proof of Life ${VERSION} to ${dest}`);
  return dest;
}

function runInstaller(root, extra) {
  const pass = argv.filter((a) => a.startsWith('--telemetry='));
  const r = spawnSync(process.execPath, [path.join(root, 'install.mjs'), ...extra, ...pass], { stdio: 'inherit', env: { ...process.env, POL_FROM_CLI: '1' } });
  return r.status === 0;
}

async function main() {
  if (cmd === 'help' || flag('--help') || flag('-h')) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  if (cmd === 'ensure') {
    const root = process.env.CLAUDE_PLUGIN_ROOT ? path.resolve(process.env.CLAUDE_PLUGIN_ROOT) : HERE;
    const r = await ensureServer(root);
    const mark = path.join(Paths.dataDir(root), '.welcomed');
    if ((r === 'started' || r === 'running') && !fs.existsSync(mark)) {
      try { fs.writeFileSync(mark, new Date().toISOString() + '\n'); } catch {}
      openBrowser(URL_);
    }
    return 0;
  }
  if (cmd === 'telemetry') {
    // the usage-stats answer only: never touches the hooks or settings.json, so it
    // is safe for plugin users (their hooks come from the plugin) and npx users alike
    const Telemetry = require('./telemetry.js');
    const dataDir = Paths.dataDir(HERE);
    const want = (argv.filter((a) => !a.startsWith('-'))[1] || 'status').toLowerCase();
    if (want === 'on' || want === 'off') Telemetry.setChoice(dataDir, want === 'on', 'command');
    else if (want !== 'status') { console.error('Usage: npx proof-of-life telemetry on|off|status'); return 2; }
    const t = Telemetry.status(dataDir);
    console.log(`Usage stats: ${t.enabled ? 'on' : 'off'} (${t.reason}). Stored in ${path.join(dataDir, 'telemetry.json')}`);
    console.log(`Change it: ${t.change}. What is and is never sent: TELEMETRY.md`);
    return 0;
  }
  if (cmd === 'stop') {
    const r = await stopServer(HERE);
    console.log(r === 'stopped' ? 'Server stopped.' : r === 'not-ours' ? `The server on port ${PORT} was not started by this tool; stop it where it runs.` : 'No server running.');
    return 0;
  }
  if (cmd === 'start') {
    const r = await ensureServer(HERE);
    if (r === 'failed') return 1;
    console.log(`Proof of Life ${r} at ${URL_}`);
    openBrowser(URL_);
    return 0;
  }
  if (cmd === 'uninstall') {
    const ok = runInstaller(HERE, ['--uninstall']);
    const root = /[\\/]_npx[\\/]/.test(HERE + path.sep) ? path.join(Paths.homeDir(), 'app') : HERE;
    const r = await stopServer(root);
    if (r === 'stopped') console.log('Server stopped.');
    else if (r === 'not-ours') console.log(`A server is still running on port ${PORT}; it was not started by this tool.`);
    return ok ? 0 : 1;
  }
  if (cmd !== 'install') { console.error(`Unknown command: ${cmd}. Try: npx proof-of-life help`); return 2; }

  const root = stableRoot();
  if (!runInstaller(root, [])) return 1;
  if (flag('--no-start')) { console.log(`Start the server any time: node "${path.join(root, 'cli.mjs')}" start`); return 0; }
  const r = await ensureServer(root);
  if (r === 'failed') return 1;
  console.log(`\nProof of Life is ${r === 'running' ? 'already running' : r} at ${URL_}`);
  console.log(`Data: ${Paths.dataDir(root)}`);
  console.log('Use Claude Code as usual. Every run longer than 10 seconds hatches a creature.');
  console.log(`After a reboot, start it again with: ${Paths.isManaged(root) ? 'npx proof-of-life start' : 'node cli.mjs start'}`);
  openBrowser(URL_);
  return 0;
}

main().then((code) => process.exit(code), (e) => { if (!quiet) console.error(e && e.message || e); process.exit(quiet ? 0 : 1); });
