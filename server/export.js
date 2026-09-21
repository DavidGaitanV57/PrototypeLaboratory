/**
 * Export a portable playable — double-click index.html, no Node server.
 *
 * The lab itself stays modular (public/gameplay + public/runtime). Export
 * bundles that graph (plus Three.js) into a single classic play.js so browsers
 * accept file:// opens.
 *
 * Destination defaults to `<ROOT>/exports/<slug>-<timestamp>`. Contents:
 *   - index.html + play.css + play.js (self-contained)
 *   - tdd/ (optional TDD copies)
 *   - README.md + EXPORT.json
 */

import fs from "node:fs/promises";
import path from "node:path";
import * as esbuild from "esbuild";
import {
  assertSafeSlug,
  isInsideDir,
  resolveExportDestination,
} from "./security/paths.js";

async function safeCopyFile(src, dst) {
  try {
    await fs.access(src);
  } catch {
    return false;
  }
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
  return true;
}

async function countFiles(dir) {
  let n = 0;
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) n += await countFiles(p);
    else if (ent.isFile()) n += 1;
  }
  return n;
}

function sanitizeSlug(s) {
  return String(s || "build").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80) || "build";
}

function playerCss() {
  return `html, body {
  margin: 0;
  height: 100%;
  background: #0b0d10;
  color: #e8e6e1;
  overflow: hidden;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
}
#play {
  position: fixed;
  inset: 0;
}
#game {
  display: block;
  width: 100%;
  height: 100%;
}
#hudLayer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
#hudLayer button,
#hudLayer .again {
  pointer-events: auto;
}
`;
}

function playerHtml({ title }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="./play.css" />
  </head>
  <body>
    <div id="play">
      <canvas id="game" tabindex="0" aria-label="Game"></canvas>
      <div id="hudLayer" class="hud-layer" data-play-hud="overlay"></div>
    </div>
    <script src="./play.js"></script>
  </body>
</html>
`;
}

function readmeText({ slug }) {
  return `# ${slug} — playable prototype

This folder is the game only (not Prototype Laboratory).

## Play

Double-click \`index.html\` (Chrome / Edge / Firefox).

No install and no \`node server.mjs\` — everything is bundled into \`play.js\`.

Keep \`index.html\`, \`play.css\`, and \`play.js\` together in the same folder.
`;
}

function exportEntrySource() {
  return `import { mount } from "./gameplay/main.js";

const canvas = document.getElementById("game");
const hudRoot = document.getElementById("hudLayer");
if (hudRoot) hudRoot.dataset.playHud = "overlay";

mount(canvas, { hudRoot })
  .then(() => {
    canvas?.focus?.();
  })
  .catch((err) => {
    console.error("[play] mount failed", err);
    const msg = document.createElement("p");
    msg.textContent = err?.message || "Failed to start the prototype.";
    Object.assign(msg.style, {
      position: "absolute",
      left: "16px",
      top: "16px",
      color: "#f2f0eb",
      zIndex: "9",
    });
    document.getElementById("play")?.appendChild(msg);
  });
`;
}

/**
 * Resolve lab absolute imports (/runtime/…, /vendor/three/…) for the bundle.
 */
function labPathPlugin({ publicRoot, root }) {
  const threeCandidates = [
    path.join(root, "node_modules", "three", "build"),
    path.join(publicRoot, "vendor", "three", "build"),
  ];

  return {
    name: "plab-lab-paths",
    setup(build) {
      build.onResolve({ filter: /^\/runtime\// }, (args) => ({
        path: path.join(publicRoot, args.path.replace(/^\//, "")),
      }));

      build.onResolve({ filter: /^\/vendor\/three\// }, async (args) => {
        const base = path.basename(args.path);
        for (const dir of threeCandidates) {
          const candidate = path.join(dir, base);
          try {
            await fs.access(candidate);
            return { path: candidate };
          } catch {
            /* try next */
          }
        }
        return {
          errors: [{ text: `Three.js file not found: ${base} (npm install in the lab)` }],
        };
      });
    },
  };
}

async function bundlePlayable({ publicRoot, root, outfile }) {
  const result = await esbuild.build({
    absWorkingDir: publicRoot,
    stdin: {
      contents: exportEntrySource(),
      resolveDir: publicRoot,
      sourcefile: "export-entry.js",
      loader: "js",
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    outfile,
    write: true,
    logLevel: "silent",
    plugins: [labPathPlugin({ publicRoot, root })],
    // Keep CSS-in-JS / unexpected loaders from surprising us
    loader: { ".js": "js", ".mjs": "js", ".json": "json" },
  });
  return result;
}

/**
 * @param {object} args
 * @param {string} args.root
 * @param {string} args.publicRoot
 * @param {string} args.tddsRoot
 * @param {string} args.slug
 * @param {string} [args.destination]
 * @param {boolean} [args.allowOutsideExports] — tests only; never wire to HTTP
 */
export async function exportBuild({
  root,
  publicRoot,
  tddsRoot,
  slug,
  destination,
  allowOutsideExports = false,
}) {
  let cleanSlug;
  try {
    cleanSlug = assertSafeSlug(sanitizeSlug(slug));
  } catch {
    return { ok: false, reason: "Invalid slug" };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  let dest;
  if (allowOutsideExports && destination) {
    dest = path.isAbsolute(destination) ? path.resolve(destination) : path.resolve(root, destination);
  } else {
    const resolved = resolveExportDestination(root, destination, { slug: cleanSlug, stamp });
    if (!resolved.ok) return resolved;
    dest = resolved.dest;
  }

  const rootAbs = path.resolve(root);
  if (!allowOutsideExports) {
    for (const blocked of ["public", "server", "docs", "node_modules"]) {
      if (isInsideDir(path.join(rootAbs, blocked), dest)) {
        return { ok: false, reason: `Export destination cannot target ${blocked}/` };
      }
    }
  }

  const entrySrc = path.join(publicRoot, "gameplay", "main.js");
  try {
    await fs.access(entrySrc);
  } catch {
    return { ok: false, reason: "No playable public/gameplay/main.js. Generate Final first." };
  }

  try {
    await fs.mkdir(dest, { recursive: true });
  } catch (err) {
    return { ok: false, reason: `Cannot create destination: ${err.message}` };
  }

  const title = cleanSlug.replace(/[-_]+/g, " ").trim() || "Prototype";
  await fs.writeFile(path.join(dest, "index.html"), playerHtml({ title }), "utf8");
  await fs.writeFile(path.join(dest, "play.css"), playerCss(), "utf8");
  await fs.writeFile(path.join(dest, "README.md"), readmeText({ slug: cleanSlug }), "utf8");

  try {
    await bundlePlayable({
      publicRoot,
      root,
      outfile: path.join(dest, "play.js"),
    });
  } catch (err) {
    const detail = err?.errors?.map((e) => e.text).filter(Boolean).join("; ") || err?.message || String(err);
    return { ok: false, reason: `Bundle failed: ${detail}` };
  }

  const tddDir = path.join(tddsRoot, cleanSlug);
  const tddOutDir = path.join(dest, "tdd");
  await fs.mkdir(tddOutDir, { recursive: true });
  try {
    const entries = await fs.readdir(tddDir);
    for (const entry of entries) {
      if (/\.md$/i.test(entry)) {
        await safeCopyFile(path.join(tddDir, entry), path.join(tddOutDir, entry));
      }
    }
  } catch {
    /* no tdd */
  }

  const filesCopied = await countFiles(dest);
  const manifest = {
    slug: cleanSlug,
    kind: "playable-portable",
    exportedAt: new Date().toISOString(),
    filesCopied,
    destination: dest,
    entry: "play.js",
    open: "Double-click index.html (no server)",
  };
  await fs.writeFile(path.join(dest, "EXPORT.json"), JSON.stringify(manifest, null, 2), "utf8");

  return { ok: true, destination: dest, filesCopied, kind: "playable-portable" };
}
