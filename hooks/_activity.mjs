// Reads what the agent actually DID in the turn that just ended, from the
// Claude Code transcript. Only counts leave this machine: tool names, file
// extensions from a known list, and the first word of shell commands from a
// known list. Never prompts, paths, file names, file contents, or command
// arguments. Anything outside the known lists is sent as 'other'.
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
export function cmdLabel(command) {
  // strip quotes so "C:/Program Files/x.exe" -> x.exe, never 'program'
  const words = String(command).trim().replace(/^["']([^"']*)["']/, (m, p) => p.replace(/\s/g, '\u0000')).split(/\s+/);
  while (words.length && /^\w+=/.test(words[0])) words.shift(); // skip VAR=value prefixes
  let head = (words[0] || '').replace(/\u0000/g, ' ').replace(/^.*[\\/]/, '').toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '');
  if (!head) return null;
  return KNOWN_CMDS.has(head) ? head : 'other';
}

function isPromptEntry(e) {
  if (e.type !== 'user' || e.isMeta || !e.message) return false;
  const c = e.message.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((x) => x.type === 'text') && !c.some((x) => x.type === 'tool_result');
}

// whole: count the full file (a subagent transcript is one task end to end)
export function readActivity(transcriptPath, whole) {
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
    const tools = {}, exts = {}, cmds = {};
    let toolCalls = 0;
    for (let j = i + 1; j < entries.length; j++) {
      const e = entries[j];
      if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
      for (const b of e.message.content) {
        if (b.type !== 'tool_use') continue;
        toolCalls++;
        const name = toolLabel(b.name, remote);
        tools[name] = (tools[name] || 0) + 1;
        const inp = b.input || {};
        const fp = inp.file_path || inp.notebook_path || inp.path;
        if (typeof fp === 'string') { const ext = extLabel(fp); if (ext) exts[ext] = (exts[ext] || 0) + 1; }
        if (typeof inp.command === 'string') { const head = cmdLabel(inp.command); if (head) cmds[head] = (cmds[head] || 0) + 1; }
      }
    }
    return { toolCalls, tools, exts, cmds };
  } catch {
    return null;
  }
}
