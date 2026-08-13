# Genre loop contracts (soft guidance)

Infer the fantasy from the TDD (§1–§4 and §B). Apply the matching **loop contract**.  
These are product rules for the playable — not lab chrome.

## Universal (every prototype)

- Full loop: start → core verb → win **or** lose / round end → restart without page reload.
- Live HUD for the metrics the TDD implies (never module file names).
- Graybox only: boxes / capsules / cylinders / spheres / planes. Matte colors.
- Power-ups / items: **primitive mesh + short label or emoji** — do not invent image URLs, spritesheets, or external art.
- Prefer juice on matte materials (flash, scale pop, brief shake) over new asset pipelines.

## Kart / race (Mario Kart–like)

Apply when the TDD mentions laps, checkpoints, race positions, drift, item boxes, or racing.

**Must work in play (not optional polish):**

1. Player `lap` (or equivalent) **increments** when completing a lap / crossing the finish after the required checkpoints.
2. HUD shows live lap `current / total` and position.
3. When `lap >= totalLaps` (or TDD equivalent), race **Finishes**, result UI appears, restart (e.g. `R`) works.
4. AI karts update every frame; rubber-band optional but positions must change over time.

**Do not ship a race that never ends** because laps are cosmetic or checkpoints never fire.

## Collector / timed grab

Apply when win = collect N items before timer / void.

1. Collectibles increment a live counter on HUD.
2. Win at target count with time left; lose on timeout or fall.
3. Restart resets counts, timer, and spawns.

## Arena / combat wave

Apply when fight / eliminate / survive.

1. Clear win/lose (KOs, timer, lives).
2. Enemy or wave state updates every frame.
3. Rematch / restart without reload.

## Presentation licenses (keep feel, keep graybox)

Allowed: hit flash, stun, boost trails via scaled primitives, particle-ish boxes, emoji/text item icons.  
Avoid: loading remote images, PBR textures, glTF dependencies for the core loop.

## Self-check before you stop writing

Answer yes to each that applies — if no, fix code now:

- [ ] Core verb readable in first seconds?
- [ ] Win **or** lose reachable in normal play?
- [ ] Restart works without F5?
- [ ] HUD numbers move when state changes (laps, score, ammo…)?
- [ ] Kart only: can the race actually finish via lap count?
