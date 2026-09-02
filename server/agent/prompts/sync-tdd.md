# Sync TDD (Unity-clean)



Update the canonical TDD so Unity can build from it. The operator pressed **Sync** because they are satisfied with the current playable prototype. Gameplay code is **evidence** of validated feel; the TDD is a **product** document.



## Required workflow



1. **Read every gameplay evidence file** listed below (especially `hud.js`, `config.js`, input/camera usage in `main.js` and mechanic modules).

2. Compare against the current TDD — numbers, bindings, HUD features, win/lose, camera.

3. Write product rules into the TDD so Unity can implement the same behavior without seeing the prototype.



## Allowed write



- Only the active TDD markdown under `docs/tdds/<slug>/` (prefer `TDD.md`; not `TDD.v*.md` snaps)



## What to update



- **§B mechanic blocks** — quantified rules, states, ACs when feel/numbers/behavior changed

- **§C companion specs** — stay 1:1 with §B; add new YAML blocks when you add mechanics

- **§9.1 UI registry** — when the prototype gained HUD/overlays (minimap, lap timer layout, boost meter, etc.): register `UI_*` ids and wire them to the owning mechanic

- **§11.3 input map** — bindings, axis inversion, dead zones, hold vs tap

- **§11.5 camera / control** — follow offset, FOV, invert-Y, chase rig when changed

- **§4 / §3** — only when core loop or win/lose changed materially



## Operator-approved checklist

If a checklist is attached, **only** apply those items. Do not add extra mechanics, HUD, or input rows the operator left unchecked.

## New features from chat (minimap, inverted steer, new modes)



If the validated digest or gameplay code shows a feature **not yet in the TDD**:



- Add a **§B mechanic** (or extend an existing HUD/movement mechanic) with quantified rules and ≥1 PlayMode AC

- Add matching **§C** spec with the same id

- Register UI in **§9.1** when it is on-screen chrome

- Update **§11.3 / §11.5** when input or camera changed

- Use Unity vocabulary: UI Toolkit, MonoBehaviour, NavMesh, ScriptableObject, `Assets/...`



Do **not** skip a feature because it was “added in chat” — Sync means the operator approved it for production spec.



## Forbidden in the TDD



- Words/phrases: lab, prototype laboratory, Three.js, WebGL, canvas, tabs, sandbox, `public/gameplay`, hot-reload

- Mentions that something was “edited in the lab” or “validated in browser”

- Replacing Unity terms with web jargon

- Inventing lab-only sections



## Versioning



Do not bump document version or invent changelog rows about the lab — the server versions after you finish.

