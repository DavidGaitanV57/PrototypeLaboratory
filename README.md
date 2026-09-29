# Prototype Laboratory

Local web lab that turns a **V57 TDD** into a **playable Three.js graybox**, then syncs validated feel back into the TDD for Unity.

## Quick start

```bash
npm install
npm run seed
npm start
```

Open http://127.0.0.1:3850

1. Select a TDD under `docs/tdds/`
2. Choose **provider** + **model** (API key required in `.env`)
3. Press **Generate Final**
4. Play, Chat, **Sync TDD**, or **Clean project**

## Providers

| Id | Needs |
|----|--------|
| `cursor` | `CURSOR_API_KEY` — model selectable (`auto`, `composer-2.5`, `grok-4.6`, …) |
| `minimax` / `llm` | `LLM_API_KEY` + `LLM_BASE_URL` / `LLM_MODEL` (or `MINIMAX_*`) |
| `openai`, `kimi`, … | Matching `*_API_KEY` |

**There is no local/offline agent.** At least one API key must be in `.env`.

Copy `.env` from `tdd-prototype-lab` or fill `.env.example`. On the Start screen, pick **provider** and **model** (Cursor supports `auto`).

## Presentation kits (primitive geometry, production look)

| Kit | What it gives the playable |
|-----|-----------------------------|
| `LookKit` | `installLook(engine, { preset })` — tone mapping, soft shadows, image-based light, bloom, color grade, vignette, grain, auto quality. Presets: `sunny` `candy` `dusk` `night` `neon` `liminal` `noir` `underwater` `studio`. `?quality=low|medium|high` forces a tier. |
| `WorldKit` | Trees, rocks, bushes, clouds, backdrop mountains, animated water, wind grass, seeded scatter |
| `MaterialKit` | Stylized / toon / glow / metal materials, procedural textures, cartoon outlines |
| `Primitives` | Rounded boxes, `makeHero` + `animateCharacter` (eyes, walk, squash), vehicles, coins, crates, flags, arches |
| `FxKit` | Pooled particles (sparks, dust, confetti, smoke, explosions), shockwave rings, ribbon trails, speed lines |
| `JuiceKit` | Trauma shake, FOV kick, hit-stop, slow-mo, squash, dt tweens, floating text, `impact()` presets |
| `AudioKit` | Procedural SFX presets, engine loop, ambience beds, generative music with intensity, ducking |
| `CameraRig` | Follow, FPS, chase (speed FOV), third-person orbit, cinematic intro orbit |
| `HudKit` | Themed panels + `titleCard`, `countdown`, `showResult` |

Every generated game starts with a **Look Bible** (`public/gameplay/look.js`) and a feedback hub (`juice.js`).

## Genre starters

Generate Final on an empty `public/gameplay/` seeds the closest starter from `server/agent/templates/` (`kart`, `platformer`, `firstperson`, `arena`) and tells the agent to adapt it to the TDD. **Clean project** before Generate to use a starter; `LAB_TEMPLATES=off` disables seeding.

## Visual QA

The lab can look at its own playable: headless Edge/Chrome captures 4 beats (intro → late play), a vision model scores them against a presentation rubric, and returns file-targeted fixes.

- Play menu → **Visual QA** (report + screenshots in chat) or **Auto-polish** (QA → agent applies fixes → QA again, up to 2 rounds).
- CLI against a running lab: `npm run qa -- --slug <TDD slug>` (report in `sessions/qa/<stamp>/`).

| Env | Default | Meaning |
|-----|---------|---------|
| `LAB_VISUAL_QA` | off | `on` = run QA automatically after Generate Final |
| `LAB_QA_AUTOFIX` | 0 | auto-polish rounds after automatic QA (max 3) |
| `LAB_QA_MIN_SCORE` | 7 | auto-polish stops at this score |
| `LAB_QA_PROVIDER` / `LAB_QA_MODEL` | first OpenAI-compatible slot | vision judge (Cursor SDK cannot view images) |
| `LAB_QA_BROWSER` | Edge → Chrome | path to a Chromium browser executable |
| `LAB_QA_HEADFUL` | off | `on` = visible window (use when headless has no GPU) |

Needs `playwright-core` (optional dependency, installed by `npm install`; no browser download).

## Layout

- `docs/tdds/<slug>/` — product TDD (`TDD.md` preferred; otherwise the primary `.md` in the folder)
- `public/runtime/` — frozen Three.js runtime (engine, look, world, materials, fx, audio, HUD, cameras, input)
- `server/agent/templates/` — genre starter playables
- `server/agent/visualQa.js` + `public/qa.html` — headless capture + vision scoring
- `public/gameplay/` — generated playable (wiped by Clean)
- `AGENTS.md` + `server/agent/prompts/` — LLM-agnostic agent rules
- `PRODUCT.md` / `DESIGN.md` — Impeccable Operate UI context

## Scripts

- `npm run smoke` — write policy, TDD parse, provider key requirements
- `npm run seed` — ensure sample TDD exists
