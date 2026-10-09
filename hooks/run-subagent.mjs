// Proof of Life hook — SubagentStop: count one worker against the open run,
// plus the tool calls it made (they live in the subagent's own transcript).
import { send, readStdin } from './_post.mjs';
import { readActivity } from './_activity.mjs';
const data = await readStdin();
const activity = data.agent_transcript_path ? readActivity(data.agent_transcript_path, true) : null;
send('/api/run-subagent', { id: data.session_id || '', activity });
