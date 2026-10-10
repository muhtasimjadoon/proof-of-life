# Usage stats (telemetry)

Proof of Life can send one small, counts-only heartbeat a week, so we can tell how many people use it and what kind of work their agents do. **It is off unless you say yes.**

## How it is turned on and off

- The terminal installer (`npx proof-of-life` or `node cli.mjs` in a clone) asks once: `Share usage counts? [y/N]`. Enter or anything but `y` means no. Without a terminal (scripts, CI) it never asks and stays off.
- The Claude Code plugin has no terminal step, so the page asks instead: until you answer, Home shows **Share anonymous weekly usage counts?** with **Yes, share counts** and **No**. Either answer is stored and the question never comes back. The page can only do this from this machine (a same-origin request to `POST /api/telemetry`).
- Change your answer any time, without touching your hooks:
  - npx or plugin install: `npx proof-of-life telemetry on` or `npx proof-of-life telemetry off`
  - git clone: `node cli.mjs telemetry on` or `node cli.mjs telemetry off`
  - or the Turn on / Turn off button under **How it works → Provenance**.
  `telemetry status` prints the current answer. (`node install.mjs --telemetry=on|off` still works in a clone, but it also rewrites your global hooks, so plugin users should not use it.)
- `POL_TELEMETRY=off` in the server's environment always turns it off, whatever you answered.
- The page shows the current state under **How it works → Provenance**: "Usage stats: on/off", why, and the command to change it.
- Your answer, where you gave it, and a random install ID live in `telemetry.json` in your data folder (`data/` in a clone, `~/.proof-of-life/data` for npx and the plugin; git-ignored). Delete that file and it is as if you were never asked: off.

## When it is sent

- Only by the Proof of Life server process (`node server.js`), never by the hooks, so your Claude Code runs never wait on it.
- At most once per ISO week, the first time in that week the server sees a run you hatched. The very first heartbeat after you say yes may go out with zero runs, a day later, so an install that has not run anything yet is still counted once.
- To the URL in `POL_TELEMETRY_URL`, or else the `TELEMETRY_URL` constant in `telemetry.js`. If both are empty, nothing is ever sent.
- If the collector cannot be reached, the server tries again within the hour. Nothing queues up; a missed week is just missed.

## Exact schema

One JSON object, `POST` with `content-type: application/json`. No other fields are sent, and the collector rejects any other field.

| field | type | example | meaning |
|---|---|---|---|
| `installId` | string, 32 lowercase hex | `"6e79cb564f3daef4e16dd329d4af9bbd"` | random, made on your machine when you said yes; not derived from anything about you |
| `appVersion` | string, semver | `"1.0.0"` | the `version` in package.json |
| `isoWeek` | string `YYYY-Www` | `"2026-W41"` | the ISO week it is sent in (your local time) |
| `runsHatched` | integer | `23` | creatures your runs hatched in the 7 days before sending (bred creatures left out) |
| `activeDays` | integer 0-7 | `4` | how many of those 7 days had at least one hatched run |
| `runsBySpecies` | object of integers | `{"cog":9,"moth":6,"scholar":5,"hydra":3}` | those runs by type of work. Keys only from: `cog` (code), `scholar` (research), `moth` (writing), `prism` (design), `lumen` (video), `hydra` (outreach), `wisp` (general). Adds up to `runsHatched` |
| `agent` | string | `"claude-code"` | which agent the hooks came from |

The request also carries a `user-agent: proof-of-life/<version>` header.

## What is never sent

- Your handle, display name, email, or any account or operator data.
- Prompts, replies, transcripts, file paths, file names, file contents, commands or their arguments, tool inputs or outputs, project or repo names.
- Creature names, IDs, seeds, signatures, your attestor key, or anything from `data/state.json` beyond the counts above.
- Exact times: only the week, and how many days in it were active.

## What the collector keeps

The collector (`collector/`, a Cloudflare Worker with a D1 database) stores one row per install ID per ISO week: the fields above plus the UTC date it arrived. It does not store your IP address, user agent or any request header, and it does not log requests. A second heartbeat for the same week is accepted but not stored. Cloudflare, as the host, sees connection metadata the way any web host does; the Worker never reads or saves it.

What we compute from it (`scripts/metrics.mjs`): installs counted by install ID, weekly active installs, week-1 and week-2 retention (D7/D14), and the non-code share of runs.
