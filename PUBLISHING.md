# Publishing Proof of Life

Everything is built and tested locally. Each step below is one command you run yourself. Nothing here has been run yet.

Replace `<owner>` with your GitHub user name. Run every command from the repo folder (`D:\claude\proof-of-life`).

## 0. Deploy the telemetry collector and paste its URL (first, before GitHub or npm)

Plugin users get the code straight from the GitHub repo and npx users from npm, so the collector URL must be in `telemetry.js` before either goes out. With it empty, every install that says yes sends nothing, and there are no week-1 or D7 numbers.

1. Follow `collector/DEPLOY.md` (about 10 minutes, free Cloudflare tier). It ends with a URL like `https://pol-telemetry.<your-subdomain>.workers.dev`.
2. In `telemetry.js`, set `const TELEMETRY_URL = 'https://pol-telemetry.<your-subdomain>.workers.dev/v1/heartbeat';`
3. Check and commit:

```bash
npm run check-release           # fails while TELEMETRY_URL is empty or not the https .../v1/heartbeat URL
git commit -am "Set telemetry collector URL"
```

`npm publish` runs the same check (`prepublishOnly`) and refuses to publish until it passes.

## 0b. Check before you publish

```bash
npm run check-release           # collector URL set, package and plugin versions equal
npm test                        # unit tests
npm run smoke                   # clone, npx and plugin installs end to end, on temp folders and ports 4871-4873
claude plugin validate .        # marketplace + plugin manifests
npm pack --dry-run              # the exact files npm will ship (no data/, no collector/)
```

## 1. GitHub repo (also the plugin marketplace)

The repo is the marketplace and the plugin at once: `.claude-plugin/marketplace.json` lists one plugin with `"source": "./"`.

```bash
gh repo create <owner>/proof-of-life --public --source . --remote origin --push
```

CI (`.github/workflows/ci.yml`) then runs the install smoke test on Windows, macOS and Ubuntu with Node 18 and 20. GitHub Actions is free for public repos. Check it at `https://github.com/<owner>/proof-of-life/actions`.

After the repo exists, replace `<owner>` in README.md (Install section) and commit.

Users then install the plugin with:

```
/plugin marketplace add <owner>/proof-of-life
/plugin install proof-of-life@proof-of-life
```

On Claude Code 2.1.275 or later this also works in one step: `/plugin install proof-of-life --marketplace <owner>/proof-of-life`.

## 2. npm

The name `proof-of-life` was free on npm on 2026-10-10 (`npm view proof-of-life` gave 404). Check again right before you publish.

```bash
npm login                       # once; opens the browser
npm publish --access public
```

Then anyone can run `npx proof-of-life`. Check it on a clean machine or a temp home:

```bash
npx proof-of-life@latest --no-open
```

## 3. Releasing a new version

Keep the two version numbers equal (the smoke test fails if they differ). The plugin only updates for users when `version` in `.claude-plugin/plugin.json` changes.

```bash
npm version patch --no-git-tag-version     # bumps package.json
# set the same version in .claude-plugin/plugin.json
git commit -am "Release x.y.z" && git tag vx.y.z && git push --follow-tags
npm publish
```

npx users get the new version with `npx proof-of-life@latest`. That copies the app to `~/.proof-of-life/app`, re-points the hooks and restarts the server it started. Plugin users get it from `/plugin` (update), and the next session start restarts the server.

## What lives where after an install

| Path | npx | plugin | git clone |
|---|---|---|---|
| Hooks | `~/.claude/settings.json` -> `~/.proof-of-life/app/hooks` | the plugin's `hooks/hooks.json` (`${CLAUDE_PLUGIN_ROOT}`) | `~/.claude/settings.json` -> the clone |
| Data (creatures, signing key) | `~/.proof-of-life/data` | `~/.proof-of-life/data` | `./data` |
| Server | started by `npx proof-of-life` / `start` | started by the SessionStart hook | `node cli.mjs` or `node server.js` |

Use one path per machine. If you use both the plugin and settings hooks, every run is counted twice.
