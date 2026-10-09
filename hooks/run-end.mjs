// Proof of Life hook — Stop: hatch the creature from what the agent actually did.
import { send, readStdin } from './_post.mjs';
import { readActivity } from './_activity.mjs';
const data = await readStdin();
send('/api/run-end', { id: data.session_id || '', activity: readActivity(data.transcript_path) });
