# Proof of Life — creature art generation (run once, on our side)

The premium creature art is generated ONE time on our Higgsfield account and
bundled into `public/creatures/`. No end user ever generates anything. This file
is the turnkey plan. Blocked right now only on credits (account was at 0.03).

## Cost

- Seedream 4.5: 1 credit per image. Nano Banana Pro: 2 credits per image.
- 7 species + background removal ~= **10 to 20 credits** for the whole proof set.
- Top up the Higgsfield account (`higgs account status` to check), then run below.

## Shared style (hold constant across all 7)

> ugly-cute collectible vinyl monster, Pop Mart blind box designer toy, single
> character, full body, centered, front view, big glossy reflective eyes, soft
> rounded form, subtle organic texture, glossy vinyl finish, dramatic soft studio
> rim lighting, dark charcoal seamless background, high detail 3D render, no text

## The 7 species (vary only the subject)

1. **cog** — a small round mechanical gremlin of dark brushed steel and amber glass, tiny gear horns, glowing amber belly
2. **scholar** — a plump owl-like sage with teal fur, oversized wise eyes, a scholarly tuft, parchment belly
3. **moth** — a fuzzy winged moth spirit, dusty rose and cream, big feathery antennae, soft glowing wing patterns
4. **prism** — a crystalline geode creature, translucent cyan facets, glowing inner light, gem shards on its back
5. **lumen** — a glowing lantern creature of warm molten gold light, soft amber aura, luminous belly
6. **hydra** — a friendly many-eyed emerald slime, glossy translucent green body, several small eyes, tiny tendrils
7. **wisp** — a soft lavender ghost blob, dreamy translucent violet body, faint sparkles, gentle floaty form

## Pipeline per species (example: cog)

```bash
# 1. generate (blocks until done, prints the result URL as JSON)
higgs generate create nano_banana_pro \
  --prompt "a small round mechanical gremlin of dark brushed steel and amber glass, tiny gear horns, glowing amber belly. ugly-cute collectible vinyl monster, Pop Mart blind box designer toy, single character, full body, centered, front view, big glossy reflective eyes, soft rounded form, glossy vinyl finish, dramatic soft studio rim lighting, dark charcoal seamless background, high detail 3D render, no text" \
  --wait --json

# 2. cut the background out to a transparent PNG
higgs generate create image_background_remover --image <result_url_or_job_id> --wait --json

# 3. download the transparent result into the bundle
#    curl -L "<final_url>" -o public/creatures/cog.png
```

Then set `public/creatures/manifest.json` -> `{"species":{"cog":"cog.png", ...}}`.
The dashboard picks up bundled art automatically (SVG fills any gap).

Verify exact params first with: `higgs model get nano_banana_pro` and
`higgs model get image_background_remover`.
