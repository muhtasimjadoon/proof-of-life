// Proof of Life hook — Notification: the run is waiting on you (a permission
// prompt or a question), so the egg shows "needs your input" until the next
// prompt, subagent or Stop. The notice text is read here, on this machine, only
// to pick one of three words; the text itself never leaves.
import { send, readStdin, done } from './_post.mjs';
const data = await readStdin();
const type = String(data.notification_type || '');
const msg = String(data.message || '').toLowerCase();
// "waiting for your input" after a run ended, and sign-in notices, are not a
// run waiting on you: nothing to send
if (type === 'idle_prompt' || type === 'auth_success' || (!type && /waiting for your input/.test(msg))) done();
else {
  const kind = type === 'permission_prompt' || (!type && /permission/.test(msg)) ? 'permission'
    : type === 'elicitation_dialog' ? 'question' : 'input';
  send('/api/run-notify', { id: data.session_id || '', kind });
}
