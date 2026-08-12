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
| `cursor` | `CURSOR_API_KEY` — model selectable (`auto`, `composer-2.5`, …) |
| `minimax` / `llm` | `LLM_API_KEY` + `LLM_BASE_URL` / `LLM_MODEL` (or `MINIMAX_*`) |
| `openai`, `kimi`, … | Matching `*_API_KEY` |

**There is no local/offline agent.** At least one API key must be in `.env`.

Copy `.env` from `tdd-prototype-lab` or fill `.env.example`. On the Start screen, pick **provider** and **model** (Cursor supports `auto`).

## Layout

- `docs/tdds/<slug>/TDD.md` — only product source of truth
- `public/runtime/` — frozen Three.js runtime (sky/grid/graybox, input, primitives)
- `public/gameplay/` — generated playable (wiped by Clean)
- `AGENTS.md` + `server/agent/prompts/` — LLM-agnostic agent rules
- `PRODUCT.md` / `DESIGN.md` — Impeccable Operate UI context

## Scripts

- `npm run smoke` — write policy, TDD parse, provider key requirements
- `npm run seed` — ensure sample TDD exists
