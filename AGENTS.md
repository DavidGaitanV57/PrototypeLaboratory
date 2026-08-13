# AGENTS.md — Prototype Laboratory

Cross-tool instructions for any coding agent or LLM provider working in this repo.

## Product

This is a local web lab that reads a V57 Technical Design Document (TDD) and generates a playable Three.js graybox prototype. Unity (Base V57) consumes the same TDD later. The lab must never pollute the TDD with lab/web jargon.

## Source of truth

- Canonical game design lives only in `docs/tdds/<slug>/TDD.md`.
- Sync may update mechanic rules, numbers, states, acceptance criteria, input, and camera fields in that file.
- Never write: lab, prototype laboratory, Three.js, WebGL, tabs, sandbox paths, or “edited in the lab” into the TDD.
- Keep Unity vocabulary in the TDD (NavMesh, MonoBehaviour, ScriptableObject, `Assets/...`).

## Write boundaries

| Mode | Allowed paths | Forbidden |
|------|---------------|-----------|
| Generate Final / Chat | `public/gameplay/**` | `public/runtime/**`, `public/index.html`, `public/app.js`, `public/styles.css`, `server/**`, `AGENTS.md` |
| Sync TDD | `docs/tdds/<slug>/TDD.md` only | Any other path; lab meta in TDD content |

## Runtime contract

Gameplay mounts via:

```js
export async function mount(canvas, { hudRoot } = {}) { ... }
export async function unmount() { ... }
```

Entry for a generated build: `public/gameplay/main.js`.

Import runtime helpers from `/runtime/*.js` (Engine, SceneKit, Input, EventBus, Primitives, CameraRig). Do not rewrite the runtime.

When the TDD names Unity systems (NavMesh, NavMeshAgent, Rigidbody, UI Toolkit), implement web equivalents **only in gameplay code**. Do not rewrite those names in the TDD.

- Prefer returning `{ sceneKit }` from `mount` when you call `installSceneKit`, so lab chrome can toggle day/night. The runtime also registers the active kit automatically.
- Keep game HUD away from the **bottom-right** corner — lab chrome (day/night, chat, sync) lives there.

## Playable quality bar (reference-grade mechanics, graybox art)

Generated prototypes must feel like complete short games using **primitives or compositions of primitives** (boxes, capsules, cylinders, spheres, planes). No textures/PBR/glTF required.

Required:

1. Readable fantasy in under 3 seconds (player + world silhouettes with role).
2. Full loop: start → core verb → win/lose or round → restart without a full page reload.
3. Explicit controls (HUD or binding overlay) and delta-time movement.
4. Live HUD state (score, timer, ammo, mode, etc. as the TDD implies) — never module-title panels.
5. NPCs/props when the TDD implies them — distinct meshes, updated every frame.
6. Genre-appropriate camera.
7. Light juice: hit-stop, shake, or color flash on matte materials.

Fail examples: lone blue cube on empty plane; mechanics with no win/lose; HUD listing file names.

## Soft playability advice (never blocks delivery)

After Generate Final / Chat, the lab may emit **hints** (e.g. kart laps not incrementing). Hints are advisory only — the playable still opens. Fix via Chat; do not fail the build over heuristics.

## Commands

- `npm start` — lab on port 3850 (or `PORT`)
- `npm run smoke` — structural smoke checks
- `npm run seed` — ensure sample TDD exists

## Agents / API keys

Generate Final, Chat, and Sync **require** a configured provider (`CURSOR_API_KEY` and/or `LLM_API_KEY` / named `*_API_KEY`). There is no local deterministic agent. Select provider + model on the Start screen (`auto` is valid for Cursor).

## Clean project

Cleaning removes generated gameplay and sessions only. Never delete `docs/tdds/`, `public/runtime/`, or lab UI.
