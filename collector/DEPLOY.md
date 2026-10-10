# Deploy the telemetry collector (Cloudflare Worker + D1)

About 10 minutes, free tier. You need a Cloudflare account and Node 18+. Run every command from this `collector/` folder. `npx wrangler` downloads Wrangler on first use; the app itself still needs no install.

0. Check the Worker offline first (no account needed):

   ```
   node test.mjs
   ```

1. Log in to Cloudflare (opens the browser):

   ```
   npx wrangler login
   ```

2. Create the database:

   ```
   npx wrangler d1 create pol-telemetry
   ```

   It prints a `database_id`. Paste it into `wrangler.toml` in place of `PASTE-DATABASE-ID-HERE`.

3. Create the table:

   ```
   npx wrangler d1 execute pol-telemetry --remote --file=schema.sql
   ```

4. Set the token that protects the stats endpoint (pick a long random string; keep it, `metrics.mjs` needs it):

   ```
   npx wrangler secret put STATS_TOKEN
   ```

5. Deploy:

   ```
   npx wrangler deploy
   ```

   It prints the Worker URL, like `https://pol-telemetry.<your-subdomain>.workers.dev`.

6. Smoke test (expect `{"ok":true,"stored":true}`, then delete the test row). Replace `2026-W42` below with the current ISO week, which this prints: `node -e "console.log(require('../telemetry.js').isoWeek(Date.now()))"`

   ```
   curl -X POST https://pol-telemetry.<your-subdomain>.workers.dev/v1/heartbeat -H "content-type: application/json" -d "{\"installId\":\"00000000000000000000000000000000\",\"appVersion\":\"1.0.0\",\"isoWeek\":\"2026-W42\",\"runsHatched\":0,\"activeDays\":0,\"runsBySpecies\":{},\"agent\":\"claude-code\"}"
   npx wrangler d1 execute pol-telemetry --remote --command "DELETE FROM heartbeats WHERE install_id='00000000000000000000000000000000'"
   ```

## Where to paste the URL

Open `telemetry.js` in the repo root and set the constant to the heartbeat endpoint:

```js
const TELEMETRY_URL = 'https://pol-telemetry.<your-subdomain>.workers.dev/v1/heartbeat';
```

Commit that before publishing. Until it is set, no install sends anything, even ones that said yes. (`POL_TELEMETRY_URL` overrides it for testing.)

## Reading the numbers

```
node ../scripts/metrics.mjs --url https://pol-telemetry.<your-subdomain>.workers.dev/v1/stats --token <STATS_TOKEN>
```

or from a D1 export:

```
npx wrangler d1 execute pol-telemetry --remote --json --command "SELECT * FROM heartbeats" > rows.json
node ../scripts/metrics.mjs rows.json
```

## Notes

- No IP is stored and the Worker never logs; `[observability] enabled = false` in `wrangler.toml` keeps Workers Logs off.
- Rate limits: one stored row per install ID per ISO week (the table's primary key), at most 3 requests a minute per install ID per Worker instance, only the current week (plus or minus one) is accepted, bodies over 2 KB are refused, and unknown fields are rejected. For extra flood protection you can add a Cloudflare WAF rate-limiting rule on `/v1/heartbeat` in the dashboard.
