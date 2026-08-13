# Generate Final

Build ONE cohesive final playable prototype from the entire TDD.

## Output

1. Write gameplay modules under `public/gameplay/` (ES modules).
2. Write `public/gameplay/main.js` that exports `mount(canvas, { hudRoot })` and `unmount()`.
3. `mount` must:
   - Use `/runtime/Engine.js` to create renderer/scene/camera/loop OR use the provided canvas with Engine helpers.
   - Call SceneKit for sky + grid + graybox ground.
   - Implement every production mechanic from §B that is required for the core loop.
   - Satisfy the playable quality bar (see playable-quality.md) and genre-loop contracts.
4. Do not edit `public/runtime/**`, lab UI, or the TDD during Generate Final.
5. Prefer a single cohesive session: one fantasy, one HUD owner, restartable loop.

## Reading order

1. `docs/tdds/<slug>/TDD.md` — especially §B `## Mechanic:` blocks, §3 core loop, §11.3 input, §11.5 camera/control.
2. `AGENTS.md`, playable quality, and genre-loop contracts (including the inferred loop brief).
3. Runtime APIs under `public/runtime/`.

## First actions

1. **Write `public/gameplay/main.js` first** with working `mount` / `unmount` (even a thin stub that imports modules), then fill mechanic modules.
2. Write the remaining gameplay files under `public/gameplay/`.
3. Do not spend many turns only exploring — start writing immediately. Literals (speeds, counts, timers) must match the TDD when quantified.

## Before you stop

Confirm `public/gameplay/main.js` exists and exports `mount` / `unmount`. Run the genre self-check (laps finish for races, win/lose reachable, restart works). Prefer a complete graybox loop over fancy presentation. Keep going until the playable entry works — do not stop mid-task because of exploration.
