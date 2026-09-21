# Vertical slice presentation (all genres)

You are building a **playable vertical slice** — a short game that feels fun in the first minute, not a debug sandbox.

Graybox art only (primitives + matte colors by default). **Presentation is part of the product**, same as mechanics — raise look when the TDD defines art/atmosphere (see presentation ceiling).

## Required modules (every Generate Final)

| Module | Purpose |
|--------|---------|
| `public/gameplay/main.js` | `mount` / `unmount`, engine loop |
| `public/gameplay/hud.js` | **All DOM HUD** — use `/runtime/HudKit.js` |
| `public/gameplay/juice.js` | Shake, flash, hit-stop — use `/runtime/JuiceKit.js` |

Optional when the TDD implies them:

- `/runtime/PathKit.js` — splines, lap progress, patrol paths (race, lanes, circuits)
- `/runtime/MinimapKit.js` — 2D minimap inside a HudKit panel (race, stealth, open world)
- `/runtime/PresentationKit.js` — fog, grain, vignette, VHS, wash, curb stripes, trails (when TDD art/atmosphere asks)

## HudKit quick start

```js
import { createHud, themeFromPalette } from "/runtime/HudKit.js";

export function mountHud(hudRoot) {
  // Default arcade (party/kart). For liminal/horror TDDs use theme: "liminal".
  // Or tint from TDD master palette hex:
  // const hud = createHud(hudRoot, { theme: themeFromPalette({ accent: "#C9B45A", preset: "liminal" }) });
  const hud = createHud(hudRoot, { theme: "arcade" });
  const pos = hud.panel("top-left");
  pos.stat("rank", "POS", { large: true });
  const speed = hud.panel("bottom-left", { minWidth: "200px" });
  speed.stat("spd", "KM/H", { large: true });
  speed.bar("boost", "BOOST");
  hud.controlsHint("<b>WASD</b> steer · <b>SPACE</b> drift · <b>E</b> item · <b>R</b> restart");
  return hud;
}
```

Keep panels off **bottom-right** (lab chrome). Update stats every frame from game state.  
**Theme skins the chrome only** — same anchors, stats, toast, overlay, restart. Presets: `arcade`/`party`, `liminal`, `muted`, `stealth`, or `themeFromPalette({ accent })`.

## JuiceKit quick start

```js
import { createJuice } from "/runtime/JuiceKit.js";

const juice = createJuice({ camera, canvas });
// in update: const dt = juice.filterDelta(rawDt); … juice.update(rawDt);
// on hit: juice.shake(0.35); juice.hitStop(0.05); juice.flash("#ff5252");
```

## Genre HUD checklist (wire live values)

| Genre | Minimum HUD |
|-------|-------------|
| Kart / race | position, lap, time, speed, item/power, drift/boost bar if TDD mentions drift |
| Platformer / endless vertical | height/score, lives or danger, best record |
| Collector | count / target, timer |
| Arena / wave | wave, HP, score or enemies left |
| Stealth | alert/detection, objective, timer optional |

## World (not empty plane)

- Build a **readable arena** for the fantasy: spline track, column of platforms, room bounds, wave spawn ring.
- SceneKit grid is OK as base — **add** landmarks (props, hazards, checkpoints) that communicate roles.
- NPCs implied by TDD must move/update every frame.
- If the TDD locks palette / fog / post, raise the presentation ceiling (PresentationKit) — still no empty grid alone.

## Fun bar (self-check before stop)

- [ ] Fantasy clear in &lt;3 seconds (silhouette + mood/palette if TDD defines them)?
- [ ] Core verb feels responsive (juice on hit/pickup/boost)?
- [ ] HUD numbers **change** during play?
- [ ] Win **or** lose + restart without F5?
- [ ] At least one toast or result overlay on round end?
- [ ] If TDD lists fog/grain/vignette/VHS/palette — presentation matches?

Do **not** ship: lone cube on infinite grid, static HUD, module-name debug panels.
