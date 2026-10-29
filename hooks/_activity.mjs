// Reads what the agent actually DID in the turn that just ended, from the
// Claude Code transcript. Only counts (and quiet-stretch times) leave this machine: tool names, file
// extensions from a known list, the first word of shell commands from a known
// list, and how many tool calls came back as errors. Never prompts, paths, file
// names, file contents, error text or command arguments. Also how many git
// commits and pushes ran (two counts, no messages, remotes or branches). Anything outside the
// known lists is sent as 'other'.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { KNOWN_EXTS, KNOWN_CMDS } = createRequire(import.meta.url)('../skills.js');
const MAX_BYTES = 4 * 1024 * 1024; // only the tail of very long transcripts

// When the hooks post to a server on another machine, MCP tool names would
// reveal which servers you have installed. Then only the family is sent.
const FAMILIES = [
  [/linkedin|aimfox|gmail|mail|slack|whatsapp|crm|hubspot|telegram|discord/, 'outreach'],
  [/figma|canva|penpot|design/, 'design'],
  [/remotion|video|higgsfield|youtube/, 'video'],
  [/sqlite|postgres|supabase|bigquery|duckdb|database|sheets|airtable/, 'database'],
  [/chrome|browser|computer|windows|click|screenshot|playwright|puppeteer/, 'browser'],
  [/search|fetch|research/, 'search'],
];
function isRemoteServer() {
  try { const h = new URL(process.env.POL_SERVER || 'http://127.0.0.1').hostname; return !(h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]'); } catch { return false; }
}
export function toolLabel(name, remote) {
  const n = String(name || 'unknown').slice(0, 80);
  if (!remote || !n.startsWith('mcp__')) return n;
  const low = n.toLowerCase();
  for (const [re, fam] of FAMILIES) if (re.test(low)) return 'mcp__' + fam;
  return 'mcp__other';
}
export function extLabel(fp) {
  const ext = path.extname(String(fp)).toLowerCase();
  if (!ext) return null;
  return KNOWN_EXTS.has(ext) ? ext : 'other';
}
const norm = (w) => String(w || '').replace(/\u0000/g, ' ').replace(/^.*[\\/]/, '').toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
const RUNNERS = new Set(['npx', 'pnpx', 'bunx']);         // npx jest -> jest
const PKG = new Set(['npm', 'pnpm', 'yarn', 'bun']);       // npm test, yarn run test:unit -> pkg-test
function segLabel(seg) {
  // strip quotes so "C:/Program Files/x.exe" -> x.exe, never 'program'
  const words = seg.trim().replace(/^["']([^"']*)["']/, (m, p) => p.replace(/\s/g, '\u0000')).split(/\s+/).filter(Boolean);
  while (words.length && /^\w+=/.test(words[0])) words.shift(); // skip VAR=value prefixes
  const head = norm(words[0]);
  if (!head) return null;
  const rest = words.slice(1).filter((w) => !w.startsWith('-')).map(norm);
  if (RUNNERS.has(head) && rest[0] && KNOWN_CMDS.has(rest[0])) return rest[0];
  if (PKG.has(head) && (rest[0] === 'exec' || rest[0] === 'dlx') && rest[1] && KNOWN_CMDS.has(rest[1])) return rest[1]; // pnpm exec playwright
  if (PKG.has(head) && (rest[0] === 'test' || ((rest[0] === 'run' || rest[0] === 'exec') && /^test/.test(rest[1] || '')))) return 'pkg-test';
  return KNOWN_CMDS.has(head) ? head : 'other';
}
// one known word (or 'other') per command in a chain: cd app && git push -> cd, git
export function cmdLabels(command) {
  return String(command).split(/&&|\|\||;|\|/).slice(0, 8).map(segLabel).filter(Boolean);
}
export function cmdLabel(command) { return cmdLabels(command)[0] || null; }
// how many git commits and pushes a command ran: only these two counts, never
// the message, remote, branch or any other argument
const GIT_OPTS_WITH_ARG = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace']);
export function gitOps(command) {
  const out = { commit: 0, push: 0 };
  for (const seg of String(command).split(/&&|\|\||;|\|/).slice(0, 8)) {
    const words = seg.trim().replace(/^["']([^"']*)["']/, (m, p) => p.replace(/\s/g, '\u0000')).split(/\s+/).filter(Boolean);
    while (words.length && /^\w+=/.test(words[0])) words.shift();
    if (norm(words[0]) !== 'git') continue;
    let k = 1;
    while (k < words.length && words[k].startsWith('-')) k += GIT_OPTS_WITH_ARG.has(words[k]) ? 2 : 1;
    const sub = String(words[k] || '').toLowerCase();
    if (sub === 'commit' || sub === 'push') out[sub]++;
  }
  return out;
}

export function isPromptEntry(e) {
  if (e.type !== 'user' || e.isMeta || !e.message) return false;
  const c = e.message.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((x) => x.type === 'text') && !c.some((x) => x.type === 'tool_result');
}

// Quiet stretches in this turn: [startMs, endMs] pairs, from the transcript's own
// timestamps, where nothing was written for GAP_MIN_MS or more. Times only, never
// what came before or after. The server uses them to find when a "needs your
// input" wait really ended, so time spent waiting on you is not counted as agent time.
const GAP_MIN_MS = 15000, MAX_GAPS = 100;
export function quietGaps(entries, from) {
  const gaps = [];
  let prev = null;
  for (let j = from; j < entries.length; j++) {
    const t = Date.parse(entries[j] && entries[j].timestamp);
    if (!isFinite(t)) continue;
    if (prev != null && t - prev >= GAP_MIN_MS) gaps.push([prev, t]);
    if (prev == null || t > prev) prev = t;
  }
  return gaps.length > MAX_GAPS ? gaps.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, MAX_GAPS).sort((a, b) => a[0] - b[0]) : gaps;
}

// whole: count the full file (a subagent transcript is one task end to end)
// withGaps: also return the turn's quiet stretches (times only) as .gaps
export function readActivity(transcriptPath, whole, withGaps) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
    const remote = isRemoteServer();
    const size = fs.statSync(transcriptPath).size;
    const fd = fs.openSync(transcriptPath, 'r');
    const start = Math.max(0, size - MAX_BYTES);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    const entries = [];
    for (const line of buf.toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch {}
    }
    // walk back to the prompt that opened this turn
    let i = entries.length - 1;
    if (whole) i = -1;
    else while (i >= 0 && !isPromptEntry(entries[i])) i--;
    return activityFromEntries(entries, i, withGaps, remote);
  } catch {
    return null;
  }
}

// the counts for entries after index i (the prompt that opened the turn, or -1
// for the whole list). readActivity uses it at Stop time; the transcript
// recovery script (scripts/recover-from-transcripts.mjs) uses it per past turn
export function activityFromEntries(entries, i, withGaps, remote) {
  {
    const tools = {}, exts = {}, cmds = {};
    const git = { commit: 0, push: 0 };
    let toolCalls = 0, toolErrors = 0;
    for (let j = i + 1; j < entries.length; j++) {
      const e = entries[j];
      // a failed tool comes back as a tool_result flagged is_error: only the count is kept
      if (e.type === 'user' && e.message && Array.isArray(e.message.content)) {
        for (const b of e.message.content) if (b && b.type === 'tool_result' && b.is_error === true) toolErrors++;
        continue;
      }
      if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
      for (const b of e.message.content) {
        if (b.type !== 'tool_use') continue;
        toolCalls++;
        const name = toolLabel(b.name, remote);
        tools[name] = (tools[name] || 0) + 1;
        const inp = b.input || {};
        const fp = inp.file_path || inp.notebook_path || inp.path;
        if (typeof fp === 'string') { const ext = extLabel(fp); if (ext) exts[ext] = (exts[ext] || 0) + 1; }
        if (typeof inp.command === 'string') {
          for (const head of cmdLabels(inp.command)) cmds[head] = (cmds[head] || 0) + 1;
          if (cmds.git) { const g = gitOps(inp.command); git.commit += g.commit; git.push += g.push; }
        }
      }
    }
    const out = { toolCalls, toolErrors: Math.min(toolErrors, toolCalls), tools, exts, cmds };
    if (git.commit || git.push) out.git = git; // counts only, and only when there were any
    if (withGaps) out.gaps = quietGaps(entries, Math.max(0, i));
    return out;
  }
}
