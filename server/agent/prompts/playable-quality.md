# Playable quality bar

You are generating a **playable vertical slice** — a short game that is fun for 1–2 minutes and looks like a *stylized indie game*, not a debug sandbox.

**Geometry is primitive; presentation is production.** Shapes come from boxes, rounded boxes, capsules, cylinders, spheres, cones and compositions of them. Everything else — lighting, materials, post, particles, sound, camera, UI — is shipped at production quality through the runtime kits.

References for mechanical quality: horseback locomotion, web-swing fantasy verbs, interactive mechanisms, arena fights with AI and rematch, action-RPG "enter world", FPS loops with ADS/reload/death/respawn.

## Hard requirements

- **`look.js` Look Bible first** — preset, palette, HUD theme, music/ambience, intro, wow moment (see generate-final).
- **LookKit on every build**: `installLook(engine, LOOK.look)` right after SceneKit. Never ship the unlit default renderer.
- One clear core verb in the first seconds; readable fantasy in < 3 s (silhouette + palette + mood).
- Win and lose (or round end) + restart without page reload.
- **`hud.js`** with HudKit — live state, `titleCard` intro, `showResult` outro. Theme from the Look Bible.
- **`juice.js`** = the feedback hub: JuiceKit (shake/kick/hit-stop/slow-mo/floatText/impact) + FxKit (particles, rings, trails) + AudioKit (sfx, music, ambience). Gameplay calls semantic events (`fb.pickup(pos)`), never raw effects.
- Every meaningful event has **sight + sound + motion**: e.g. pickup = burst + coin sfx + float text; hit = sparks + hit sfx + shake/hit-stop.
- Use `delta` from the runtime clock; `juice.filterDelta(dt)` for simulation.
- Characters: `makeHero` + `animateCharacter` (eyes, walk cycle, squash). Vehicles: `makeVehicle` + `animateVehicle`. Never a lone static capsule.
- World: landmarks + set dressing (WorldKit trees/rocks/backdrop/clouds/water/grass, MaterialKit procedural textures). Never an empty plane.

## Visual ceiling (TDD-driven)

| TDD gives | You deliver |
|-----|------|
| Mechanics only | Pick the mood that fits the fantasy (LookKit preset), invent a 5-color palette, dress the world |
| Palette / mood / art refs | Match them exactly: preset + overrides, palette in look.js, materials, lights, fog, HUD theme |

Allowed: procedural canvas textures (MaterialKit), toon materials + outlines, glow/HDR emissives for bloom, instanced scatter, Three.js addons via `three/addons/...` when truly needed.
Avoid: remote images, glTF downloads, PBR texture packs, external fonts.

## Unity terms in the TDD

Implement web equivalents in JS only:

- NavMesh / NavMeshAgent → grid A*/BFS or waypoints + steering (`PathKit` splines optional)
- Rigidbody / CharacterController → velocity/gravity on a pawn
- EventBus → `/runtime/EventBus.js`
- UI Toolkit → DOM inside `hudRoot` via **HudKit**
- ScriptableObject config → `config.js` tuning objects
- URP Volume (bloom, tonemapping, color adjustments, vignette) → LookKit preset/overrides in `look.js`

Never rename those Unity terms inside the TDD file.
