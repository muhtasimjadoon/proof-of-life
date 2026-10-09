# Proof of Life

**Every Claude Code run hatches a creature. It's a signed, unfakeable record of the work your agents actually did.**

You give an agent a task and wait. Proof of Life turns that wait into something: when a run starts, an egg starts growing. When it ends, a creature hatches, shaped by what the agent really did.

- **Species is set by the work done**, read from the tools the agent called and the files it touched: Cog (code), Scholar (research), Moth (writing), Prism (design), Lumen (video), Hydra (outreach), Wisp (browser and computer use).
- **Rarity is set by how long it ran:** Common, Uncommon, Rare, Epic, Legendary.
- **Traits come from real signals:** *Nightshift* (ran before 5am), *Marathon* (a long run), *Swarm* (5+ subagents), *Scarred* (survived a failure).
- **Every creature is signed with Ed25519** the moment it hatches. The signature covers duration, species, tool-call count and owner, so changing any of them breaks it. You can't buy one or fake one. You can only earn it with real machine hours.

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

## Privacy

Everything runs on your machine. Your creatures live in `data/state.json`.

- **Your prompts never leave the hook.** The prompt is classified locally into a species key, and only that key is sent to the local server.
- **When a run ends,** the hook reads the transcript and sends only counts: tool names, file extensions, and the first word of shell commands (`npm`, `git`, `ffmpeg`). It never sends file paths, file contents, command arguments or the conversation.
- The hooks time out in 1.5 seconds and always exit cleanly. They never slow down or break a session, even if the server is off.

## Verify a creature

```bash
curl "http://localhost:4855/api/verify?id=<creature id>"   # { "valid": true, ... }
curl  http://localhost:4855/api/pubkey                       # the signing public key
```

## Options

| | |
|---|---|
| `POL_PORT` | server port (default 4855) |
| `POL_DATA_DIR` | where creatures are stored (default `./data`) |
| `POL_SERVER`, `POL_TOKEN` | point the hooks at a hosted server instead of localhost |
| `node server.js --samples` | add sample operators to explore the Board and cross-breeding |

## How it works

| File | Job |
|---|---|
| `hooks/run-start.mjs` | `UserPromptSubmit`: lays an egg |
| `hooks/run-subagent.mjs` | `SubagentStop`: counts subagents |
| `hooks/run-end.mjs` | `Stop`: reads what the agent did and hatches the creature |
| `engine.js` | deterministic creature engine (species, rarity, traits, art seed) |
| `server.js` | zero-dependency server: signing, storage, API, UI |

## License

MIT
