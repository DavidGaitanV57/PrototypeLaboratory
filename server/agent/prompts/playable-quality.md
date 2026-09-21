# Playable quality bar

You are generating a **playable vertical slice** — a short graybox game that feels fun to play for 1–2 minutes, not a debug sandbox.

References for mechanical quality: horseback locomotion, web-swing fantasy verbs, interactive mechanisms, arena fight sessions with AI and rematch, action RPG “enter world”, FPS loops with ADS/reload/death/respawn. Achieve that **feel** with primitives; raise **look** when the TDD defines art/atmosphere (see presentation ceiling).

## Hard requirements

- Compose player/world from boxes, capsules, cylinders, spheres, planes. Matte / simple materials by default.
- One clear core verb in the first seconds.
- Win and lose (or round end) + restart path.
- **Dedicated `hud.js`** using `/runtime/HudKit.js` — live game state on screen, not mechanic module names. Theme from TDD mood (`arcade` default; quieter presets when horror/liminal/minimal UI).
- **`juice.js`** using `/runtime/JuiceKit.js` — at least shake, flash, or hit-stop on meaningful events.
- Use `delta` from the runtime clock; cap already applied by Engine.
- Import `/runtime/Primitives.js` helpers when useful (`makeCharacter`, `makeVehicle`, `makePickup`, `mat`).
- Import `/runtime/PathKit.js` or `/runtime/MinimapKit.js` when the TDD implies tracks, laps, patrol paths, or minimap.
- Import `/runtime/PresentationKit.js` when the TDD implies fog, grain, vignette, VHS, color grade, locked palette, or strong art direction.

## Visual ceiling (TDD-driven)

| TDD | Look |
|-----|------|
| Mechanics-only | Minimum graybox |
| Palette / Atmosphere / fog / post / landmarks | Match the contract — PresentationKit + lights + composed world |

No remote texture URLs or glTF required for the core loop. Procedural canvas textures and CSS overlays are OK when the TDD locks presentation.

## Unity terms in the TDD

Implement web equivalents in JS only:

- NavMesh / NavMeshAgent → grid A* or waypoints + steering (`PathKit` splines optional)
- Rigidbody / CharacterController → simple velocity/gravity on a pawn
- EventBus → `/runtime/EventBus.js`
- UI Toolkit → DOM inside `hudRoot` via **HudKit**
- URP Volume / post → **PresentationKit** fog + overlays
- ScriptableObject config → `const` tuning objects at top of modules

Never rename those Unity terms inside the TDD file.
