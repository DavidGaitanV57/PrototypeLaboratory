---
name: playable-prototype
description: >-
  Generate and iterate Prototype Laboratory graybox playables from a V57 TDD.
  Use when writing public/gameplay/**, Generate Final, chat-tuning feel, or
  fixing race/collector/arena loops (laps, win/lose, restart) without blocking delivery.
---

# Playable prototype (Prototype Laboratory)

## Hard rules

- Write only `public/gameplay/**`. Never edit `public/runtime/**`, lab UI, or `server/`.
- Entry: `public/gameplay/main.js` with `export async function mount(canvas, { hudRoot })` and `unmount()`.
- **Required modules:** `hud.js` (HudKit), `juice.js` (JuiceKit), plus mechanic modules as needed.
- Import helpers from `/runtime/*.js` (Engine, SceneKit, Input, EventBus, Primitives, CameraRig, **HudKit, JuiceKit, PathKit, MinimapKit**).
- Graybox only: primitives + matte colors. Items = mesh + short label/emoji — no remote image URLs unless asked.
- Keep game HUD off the **bottom-right** (lab chrome lives there). Prefer returning `{ sceneKit }` from `mount`.

## Build the loop from the TDD

1. Read `docs/tdds/<slug>/` active TDD (`TDD.md` preferred) §3 core loop, §B mechanics, §11.3 input, §11.5 camera.
2. Infer genre and obey the matching contract:

### Kart / race

- Lap **must increment** on a real finish/checkpoint cycle.
- At `totalLaps`, race **Finishes**, show result, restart (often `R`) without reload.
- Live HUD: position + lap current/total + speed; PathKit/MinimapKit when track/minimap implied.
- Never ship a race that never ends because laps are decorative.

### Platformer / endless vertical

- Live height/score on HUD; lose on fall/hazard; landmarks in the column.

### Collector

- Live collect count; win at target; lose on timeout/fall; restart resets state.

### Arena

- Clear win/lose; NPCs update every frame; rematch without reload.

### Stealth

- Alert/objective on HUD; extract win; detection lose.

## Quality bar (vertical slice)

Readable fantasy in &lt;3s, full loop, delta-time movement, **HudKit live HUD**, **JuiceKit feedback**, world landmarks.  
Fail: lone cube on empty plane; static HUD; HUD listing filenames; no juice on events.

## Chat iteration

Tune feel/numbers/juice/HUD. If soft playability hints mention laps/finish/restart/hud.js, fix those first when relevant.  
End with a short summary of what changed and how to verify in play.

## Soft checks

The lab may emit advisory hints after a run. They **do not** block Play. Prefer fixing loop bugs; do not fail the whole build over presentation taste.
