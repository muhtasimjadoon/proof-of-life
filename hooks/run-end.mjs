// Proof of Life hook — Stop: hatch the creature from what the agent actually did.
import { send, readStdin } from './_post.mjs';
import { readActivity } from './_activity.mjs';
const data = await readStdin();
const activity = readActivity(data.transcript_path, false, true);
// quiet stretches (start and end times only) let the server leave out time the
// run spent waiting on you; they are sent beside the counts, never inside them
const gaps = activity ? activity.gaps : null;
if (activity) delete activity.gaps;
// tzOffset (minutes, like Date#getTimezoneOffset) lets a server in another
// timezone know when your night was (Nightshift, Night Owl)
send('/api/run-end', { id: data.session_id || '', activity, gaps, tzOffset: new Date().getTimezoneOffset() });
