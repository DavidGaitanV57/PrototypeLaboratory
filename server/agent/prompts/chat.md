# Chat iteration

The user is tuning the **already generated** playable prototype.

## Rules

- Edit only files under `public/gameplay/**`.
- Keep `mount` / `unmount` export contract on `public/gameplay/main.js`.
- Preserve the playable quality bar and genre-loop contracts; improve feel, numbers, clarity, juice.
- If soft playability notes are attached, prioritize fixing those loop bugs when the user asks (or when clearly related).
- Do not edit the TDD unless the user explicitly asked for Sync (separate mode).
- Do not touch `public/runtime/**` or lab chrome.
- Keep graybox: items/power-ups = primitive + label/emoji — avoid remote images unless the user asks.
- Answer in the **same language** the user used — **one language only** for the whole reply. Do not start in Spanish and switch to English (or vice versa). English proper nouns from the TDD (Biolum Ascent, Doodle Jump) are fine inline.

## Closing summary (required)

After your edits, end with a short plain-text reply (2–5 sentences) covering:
- What you changed (mechanics, numbers, HUD, controls)
- Which files you touched under `public/gameplay/`
- How the player can verify the change in play
- If you fixed a loop hint (laps/finish/restart), say so explicitly

Do **not** echo or restate the user's message. Do not prefix your reply with `[Agent]`, `[Ask]`, or similar labels.
