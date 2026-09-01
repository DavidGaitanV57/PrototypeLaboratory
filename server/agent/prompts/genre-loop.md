# Genre loop contracts (soft guidance)

Infer the fantasy from the TDD (§1–§4 and §B). Apply the matching **loop contract**.  
These are product rules for the playable — not lab chrome.

## Universal (every prototype)

- Full loop: start → core verb → win **or** lose / round end → restart without page reload.
- **`hud.js` + HudKit** — live HUD for metrics the TDD implies (never module file names).
- **`juice.js` + JuiceKit** — feedback on pickup, hit, boost, lap, win/lose.
- Graybox only: boxes / capsules / cylinders / spheres / planes. Matte colors.
- Power-ups / items: **primitive mesh + short label or emoji** — do not invent image URLs, spritesheets, or external art.
- World has **role-readable landmarks** — not an empty grid alone.

## Kart / race (Mario Kart–like)

Apply when the TDD mentions laps, checkpoints, race positions, drift, item boxes, or racing.

**Must work in play (not optional polish):**

1. Player `lap` (or equivalent) **increments** when completing a lap / crossing the finish after the required checkpoints.
2. HUD shows live lap `current / total`, position, speed, time; item slot if TDD has items.
3. When `lap >= totalLaps` (or TDD equivalent), race **Finishes**, result UI appears, restart (e.g. `R`) works.
4. AI karts update every frame; rubber-band optional but positions must change over time.
5. Prefer **PathKit** for track spline + **MinimapKit** when a minimap is implied.

**Do not ship a race that never ends** because laps are cosmetic or checkpoints never fire.

## Platformer / endless vertical

1. Live height/score/depth on HUD; best record if endless.
2. Lose on fall/hazard; restart resets run.
3. Platforms/hazards readable as roles (kelp, coral, enemy, pickup).

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

## Stealth / infiltration

1. Detection/alert state on HUD when TDD implies guards.
2. Objective progress (terminals, extraction).
3. Lose on full alert or timeout; win on extract.

## Presentation licenses (keep feel, keep graybox)

Allowed: hit flash, stun, boost trails via scaled primitives, particle-ish boxes, emoji/text item icons, HudKit toasts/overlays.  
Avoid: loading remote images, PBR textures, glTF dependencies for the core loop.

## Self-check before you stop writing

Answer yes to each that applies — if no, fix code now:

- [ ] Core verb readable in first seconds?
- [ ] Win **or** lose reachable in normal play?
- [ ] Restart works without F5?
- [ ] HUD numbers move when state changes (laps, score, ammo…)?
- [ ] Juice fires on at least one gameplay event?
- [ ] `hud.js` and `juice.js` exist and are wired from `main.js`?
- [ ] Kart only: can the race actually finish via lap count?
