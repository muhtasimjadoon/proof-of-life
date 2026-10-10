#!/usr/bin/env node
// Install smoke test (CI runs this on Windows, macOS and Linux). Never touches
// your real ~/.claude/settings.json, ~/.proof-of-life or ./data: every path is a
// temp folder, every server runs on its own port.
//
//   node scripts/smoke.mjs [--keep] [--only=clone|npx|plugin] [--port=4871]
//
// Three ways in, run side by side:
//   clone   node cli.mjs from this folder
//   npx     npm pack, then npm exec the tarball (an npm-installed copy; the app
//           is copied to POL_HOME/app and the hooks must point there)
//   plugin  the plugin's hooks/hooks.json commands with CLAUDE_PLUGIN_ROOT set,
//           server started by `cli.mjs ensure` like the SessionStart hook does
// Each one: install hooks into a temp settings file (an unrelated hook in it
// must survive), start the server, pipe fake hook JSON into the three hooks,
// check a creature hatched and its signature checks out, then uninstall.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const basePort = Number((args.find((a) => a.startsWith('--port=')) || '').split('=')[1]) || 4871;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pol-smoke-'));
const MIN_HATCH_MS = 10 * 1000;
const PRIVATE = 'SECRET-PROMPT-TEXT fix the failing build';

function run(cmd, cmdArgs, { env, input, shell = false, cwd = ROOT } = {}) {
  return new Promise((resolve) => {
    // with a shell, hand it one command line (the hook commands are command lines already)
    const c = shell ? spawn([cmd, ...cmdArgs].join(' '), { cwd, env: { ...process.env, ...env }, shell: true, windowsHide: true })
      : spawn(cmd, cmdArgs, { cwd, env: { ...process.env, ...env }, windowsHide: true });
    let out = '';
    c.stdout.on('data', (d) => (out += d));
    c.stderr.on('data', (d) => (out += d));
    c.on('close', (code) => resolve({ code, out }));
    c.on('error', (e) => resolve({ code: -1, out: String(e) }));
    if (input !== undefined) c.stdin.end(input); else c.stdin.end();
  });
}
const node = (file, a, o) => run(process.execPath, [file, ...a], o);
function get(port, p) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, headers: { Host: `127.0.0.1:${port}` } }, (res) => {
      let b = ''; res.on('data', (d) => (b += d)); res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(3000, () => { req.destroy(); resolve(null); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a transcript with a prompt, three tool calls (one git commit) and their results
function transcript(file) {
  const lines = [
    { type: 'user', message: { role: 'user', content: PRIVATE } },
    { type: 'assistant', message: { content: [
      { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/secret/dir/app.js' } },
      { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: '/secret/dir/app.js', old_string: 'a', new_string: 'b' } },
      { type: 'tool_use', id: 't3', name: 'Bash', input: { command: 'git commit -m "secret message"' } },
    ] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }, { type: 'tool_result', tool_use_id: 't2', content: 'ok' }, { type: 'tool_result', tool_use_id: 't3', content: 'ok' }] } },
  ];
  fs.writeFileSync(file, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return file;
}

const isPol = (h) => /run-(start|end|subagent)\.mjs/.test(h.command || '');
function polCommands(settingsFile) {
  const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const pick = (ev) => ((s.hooks || {})[ev] || []).flatMap((g) => g.hooks || []).filter(isPol).map((h) => h.command);
  return { start: pick('UserPromptSubmit'), end: pick('Stop'), sub: pick('SubagentStop'), all: s };
}

async function scenario(mode, port) {
  const dir = path.join(TMP, mode);
  fs.mkdirSync(dir, { recursive: true });
  const settings = path.join(dir, 'settings.json');
  const other = { type: 'command', command: 'echo unrelated-hook' };
  fs.writeFileSync(settings, JSON.stringify({ theme: 'dark', hooks: { Stop: [{ hooks: [other] }] } }, null, 2));
  const home = path.join(dir, 'home');
  const env = { POL_SETTINGS: settings, POL_HOME: home, POL_PORT: String(port), POL_NO_OPEN: '1', POL_TELEMETRY: 'off', npm_config_cache: path.join(dir, 'npm-cache'), npm_config_update_notifier: 'false' };
  // the clone keeps ./data by design, so point it at a temp folder; npx and plugin must pick POL_HOME/data on their own
  if (mode === 'clone') env.POL_DATA_DIR = path.join(dir, 'data');
  const dataDir = env.POL_DATA_DIR || path.join(home, 'data');
  const say = (m) => console.log(`[${mode}] ${m}`);
  let cmds, uninstall;

  if (mode === 'plugin') {
    const hj = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8')).hooks;
    const sub = (c) => c.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, ROOT.replace(/\\/g, '/'));
    const pick = (ev) => (hj[ev] || []).flatMap((g) => g.hooks).map((h) => sub(h.command));
    for (const c of Object.values(hj).flat().flatMap((g) => g.hooks)) {
      assert.match(c.command, /"\$\{CLAUDE_PLUGIN_ROOT\}\//, 'plugin hooks use the plugin root, quoted');
      const f = c.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}([^"]+)"/)[1];
      assert.ok(fs.existsSync(path.join(ROOT, f)), `plugin hook file exists: ${f}`);
    }
    const pj = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    assert.equal(pj.version, pkg.version, 'plugin.json version matches package.json');
    env.CLAUDE_PLUGIN_ROOT = ROOT;
    const r = await run(pick('SessionStart')[0], [], { env, shell: true, input: JSON.stringify({ session_id: 'x', hook_event_name: 'SessionStart', source: 'startup' }) });
    assert.equal(r.code, 0, 'SessionStart hook exits 0');
    assert.equal(r.out.trim(), '', 'SessionStart hook prints nothing (it would land in the context)');
    cmds = { start: pick('UserPromptSubmit'), end: pick('Stop'), sub: pick('SubagentStop') };
    uninstall = async () => { const s = await node(path.join(ROOT, 'cli.mjs'), ['stop'], { env }); assert.equal(s.code, 0, s.out); };
  } else {
    let cli;
    if (mode === 'clone') cli = (a) => node(path.join(ROOT, 'cli.mjs'), a, { env });
    else {
      const p = await run('npm', ['pack', '--silent', '--pack-destination', dir], { env, shell: true });
      assert.equal(p.code, 0, p.out);
      const tgz = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.tgz')));
      cli = (a) => run('npm', ['exec', '--yes', `--package="${tgz}"`, '--', 'proof-of-life', ...a], { env, shell: true, cwd: dir });
    }
    const r = await cli(['--no-open']);
    assert.equal(r.code, 0, `install exits 0:\n${r.out}`);
    say('installed');
    const c = polCommands(settings);
    assert.equal(c.all.theme, 'dark', 'other settings kept');
    assert.ok(c.all.hooks.Stop.some((g) => g.hooks.some((h) => h.command === other.command)), 'unrelated hook kept');
    for (const k of ['start', 'end', 'sub']) assert.equal(c[k].length, 1, `one ${k} hook installed`);
    if (mode === 'npx') {
      const app = path.join(home, 'app');
      assert.ok(c.start[0].includes(app), `npx hooks point at the stable copy ${app}, not the npx cache: ${c.start[0]}`);
      assert.ok(!/_npx/.test(c.start[0]), 'hooks never point into the npx cache');
    } else assert.ok(c.start[0].includes(ROOT), 'clone hooks point at this folder');
    // re-running is a no-op
    const again = await cli(['--no-open']);
    assert.equal(again.code, 0, again.out);
    assert.equal(polCommands(settings).start.length, 1, 'no duplicate hooks after a second install');
    cmds = c;
    uninstall = async () => {
      const u = await cli(['uninstall']);
      assert.equal(u.code, 0, u.out);
      const after = polCommands(settings);
      assert.equal(after.start.length + after.end.length + after.sub.length, 0, 'uninstall removes every Proof of Life hook');
      assert.ok(after.all.hooks.Stop.some((g) => g.hooks.some((h) => h.command === other.command)), 'unrelated hook survives uninstall');
    };
  }

  const v = await get(port, '/api/version');
  assert.ok(v && v.build, `server answers on ${port}`);
  say(`server up, build ${v.build}`);

  const sid = `smoke-${mode}-${Date.now()}`;
  const hookEnv = { ...env, POL_SERVER: `http://127.0.0.1:${port}` };
  const t = transcript(path.join(dir, 'transcript.jsonl'));
  const ts = transcript(path.join(dir, 'agent.jsonl'));
  const fire = async (c, payload) => { const r = await run(c, [], { env: hookEnv, shell: true, input: JSON.stringify(payload) }); assert.equal(r.code, 0, `hook exits 0: ${c}\n${r.out}`); };
  await fire(cmds.start[0], { session_id: sid, prompt: PRIVATE, hook_event_name: 'UserPromptSubmit' });
  await fire(cmds.sub[0], { session_id: sid, agent_transcript_path: ts, hook_event_name: 'SubagentStop' });
  const st = await get(port, '/api/state');
  assert.ok(st && st.eggs.some((e) => e.id === sid), 'an egg was laid');
  say('egg laid, waiting for the 10 s hatch minimum');
  await sleep(MIN_HATCH_MS + 1000);
  await fire(cmds.end[0], { session_id: sid, transcript_path: t, hook_event_name: 'Stop' });

  const state = await get(port, '/api/state');
  const cr = state && state.creatures.find((x) => x.id === sid || String(x.id).startsWith(sid));
  assert.ok(cr, 'a creature hatched');
  assert.ok(cr.toolCalls >= 3 || (cr.activity && cr.activity.toolCalls >= 3), 'activity counts arrived');
  for (const x of state.creatures) {
    const ver = await get(port, '/api/verify?id=' + encodeURIComponent(x.id));
    assert.equal(ver && ver.valid, true, `signature intact for ${x.id}`);
  }
  say(`hatched ${cr.fullName || cr.id} (${cr.rarity && cr.rarity.tier}), signature intact`);
  const raw = fs.readFileSync(path.join(dataDir, 'state.json'), 'utf8');
  for (const s of ['SECRET-PROMPT-TEXT', 'secret message', '/secret/dir', 'app.js']) assert.ok(!raw.includes(s), `never stored: ${s}`);

  await uninstall();
  for (let i = 0; i < 20 && (await get(port, '/api/version')); i++) await sleep(250);
  assert.equal(await get(port, '/api/version'), null, 'server stopped');
  say('uninstalled, server stopped');
}

const modes = ['clone', 'npx', 'plugin'].filter((m) => !only || m === only);
const results = await Promise.allSettled(modes.map((m, i) => scenario(m, basePort + i)));
let failed = 0;
results.forEach((r, i) => { if (r.status === 'rejected') { failed++; console.error(`[${modes[i]}] FAILED: ${r.reason && r.reason.message || r.reason}`); } });
// a failed run may leave its server up: stop it, only if that port still answers with the pid it recorded
for (const [i, m] of modes.entries()) {
  const v = await get(basePort + i, '/api/version');
  for (const d of [path.join(TMP, m, 'data'), path.join(TMP, m, 'home', 'data')]) {
    try { const pf = JSON.parse(fs.readFileSync(path.join(d, 'server.pid'), 'utf8')); if (v && v.pid === pf.pid) process.kill(pf.pid); } catch {}
  }
}
if (!keep) { await sleep(500); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} } else console.log('kept', TMP);
console.log(failed ? `\n${failed} of ${modes.length} failed` : `\nall ${modes.length} install paths passed`);
process.exit(failed ? 1 : 0);
