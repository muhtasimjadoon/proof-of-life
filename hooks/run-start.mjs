// Proof of Life hook — UserPromptSubmit: lay an egg.
// The prompt is classified here, on this machine; only the species key is sent.
import { send, readStdin } from './_post.mjs';
import { createRequire } from 'node:module';
const { detectDomain } = createRequire(import.meta.url)('../engine.js');
const data = await readStdin();
send('/api/run-start', { id: data.session_id || '', domain: detectDomain(data.prompt || '') });
