/**
 * Export a standalone playable build — not the lab UI.
 *
 * Destination defaults to `<ROOT>/exports/<slug>-<timestamp>`. Contents:
 *   - index.html + play.css + play.js (full-bleed player shell)
 *   - vendor/three/build
 *   - runtime/ (Engine, SceneKit, Input, …)
 *   - gameplay/ (generated prototype)
 *   - tdd/ (TDD.md + version snapshots)
 */

import fs from "node:fs/promises";
import path from "node:path";
import {
  assertSafeSlug,
  isInsideDir,
  resolveExportDestination,
} from "./security/paths.js";

const SKIP_DIR_NAMES = new Set(["node_modules"]);

async function copyDir(srcDir, dstDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  await fs.mkdir(dstDir, { recursive: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".gitkeep") continue;
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) await copyDir(src, dst);
    else if (entry.isFile()) await fs.copyFile(src, dst);
  }
}

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
    <link rel="stylesheet" href="/play.css" />
  </head>
  <body>
    <div id="play">
      <canvas id="game" tabindex="0" aria-label="Game"></canvas>
      <div id="hudLayer" class="hud-layer" data-play-hud="overlay"></div>
    </div>
    <script type="module" src="/play.js"></script>
  </body>
</html>
`;
}

function playerJs() {
  return `import { mount } from "/gameplay/main.js";

const canvas = document.getElementById("game");
const hudRoot = document.getElementById("hudLayer");
if (hudRoot) hudRoot.dataset.playHud = "overlay";

try {
  await mount(canvas, { hudRoot });
  canvas?.focus?.();
} catch (err) {
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
}
`;
}

function playerServerSource() {
  return `import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", \`http://\${req.headers.host || "127.0.0.1"}\`);
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  if (rel.includes("\\0")) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const rootAbs = path.resolve(root);
  const file = path.resolve(rootAbs, "." + rel.replace(/\\\\/g, "/"));
  if (file !== rootAbs && !file.startsWith(rootAbs + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(\`Playable prototype → http://\${HOST}:\${PORT}/\`);
});
`;
}

function readmeText({ slug }) {
  return `# ${slug} — playable prototype

This folder is the game, not Prototype Laboratory.

From **this folder** run:

\`\`\`
node server.mjs
\`\`\`

Then open http://127.0.0.1:8080/

Do not open index.html via file:// — the browser will block module loads.
Do not run the command from the lab root; \`cd\` into this export first.
`;
}

const THREE_BUILD_FILES = ["three.module.js", "three.core.js"];

async function copyThreeBuild({ dest, root }) {
  const out = path.join(dest, "vendor", "three", "build");
  await fs.mkdir(out, { recursive: true });
  const sources = [
    path.join(root, "node_modules", "three", "build"),
    path.join(root, "public", "vendor", "three", "build"),
  ];
  const missing = [];
  for (const name of THREE_BUILD_FILES) {
    let ok = false;
    for (const dir of sources) {
      if (await safeCopyFile(path.join(dir, name), path.join(out, name))) {
        ok = true;
        break;
      }
    }
    if (!ok) missing.push(name);
  }
  return missing;
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

  // Extra belt: never write into public/, server/, or docs/ via export
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
  await fs.writeFile(path.join(dest, "play.js"), playerJs(), "utf8");
  await fs.writeFile(path.join(dest, "server.mjs"), playerServerSource(), "utf8");
  await fs.writeFile(path.join(dest, "README.md"), readmeText({ slug: cleanSlug }), "utf8");

  const missingThree = await copyThreeBuild({ dest, root });
  if (missingThree.length) {
    return {
      ok: false,
      reason: `Missing Three.js files (${missingThree.join(", ")}). Run npm install in the lab, then export again.`,
    };
  }

  await copyDir(path.join(publicRoot, "runtime"), path.join(dest, "runtime"));
  await copyDir(path.join(publicRoot, "gameplay"), path.join(dest, "gameplay"));

  const tddDir = path.join(tddsRoot, cleanSlug);
  const tddOutDir = path.join(dest, "tdd");
  await fs.mkdir(tddOutDir, { recursive: true });
  try {
    const entries = await fs.readdir(tddDir);
    for (const entry of entries) {
      if (/^TDD(\.v\d+\.\d+\.\d+)?\.md$/.test(entry) || entry === "CHANGELOG.md") {
        await safeCopyFile(path.join(tddDir, entry), path.join(tddOutDir, entry));
      }
    }
  } catch {
    /* no tdd */
  }

  const filesCopied = await countFiles(dest);
  const manifest = {
    slug: cleanSlug,
    kind: "playable",
    exportedAt: new Date().toISOString(),
    filesCopied,
    destination: dest,
    entry: "gameplay/main.js",
    serve: "From this folder run: node server.mjs  →  http://127.0.0.1:8080/",
  };
  await fs.writeFile(path.join(dest, "EXPORT.json"), JSON.stringify(manifest, null, 2), "utf8");

  return { ok: true, destination: dest, filesCopied, kind: "playable" };
}
