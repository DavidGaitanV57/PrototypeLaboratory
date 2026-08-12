# Design system — Prototype Laboratory

## Palette

| Token | Value | Use |
|-------|-------|-----|
| `--ink` | `#0e1218` | Primary text |
| `--paper` | `#e8ecf1` | Light surfaces |
| `--panel` | `#141a22` | Chrome panels |
| `--panel-2` | `#1c2430` | Elevated chrome |
| `--line` | `#2a3544` | Borders |
| `--mute` | `#8b97a8` | Secondary text |
| `--accent` | `#3d9b8f` | Primary action (teal, not purple) |
| `--accent-2` | `#d4a24e` | Secondary highlight |
| `--danger` | `#c45c5c` | Destructive |
| `--sky-day` | `#87b8e0` | Viewport day |
| `--sky-night` | `#1b2a48` | Viewport night |

## Typography

- Display / brand: **"Syne"** (Google Fonts) — geometric, purposeful.
- Body / UI: **"IBM Plex Sans"** — readable at dense Operate densities.
- Mono (bindings, logs): **"IBM Plex Mono"**.

Do not use Inter, Roboto, Arial, or system-ui as the primary stack.

## Radii & elevation

- Radius scale: `2px`, `4px`, `8px` — prefer sharp/small, not pill.
- Elevation: single soft shadow or flat border; no multi-layer glow.

## Components

- Primary button: filled `--accent`, ink on hover lighten.
- Ghost button: transparent + `--line` border.
- Icon buttons (day/night): 40×40, border `--line`, no rounded-full.
- Chat drawer: right rail over viewport, dense messages.
- No cards in the start hero; workbench lists only.

## Motion

- Screen crossfade 180–220ms ease-out.
- Day/night sky lerp ~400ms.
- Chat message appear 120ms fade.

## Rules

- Operate density: visible actions without ornament.
- Viewport owns Play; chrome never covers the whole scene.
- Prefer CSS variables over hard-coded literals in new UI.
