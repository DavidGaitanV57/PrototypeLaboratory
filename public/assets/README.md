# Asset library

Used by **Generate Prototype with Assets**. Served at `/assets/<path>`. Full spec: `ASSETS.md` (repo root).

- **Models** — `.glb` / `.gltf`, any number, subfolders allowed. Each top-level object is listed by name and can be placed on its own.
- **Material sets** — tiling PBR textures for floors, walls, ceilings, ground: one folder per set, files named `<base>_<map>.png` (`_color`, `_normal`, `_rough`, …), optional `material.json` with real-world `tileSize` and `surfaces`.
- `preview/` folders are ignored. `library.json` here is reserved (the lab generates it).
- The lab reads only glTF JSON and folder listings to build the manifest; generated gameplay loads everything through `/runtime/AssetKit.js` and never writes here.
- Binaries are git-ignored — keep them in your own storage.
