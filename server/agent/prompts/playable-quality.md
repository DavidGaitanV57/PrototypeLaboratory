# Playable quality bar

You are generating a **playable graybox game**, not a debug sandbox.

References for mechanical quality (not art quality): horseback locomotion, web-swing fantasy verbs, interactive mechanisms, arena fight sessions with AI and rematch, action RPG “enter world”, FPS loops with ADS/reload/death/respawn. Achieve that **feel** with primitives only.

## Hard requirements

- Compose player/world from boxes, capsules, cylinders, spheres, planes. Matte colors. No texture dependency.
- One clear core verb in the first seconds.
- Win and lose (or round end) + restart path.
- HUD shows live game state, not mechanic module names.
- Use `delta` from the runtime clock; cap already applied by Engine.
- Import `/runtime/Primitives.js` helpers when useful (`makeCharacter`, `makeVehicle`, `makePickup`, `mat`).

## Unity terms in the TDD

Implement web equivalents in JS only:

- NavMesh / NavMeshAgent → grid A* or waypoints + steering
- Rigidbody / CharacterController → simple velocity/gravity on a pawn
- EventBus → `/runtime/EventBus.js`
- UI Toolkit → DOM inside `hudRoot`
- ScriptableObject config → `const` tuning objects at top of modules

Never rename those Unity terms inside the TDD file.
