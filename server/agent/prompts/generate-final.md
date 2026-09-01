# Generate Final

Build ONE cohesive **vertical slice** playable prototype from the entire TDD.

## Output

1. Write gameplay modules under `public/gameplay/` (ES modules).
2. **Required files:** `main.js`, `hud.js`, `juice.js` (+ mechanic modules as needed).
3. Write `public/gameplay/main.js` that exports `mount(canvas, { hudRoot })` and `unmount()`.
4. `mount` must:
   - Use `/runtime/Engine.js` to create renderer/scene/camera/loop.
   - Call SceneKit for sky + ground **and** add genre-appropriate landmarks (track, platforms, arena ring, etc.).
   - Mount HUD via `hud.js` → `/runtime/HudKit.js` into `hudRoot`.
   - Wire `/runtime/JuiceKit.js` from `juice.js` (shake/flash on hits, boosts, lap, win/lose).
   - Implement every production mechanic from §B required for the core loop.
   - Satisfy playable quality, vertical-slice, and genre-loop contracts.
5. Do not edit `public/runtime/**`, lab UI, or the TDD during Generate Final.
6. Prefer a single cohesive session: one fantasy, one HUD owner, restartable loop.

## Reading order

1. `docs/tdds/<slug>/TDD.md` — especially §B `## Mechanic:` blocks, §3 core loop, §11.3 input, §11.5 camera/control.
2. `AGENTS.md`, playable quality, vertical-slice, and genre-loop contracts (including the inferred loop brief).
3. Runtime APIs under `public/runtime/` — **HudKit, JuiceKit, PathKit, MinimapKit**, Engine, SceneKit, Primitives, Input, CameraRig.

## First actions

1. **Write `public/gameplay/main.js` first** with working `mount` / `unmount` (stub OK), plus `hud.js` and `juice.js` shells.
2. Fill mechanic modules and wire HUD live updates every frame.
3. Do not spend many turns only exploring — start writing immediately. Literals (speeds, counts, timers) must match the TDD when quantified.

## Before you stop

Confirm `public/gameplay/main.js` exists and exports `mount` / `unmount`.  
Confirm `hud.js` uses HudKit and `juice.js` uses JuiceKit.  
Run the genre self-check (laps finish for races, win/lose reachable, restart works, HUD moves).  
Prefer a **complete fun slice** over a minimal loop. Keep going until the playable entry works.
