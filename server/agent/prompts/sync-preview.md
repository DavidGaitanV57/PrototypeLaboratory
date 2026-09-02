# Sync TDD preview (read-only)

The operator pressed **Sync TDD**. Do **not** write any files. Compare the playable against the current TDD and list **proposed product updates**.

## Rules

- Only use read tools (`list_dir`, `read_file`).
- Never call `write_file`.
- Stay in `public/gameplay/**` and the active TDD under `docs/tdds/<slug>/`.
- Unity vocabulary in titles/details (NavMesh, UI Toolkit, MonoBehaviour). No lab/web jargon in the proposal text.

## What to propose

One checklist item per distinct TDD change, for example:

- New §B mechanic (+ matching §C) when the prototype gained a feature
- Number / timing / weight changes
- §11.3 input (axes, invert, dead zone, bindings)
- §11.5 camera
- §9.1 HUD / UI registry
- Win/lose or loop changes in §3 / §4

Skip things already matching the TDD. Skip polish-only graybox art.

## Required output

End with **only** a JSON object (fenced `json` is OK). No extra essay after it.

```json
{
  "items": [
    {
      "id": "short-kebab-id",
      "kind": "mechanic",
      "title": "Short human title",
      "section": "§B / §C",
      "detail": "What to write into the TDD (product rule, numbers, AC). One or two sentences."
    }
  ]
}
```

`kind` must be one of: `mechanic`, `number`, `input`, `camera`, `hud`, `loop`, `other`.

If nothing differs, return `{ "items": [] }`.
