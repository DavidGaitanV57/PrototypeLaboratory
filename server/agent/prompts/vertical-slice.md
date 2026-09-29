# Vertical slice presentation (all genres)

You are building a **playable vertical slice** — fun in the first minute and good-looking enough to show. Primitive geometry, production presentation.

## Required modules (every Generate Final)

| Module | Purpose |
|--------|---------|
| `public/gameplay/look.js` | **Look Bible** — LookKit preset/overrides, palette, HUD theme, audio, intro, wow moment |
| `public/gameplay/config.js` | Tuning (TDD numbers), META title/subtitle |
| `public/gameplay/main.js` | `mount` / `unmount`, state machine, loop |
| `public/gameplay/hud.js` | **All DOM HUD** — `/runtime/HudKit.js` (panels, titleCard, countdown, result) |
| `public/gameplay/juice.js` | Feedback hub — JuiceKit + FxKit + AudioKit behind semantic events |

Kits: `LookKit` (look), `WorldKit` (set dressing), `MaterialKit` (materials/textures/outlines), `Primitives` (heroes, vehicles, props), `CameraRig` (chase / third-person / intro orbit), `PathKit`, `MinimapKit`.

## HudKit quick start

```js
import { createHud } from "/runtime/HudKit.js";
export function mountHud(hudRoot, { LOOK, onPlayAgain }) {
  const hud = createHud(hudRoot, { theme: LOOK.hudTheme });
  const pos = hud.panel("top-left").stat("rank", "POS", { large: true });
  const speed = hud.panel("bottom-left", { minWidth: "200px" });
  speed.stat("spd", "KM/H", { large: true });
  speed.bar("boost", "BOOST");
  hud.controlsHint("<b>WASD</b> steer · <b>SPACE</b> drift · <b>R</b> restart");
  hud.titleCard("TURBO LOOP", "3 laps");           // intro
  hud.countdown(3, { onGo: () => startRace() });   // races / rounds
  return hud;                                        // hud.showResult(title, lines, { onPlayAgain })
}
```

Keep panels off **bottom-right** (lab chrome). Update stats every frame from game state.

## Feedback hub quick start

```js
import { createJuice } from "/runtime/JuiceKit.js";
import { createFx } from "/runtime/FxKit.js";
import { createAudio } from "/runtime/AudioKit.js";
const juice = createJuice({ camera, canvas, look });   // look = installLook(...) → grade pulses
const fx = createFx(scene, { camera });
const audio = createAudio(); audio.music("arcade"); audio.ambience("wind");
// pickup: fx.pickup(pos, color); audio.sfx("coin"); juice.floatText(pos, "+1");
// hit:    fx.sparks(pos); audio.sfx("hit"); juice.impact("medium");
// win:    fx.confetti(pos); audio.sfx("win"); juice.impact("win");
// frame:  const dt = juice.filterDelta(raw); … fx.update(dt); juice.update(raw);
```

## Genre HUD checklist (wire live values)

| Genre | Minimum HUD |
|-------|-------------|
| Kart / race | position, lap, time, speed, item, drift/boost bar, minimap |
| Platformer / endless vertical | height/score, lives, collectibles, best record |
| Collector | count / target, timer |
| Arena / wave | wave, HP, score, combo, enemies left |
| Stealth / horror | awareness, objective, stamina/battery |

## World (never an empty plane)

- Readable arena for the fantasy: spline track, platform column, rooms, wave ring.
- Landmarks that communicate roles (arches, beacons, doors, portals) + set dressing (WorldKit scatter, backdrop, clouds, water, grass).
- NPCs implied by TDD move/animate every frame (bob, eyes, limbs).
- Emissive/glow accents on interactables so bloom guides the eye.

## Fun + wow bar (self-check before stop)

- [ ] Fantasy clear in < 3 s (silhouette + mood + palette)?
- [ ] Intro (camera move + title) and ending (moment + result) staged?
- [ ] Every event has sight + sound + motion?
- [ ] HUD numbers change during play; theme matches mood?
- [ ] Win **or** lose + restart without F5?
- [ ] One "wow moment" from look.js actually happens in play?

Do **not** ship: lone cube on an empty grid, unlit default renderer, static HUD, silent game, module-name debug panels.
