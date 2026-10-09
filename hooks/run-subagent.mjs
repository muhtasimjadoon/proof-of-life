// Proof of Life hook — SubagentStop: count one worker against the open run.
import { send, readStdin } from './_post.mjs';
const data = await readStdin();
send('/api/run-subagent', { id: data.session_id || '' });
