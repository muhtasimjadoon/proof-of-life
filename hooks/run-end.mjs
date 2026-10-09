// Proof of Life hook — Stop: hatch the creature from what the agent actually did.
import { send, readStdin } from './_post.mjs';
import { readActivity } from './_activity.mjs';
const data = await readStdin();
// tzOffset (minutes, like Date#getTimezoneOffset) lets a server in another
// timezone know when your night was (Nightshift, Night Owl)
send('/api/run-end', { id: data.session_id || '', activity: readActivity(data.transcript_path), tzOffset: new Date().getTimezoneOffset() });
