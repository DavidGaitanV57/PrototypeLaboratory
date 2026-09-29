# AGENTS.md — Prototype Laboratory

Cross-tool instructions for any coding agent or LLM provider working in this repo.

## Product

This is a local web lab that reads a V57 Technical Design Document (TDD) and generates a playable Three.js graybox prototype. Unity (Base V57) consumes the same TDD later. The lab must never pollute the TDD with lab/web jargon.

## Source of truth

- Canonical game design lives in `docs/tdds/<slug>/` — prefer `TDD.md`; if missing, the lab loads the primary `.md` in that folder (version snaps `TDD.v*.md` are ignored).
- Sync may update mechanic rules, numbers, states, acceptance criteria, input, and camera fields in that file.
- Never write: lab, prototype laboratory, Three.js, WebGL, tabs, sandbox paths, or “edited in the lab” into the TDD.
- Keep Unity vocabulary in the TDD (NavMesh, MonoBehaviour, ScriptableObject, `Assets/...`).

## Write boundaries

| Mode | Allowed paths | Forbidden |
|------|---------------|-----------|
| Generate Final / Chat | `public/gameplay/**` | `public/runtime/**`, `public/index.html`, `public/app.js`, `public/styles.css`, `server/**`, `AGENTS.md` |
| Sync TDD | `docs/tdds/<slug>/*.md` (active TDD only; not `TDD.v*.md` snaps) | Any other path; lab meta in TDD content |

## Runtime contract

Gameplay mounts via:

```js
export async function mount(canvas, { hudRoot } = {}) { ... }
export async function unmount() { ... }
```

Entry for a generated build: `public/gameplay/main.js`.

Import runtime helpers from `/runtime/*.js` (Engine, SceneKit, **LookKit**, Input, EventBus, Primitives, CameraRig, **HudKit, JuiceKit, FxKit, AudioKit, MaterialKit, WorldKit, PathKit, MinimapKit**). Do not rewrite the runtime. Three.js addons are importable as `three/addons/...` (bundled on export) when a kit does not cover a need.

The lab injects a **Runtime API index** (signatures + returned surface) into Generate Final and Chat. Trust it: do not read runtime sources, and do not wrap kit calls in feature detection — `read_file` on `public/runtime/**` returns that digest, not the source.

When the TDD names Unity systems (NavMesh, NavMeshAgent, Rigidbody, UI Toolkit), implement web equivalents **only in gameplay code**. Do not rewrite those names in the TDD.

- Prefer returning `{ sceneKit }` from `mount` when you call `installSceneKit`, so lab chrome can toggle day/night. The runtime also registers the active kit automatically.
- Keep game HUD away from the **bottom-right** corner — lab chrome (day/night, chat, sync) lives there.

## Playable quality bar (reference-grade mechanics, primitive geometry, production presentation)

Generated prototypes must feel like **playable vertical slices** — short games that are fun for 1–2 minutes and look like a stylized indie game. Shapes are **primitives or compositions of primitives** (boxes, rounded boxes, capsules, cylinders, spheres, cones); everything else ships at production quality through the kits. No remote textures, glTF or image URLs.

Required:

1. **`look.js` Look Bible written first** (LookKit preset + overrides, palette, HUD theme, music/ambience, intro, wow moment) and **`installLook(engine, LOOK.look)`** on every build.
2. Readable fantasy in under 3 seconds (animated hero/vehicle silhouettes, mood, palette) in a **dressed world** (landmarks + WorldKit/MaterialKit set dressing).
3. Full loop: staged intro (camera + title) → core verb → win/lose moment → result → restart without a full page reload.
4. **`config.js`** with every quantified TDD number; explicit controls; delta-time movement.
5. **`hud.js`** with **HudKit** — live HUD state, title card, result overlay; themed from the Look Bible — never module-title panels.
6. **`juice.js`** feedback hub — **JuiceKit + FxKit + AudioKit** behind semantic events; every meaningful event gets sight + sound + motion.
7. NPCs/props when the TDD implies them — distinct, animated meshes updated every frame.
8. `window.__plab = { state, info, restart }` + `window.__PLAB_AUTOPLAY` bot so visual QA can capture real play.

Generate Final may seed a **genre starter template** (kart, platformer, firstperson, arena) into an empty `public/gameplay/`. Adapt it to the TDD (look, numbers, fiction, mechanics) — never ship it renamed but unchanged.

Fail examples: lone cube on empty plane; unlit default renderer; silent game; mechanics with no win/lose; HUD listing file names.

## Soft playability advice + visual QA (never block delivery)

After Generate Final / Chat, the lab may emit **hints** (e.g. kart laps not incrementing) and, when enabled, a **visual QA report** (headless screenshots scored by a vision model against a presentation rubric). Both are advisory — the playable still opens. Fix via Chat (or the optional auto-polish pass); do not fail the build over heuristics.

## Commands

- `npm start` — lab on port 3850 (or `PORT`)
- `npm run smoke` — structural smoke checks
- `npm run seed` — ensure sample TDD exists

## Agents / API keys

Generate Final, Chat, and Sync **require** a configured provider (`CURSOR_API_KEY` and/or `LLM_API_KEY` / named `*_API_KEY`). There is no local deterministic agent. Select provider + model on the Start screen (`auto` is valid for Cursor).

## Clean project

Cleaning removes generated gameplay and sessions only. Never delete `docs/tdds/`, `public/runtime/`, or lab UI.
