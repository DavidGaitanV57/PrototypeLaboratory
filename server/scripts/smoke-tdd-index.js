/** Smoke: long TDDs are navigable by section — no mechanic silently truncated away. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildTddBrief,
  buildTddOutline,
  extractTddSection,
  formatTddOutline,
} from "../agent/tddIndex.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function ok(m) {
  console.log("OK ", m);
}
function fail(m) {
  console.error("FAIL", m);
  errors.push(m);
}

const fixture = `# TDD — Demo
Intro text.

# 3 · Core Gameplay
Loop: run, grab, escape.

## 11.3 Input map
WASD move, E interact.

# §B · Production Mechanics

## Mechanic: Alpha Move
### Rules (quantified)
speed 6 m/s

## Mechanic: Omega Finish
### Rules (quantified)
timer 90 s
`;

const outline = buildTddOutline(fixture);
if (outline.length >= 6) ok(`outline parsed ${outline.length} headings`);
else fail(`outline too small: ${outline.length}`);

const alpha = outline.find((s) => s.title === "Mechanic: Alpha Move");
if (alpha && /speed 6 m\/s/.test(fixture.slice(alpha.start, alpha.end))) ok("section ranges bound correctly");
else fail("section range wrong for Alpha Move");
if (alpha && !/Omega/.test(fixture.slice(alpha.start, alpha.end))) ok("section stops at next sibling");
else fail("section bled into sibling");

const omega = extractTddSection(fixture, "Mechanic: Omega Finish");
if (omega && /timer 90 s/.test(omega.content)) ok("extract by full title");
else fail("extract by full title failed");
const loose = extractTddSection(fixture, "omega finish");
if (loose && /timer 90 s/.test(loose.content)) ok("extract is case/format tolerant");
else fail("loose extract failed");
const numbered = extractTddSection(fixture, "11.3 Input map");
if (numbered && /WASD/.test(numbered.content)) ok("extract numbered section");
else fail("numbered extract failed");
if (extractTddSection(fixture, "does not exist at all zzz") === null) ok("unknown section returns null");
else fail("unknown section should return null");

// Real TDD: every mechanic must survive the outline, and be reachable by section.
const real = path.join(ROOT, "docs/tdds/ThresholdRooms/TDD_ThresholdRooms.md");
let text = "";
try {
  text = await fs.readFile(real, "utf8");
} catch {
  console.log("SKIP ThresholdRooms TDD not present");
}

if (text) {
  const sections = buildTddOutline(text);
  const mechanics = sections.filter((s) => /^Mechanic:/i.test(s.title));
  const map = formatTddOutline(sections);
  const listed = mechanics.filter((m) => map.includes(m.title));
  if (mechanics.length && listed.length === mechanics.length) {
    ok(`outline lists all ${mechanics.length} mechanics`);
  } else {
    fail(`outline dropped mechanics: ${mechanics.length - listed.length} of ${mechanics.length}`);
  }

  const brief = buildTddBrief("docs/tdds/ThresholdRooms/TDD_ThresholdRooms.md", text);
  if (brief.length < text.length / 3) ok(`brief ${brief.length} chars vs ${text.length} source`);
  else fail(`brief too large: ${brief.length}`);

  const late = mechanics[mechanics.length - 1];
  const got = extractTddSection(text, late.title);
  if (got && got.content.length > 100) ok(`last mechanic reachable: ${late.title}`);
  else fail(`last mechanic unreachable: ${late.title}`);

  const art = extractTddSection(text, "Art Direction");
  if (art && /palette/i.test(art.content)) ok("art/atmosphere section reachable");
  else fail("art section unreachable");
}

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll TDD index smoke checks passed");
