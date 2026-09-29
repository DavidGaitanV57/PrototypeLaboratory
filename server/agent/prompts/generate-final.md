# Generate Final

Build ONE cohesive **vertical slice** from the entire TDD — a short game that plays well and looks outstanding with primitive geometry.

## Output

1. Write gameplay modules under `public/gameplay/` (ES modules).
2. **Required files:** `look.js` (Look Bible), `config.js` (tuning), `main.js`, `hud.js`, `juice.js` (+ mechanic modules).
3. `main.js` exports `mount(canvas, { hudRoot })` and `unmount()`, and returns `{ sceneKit }`.
4. `mount` must:
   - `createEngine` → `installSceneKit` → **`installLook(engine, LOOK.look)`** (tone mapping, shadows, bloom, grade).
   - Build a dressed world from the Look Bible (landmarks + WorldKit/MaterialKit set dressing).
   - Mount HUD via `hud.js` (HudKit, themed) and the feedback hub via `juice.js` (JuiceKit + FxKit + AudioKit).
   - Implement every §B mechanic the core loop needs, with TDD numbers in `config.js`.
   - Stage the first 10 seconds: intro (`createIntroOrbit` or equivalent) + `hud.titleCard` → control.
   - Stage the ending: win/lose moment (slow-mo, confetti/impact, music sting) → `hud.showResult` → restart (R) without reload.
   - Expose `window.__plab = { state, info, restart }` and honor `window.__PLAB_AUTOPLAY` (simple bot driving the player) so visual QA can capture real play.
5. Do not edit `public/runtime/**`, lab UI, or the TDD during Generate Final.

## Step 1 — Look Bible (`look.js`, before any gameplay code)

Read TDD art/atmosphere (§8), UI (§9) and audio notes, then write:

```js
export const LOOK = {
  look: { preset: "dusk", fog: { density: 0.01 }, bloom: { strength: 0.5 } }, // LookKit preset + overrides
  hudTheme: "arcade",           // or "liminal" | "muted" | "stealth" | { preset, accent: "#hex" }
  palette: { hero: 0xff5a36, world: 0x2e3a48, accent: 0xffd23f /* … every TDD hex */ },
  audio: { music: "arcade", ambience: "wind" },
  intro: { radius: 30, height: 14, endRadius: 10, endHeight: 5, duration: 3 },
  // First 10 seconds storyboard + the one "wow moment" of the slice, as comments.
};
```

Presets: `sunny` (bright arcade), `candy` (pastel toy), `dusk` (golden/purple drama), `night` (moonlit, glows pop), `neon` (synthwave), `liminal` (sickly fluorescent, grain), `noir` (b/w contrast), `underwater` (teal fog, bioluminescence), `studio` (clean showcase).

## Reading order

1. Active TDD under `docs/tdds/<slug>/` — §B `Mechanic:` blocks, §3 core loop, §8 art, §9 UI, §11.3 input, §11.5 camera. Use `read_file` / `read_section`; the prompt only has a digest.
2. Compact contracts + Runtime API index in this prompt. Do **not** open runtime sources.
3. If a starter template was seeded, read its `main.js` and `look.js` first — adapt, do not rewrite from zero.

## Before you stop

- `main.js` exports `mount` / `unmount`; `look.js`, `config.js`, `hud.js`, `juice.js` exist and are wired.
- LookKit installed; world dressed (not an empty plane); hero animated.
- Genre self-check: win/lose reachable, restart works, HUD numbers move, feedback fires on every event, laps finish (races).
- Numbers match the TDD. Prefer a **complete, gorgeous, fun slice** over a minimal loop.
