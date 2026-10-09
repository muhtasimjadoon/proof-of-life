// Reads what the agent actually DID in the turn that just ended, from the
// Claude Code transcript. Only counts leave this machine: tool names, file
// extensions, and the first word of shell commands. Never prompts, paths,
// file contents, or command arguments.
import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 4 * 1024 * 1024; // only the tail of very long transcripts

function isPromptEntry(e) {
  if (e.type !== 'user' || e.isMeta || !e.message) return false;
  const c = e.message.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((x) => x.type === 'text') && !c.some((x) => x.type === 'tool_result');
}

export function readActivity(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
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
    while (i >= 0 && !isPromptEntry(entries[i])) i--;
    const tools = {}, exts = {}, cmds = {};
    let toolCalls = 0;
    for (let j = i + 1; j < entries.length; j++) {
      const e = entries[j];
      if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
      for (const b of e.message.content) {
        if (b.type !== 'tool_use') continue;
        toolCalls++;
        const name = String(b.name || 'unknown').slice(0, 80);
        tools[name] = (tools[name] || 0) + 1;
        const inp = b.input || {};
        const fp = inp.file_path || inp.notebook_path || inp.path;
        if (typeof fp === 'string') {
          const ext = path.extname(fp).toLowerCase().slice(0, 10);
          if (ext) exts[ext] = (exts[ext] || 0) + 1;
        }
        if (typeof inp.command === 'string') {
          const words = inp.command.trim().split(/\s+/);
          while (words.length && /^\w+=/.test(words[0])) words.shift(); // skip VAR=value prefixes
          const head = (words[0] || '').replace(/^.*[\\/]/, '').toLowerCase().slice(0, 24);
          if (head) cmds[head] = (cmds[head] || 0) + 1;
        }
      }
    }
    return { toolCalls, tools, exts, cmds };
  } catch {
    return null;
  }
}
