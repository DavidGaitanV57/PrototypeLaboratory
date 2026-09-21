# Presentation ceiling (TDD-driven)

Graybox **meshes** stay primitives (boxes, capsules, cylinders, spheres, planes).  
**Look** may rise when the TDD asks for it — atmosphere, palette, fog, post, landmarks, race silhouettes.

## Layers (always apply in order)

1. **Loop** — start → verb → win/lose → restart  
2. **HUD + juice** — HudKit + JuiceKit  
3. **Presentation** — only as far as the TDD specifies (or strongly implies)

| TDD signal | Raise the ceiling |
|------------|-------------------|
| Art direction / master palette / hex colors | Match colors on mats + lights; **also theme HudKit** via preset or `themeFromPalette`; procedural canvas textures OK if TDD locks albedo |
| Atmosphere / fog / grain / vignette / VHS / color grade / Volume | Use `/runtime/PresentationKit.js` |
| Fluorescent / Kelvin / shadow strength | Lights + weak shadows; flat “overlit” or genre mood |
| Track / curb / landmarks / set-pieces | World composition (rails, stripes, props) — still primitives |
| UI almost invisible / minimal / diegetic / horror HUD | HudKit `theme: "liminal"` or `"muted"` — keep same panels, quieter chrome |
| Kart / party / bright arcade | HudKit default `arcade` / `party` |
| No art/atmosphere section | Stay minimum graybox (matte primitives + SceneKit); HudKit `arcade` OK |

## PresentationKit quick start

```js
import { createPresentation } from "/runtime/PresentationKit.js";

const look = createPresentation({ canvas });
// Horror / liminal example (numbers from TDD when present):
look.applyFog(scene, { near: 8, far: 42, color: 0xc4b87a });
look.setWash("#C9B45A", 0.08);
look.setGrain(0.18);
look.setVignette(0.35);
look.setVhs(false); // true if TDD enables VHS on harder difficulties

// Race accent example:
look.addCurbStripes(trackGroup, splinePoints, { colorA: 0xffffff, colorB: 0xe53935 });
const trail = look.createTrail({ color: 0x4fc3f7 });
scene.add(trail.mesh);
// each frame: look.update(dt); trail.push(kart.position);

// in unmount: look.dispose(); trail.dispose();
```

Keep overlays off **bottom-right** lab chrome. Do not block pointer events (kit uses `pointer-events: none`).

## Hud theme (same usability, TDD skin)

Layout and controls stay HudKit defaults. Only colors / border weight / opacity change.

```js
import { createHud, themeFromPalette } from "/runtime/HudKit.js";

// Party / Mario Kart-style: leave default or theme: "arcade"
const hud = createHud(hudRoot, { theme: "arcade" });

// Threshold Rooms / liminal horror (TDD: quiet HUD, mono-yellow palette):
const hud = createHud(hudRoot, {
  theme: themeFromPalette({ accent: "#C9B45A", preset: "liminal" }),
});
// Optional later: hud.setTheme("muted");
```

| TDD cue | HudKit theme |
|---------|----------------|
| Kart, party, bright arcade | `arcade` / `party` (default) |
| Liminal, backrooms, horror, “HUD almost invisible” | `liminal` + palette accent hex |
| Quiet / desaturated / concrete fog | `muted` |
| Stealth / infiltration | `stealth` |

## Rules

- Prefer **TDD numbers** (fog end, grain intensity, hex) when quantified.
- Do **not** invent remote image URLs, glTF, or PBR texture packs for the core loop.
- Procedural `CanvasTexture` / CSS overlays / fog are allowed when the TDD’s presentation contract needs them.
- Entities and juicier FX must not outshine architecture when the TDD says atmosphere is primary.
- Kart / arena / collector: landmarks + readable silhouettes + optional trails/stripes — still no empty grid alone.

## Self-check

- [ ] Fantasy readable in &lt;3s (silhouette + palette/mood)?  
- [ ] If TDD lists fog/grain/vignette/VHS — are they present (via PresentationKit or equivalent)?  
- [ ] If TDD lists palette hex — do major surfaces match (± tolerance)?  
- [ ] If TDD implies quiet/horror HUD — is HudKit themed (`liminal`/`muted`), not loud arcade pink/gold?  
- [ ] Loop/HUD/juice still pass if presentation were stripped?
