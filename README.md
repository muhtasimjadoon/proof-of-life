# Proof of Life

**Every Claude Code run hatches a creature. It's a signed, unfakeable record of the work your agents actually did.**

You give an agent a task and wait. Proof of Life turns that wait into something: when a run starts, an egg starts growing. When it ends, a creature hatches, shaped by what the agent really did.

- **Species is set by the work done**, read from the tools the agent called and the files it touched: Cog (code), Scholar (research), Moth (writing), Prism (design), Lumen (video), Hydra (outreach), Wisp (browser and computer use).
- **Rarity is set by how long it ran:** Common (up to 20s), Uncommon (90s), Rare (5m), Epic (20m), Legendary (over 20m). Every tier is a visible upgrade: a pattern and an accessory, then metal trim and glowing eyes, glowing markings and an aura, and at Legendary a silhouette and finish upgrade: a Gold Chrome or Holo body, a pair of wings made for its species, a bigger crest and star eyes. Every creature wears at most one accessory, and nothing ever covers its eyes.
- **Mythic, the top tier,** can't be bought or rushed. Solo, it takes a run of 2 hours or more with 10 or more subagents that doesn't fail (*Legion*), or the first run of a 30th day in a row (*Devoted*). Cross-feeding with another operator on the same server also breeds Mythic hybrids.
- **Every creature is one of a kind.** Its colorway (8 per species), pattern, accessory, expression and eyes are read off its signed seed, and about 1 in 64 hatches **Shiny** in chrome or holo. Nothing about the look is stored, so it can't be edited either.
- **It grows up.** Each good run raises the earlier creatures of its kind, on a 60-level curve that slows as it climbs (Lv 2 after one run, Lv 60 after about 400): hatchlings (Lv 1-5) sit in their shell, juveniles (6-14) grow their ornaments in, adults (15-27) are fully grown, elders (28-39) get bushy brows, whiskers and a warm glow, and the Exalted (40+) snow-white brows and a laurel.
- **Traits come from real signals:** *Nightshift* (ran before 5am), *Marathon* (a long run), *Swarm* (5+ subagents), *Scarred* (survived a failure).
- **Every creature is signed with Ed25519** the moment it hatches. The signature covers duration, species, tier, seed, tool-call count and owner, so changing any of them breaks it. You can only earn one with real machine hours.

Same run, same creature, always. Runs under 10 seconds don't hatch, so the shelf stays meaningful.

## Install (2 minutes)

Needs Node 18+ and Claude Code. No dependencies, no build step.

```bash
git clone https://github.com/<you>/proof-of-life
cd proof-of-life
node install.mjs     # adds three hooks to ~/.claude/settings.json (backs it up first)
node server.js       # open http://localhost:4855
```

Then use Claude Code as usual. To remove it: `node install.mjs --uninstall`.

**After you update the code, restart the server** (stop it, then run `node server.js` again). The page is read from disk, so it updates at once; the server only loads its code when it starts. If the two don't match, the page says so in a banner instead of quietly showing empty panels (`/api/version` reports the running build).

## Privacy

Everything runs on your machine. Your creatures live in `data/state.json`.

- **Your prompts never leave the hook.** The prompt is classified locally into a species key, and only that key is sent to the local server.
- **When a run ends,** the hook reads the transcript and sends only counts: tool names, file extensions from a known list, the first word of shell commands from a known list (`npm`, `git`, `ffmpeg`), and how many tool calls came back as errors. Anything else is sent as `other`. It never sends file paths, file names, file contents, command arguments, error text or the conversation. When `POL_SERVER` points at another machine, MCP tool names are reduced to a family (`mcp__outreach`, `mcp__browser`), so the host never learns which servers you run.
- The server listens on `127.0.0.1` only, and on loopback it only answers to a loopback `Host`, so a web page that rebinds its domain to your machine can't read or change anything. Requests that change state must be JSON and must come from the page itself or from a hook: a request from another site is refused. Set `POL_HOST=0.0.0.0` to share it; remote requests then need an operator token to read a collection.
- The hooks time out in 1.5 seconds and always exit cleanly. They never slow down or break a session, even if the server is off.

## Skills

Every creature feeds 28 operator skills on a 1-120 curve (`skills.js`), with prestige stars past 120. A title band every ten levels (Novice, Apprentice, Journeyman, Adept, Expert, Master, Grandmaster, Virtuoso, Luminary, Paragon, Ascendant, Transcendent) and Apex at 120, each with its own color. Rarity words like Legendary and Mythic belong to creatures only.

- **Work:** Engineering, Debugging, Testing, Shipping, Data, Research, Writing, Design, Video, Outreach and Automation, from the tools a run used. Every skill a run really exercised gets its share, plus a floor per real signal, so three `git` calls always feed Shipping.
- **Craft:** Toolsmith, Orchestration, Endurance and Resilience, as bonuses on each run.
- **Habits:** Consistency, Polymath and Night Owl, from your days.
- **Style:** Focus (deep runs of 20 minutes or more), Velocity (runs per active day), Precision (runs with no failed tool call, and clean streaks), Early Bird (5-9am), Weekend Warrior, Explorer (tools and MCP servers used for the first time), Multitasker (runs that overlapped), Terminal (shell commands), Reviewer (read-heavy runs that changed nothing) and Collector (Dex slots filled).

Skills that need tool activity stay locked, with a line saying what unlocks them, until a run that carries it arrives. Runs from before activity tracking count toward the skill of their species. Runs over 4 hours count as 4 hours, and a session left open for more than a day is not counted as machine time.

## The Dex and the Board

The **Dex** has 308 slots: every species in every colorway at every hatch rarity, plus a Mythic, a Shiny and both Legendary editions per species. Each slot is filled by a real, signed creature, and it lists what to find next with the real rule for each.

The **Board** ranks operators on this week's points: every real run adds points for the machine time it took and the rarity it hatched. **Power** is the same points for all time. Alone on a server, you race your own records: best day, best week, longest streak, longest run.

## Verify a creature

```bash
curl "http://localhost:4855/api/verify?id=<creature id>"   # { "valid": true, ... }
curl  http://localhost:4855/api/pubkey                       # the signing public key
curl  http://localhost:4855/api/version                      # the running build
```

## Options

| | |
|---|---|
| `POL_PORT` | server port (default 4855) |
| `POL_DATA_DIR` | where creatures are stored (default `./data`) |
| `POL_HOST` | listen address (default `127.0.0.1`; `0.0.0.0` to share) |
| `POL_SERVER`, `POL_TOKEN` | point the hooks at a hosted server instead of localhost |
| `node server.js --samples` | add sample operators to explore the Board and cross-breeding |

## How it works

| File | Job |
|---|---|
| `hooks/run-start.mjs` | `UserPromptSubmit`: lays an egg |
| `hooks/run-subagent.mjs` | `SubagentStop`: counts subagents |
| `hooks/run-end.mjs` | `Stop`: reads what the agent did and hatches the creature |
| `engine.js` | deterministic creature engine (species, rarity, Mythic, traits, art seed) |
| `skills.js` | skill curve, bands and xp formulas (shared with the browser as `/skills.js`) |
| `public/variants.js` | the collectible look of every seed: colorways, patterns, accessories, faces, Shiny, growth, Dex slots |
| `server.js` | zero-dependency server: signing, storage, API, UI |

## License

MIT
