# Genre loop contracts (soft guidance)

Infer the fantasy from the TDD (§1–§4 and §B). Apply the matching **loop contract**. When a starter template was seeded, it already satisfies its contract — keep that true while you adapt it.

## Universal (every prototype)

- Full loop: start → core verb → win **or** lose / round end → restart without page reload.
- **`look.js`** Look Bible + **LookKit** installed.
- **`hud.js` + HudKit** — live HUD for metrics the TDD implies (never module file names); title card + result.
- **`juice.js`** feedback hub (JuiceKit + FxKit + AudioKit) — sight + sound + motion on pickup, hit, boost, lap, win/lose.
- Primitive geometry, stylized materials. Items/power-ups = primitive mesh (glow) + short label or emoji — no image URLs, spritesheets, or external art.
- World has **role-readable landmarks** and set dressing.

## Kart / race (Mario Kart–like)

Apply when the TDD mentions laps, checkpoints, race positions, drift, item boxes, or racing.

1. Player `lap` **increments** after a real finish/checkpoint cycle (PathKit progress).
2. HUD: live lap `current / total`, position, speed, time; item slot if TDD has items; minimap.
3. When `lap >= totalLaps`, race **Finishes**, result UI appears, restart (R) works.
4. AI karts update every frame; positions change over time.
5. Countdown before GO; final-lap title; finish slow-mo.

**Do not ship a race that never ends.**

## Platformer / endless vertical

1. Live height/score on HUD; best record if endless.
2. Lose on fall/hazard; restart resets run.
3. Coyote time + jump buffer; squash/stretch + dust on land.
4. Platforms/hazards readable as roles (color + glow + motion).

## Collector / timed grab

1. Collectibles increment a live counter (combo pitch-up sfx + float text).
2. Win at target with time left; lose on timeout or fall.
3. Restart resets counts, timer, and spawns.

## Arena / combat wave

1. Clear win/lose (waves, HP, timer, lives).
2. Enemies update every frame, flash + knockback on hit, burst on death.
3. Rematch without reload.

## Stealth / infiltration / horror

1. Awareness/detection on HUD; objective progress.
2. Lose on capture/full alert; win on extract.
3. Restraint: darkness, few light pools, heartbeat/ambience — then spikes of feedback.

## Self-check before you stop writing

- [ ] Core verb readable in first seconds?
- [ ] Win **or** lose reachable in normal play?
- [ ] Restart works without F5?
- [ ] HUD numbers move when state changes?
- [ ] Feedback (fx + sfx + juice) fires on gameplay events?
- [ ] `look.js`, `hud.js` and `juice.js` exist and are wired from `main.js`?
- [ ] Kart only: can the race actually finish via lap count?
