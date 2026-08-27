import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  advisePlayability,
  buildGenreBrief,
  formatAdviceForChat,
  inferGenreHints,
} from "../agent/playabilityAdvisor.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function ok(msg) {
  console.log("OK ", msg);
}
function fail(msg) {
  console.error("FAIL", msg);
  errors.push(msg);
}

const kartTdd = "Laps: 3. Kart race with checkpoints and item boxes.";
const hints = inferGenreHints(kartTdd);
if (hints.some((h) => h.genre === "kart")) ok("inferGenreHints kart");
else fail("expected kart genre");

const contrastTdd =
  "Completely distinct from kart racing. genre: Stealth / infiltration (top-down 3D)";
const contrastHints = inferGenreHints(contrastTdd);
if (!contrastHints.some((h) => h.genre === "kart")) ok("inferGenreHints ignores kart contrast");
else fail("kart contrast text should not infer kart");

const platformerTdd = 'genre: "Endless vertical platformer / arcade (underwater)"';
const platformHints = inferGenreHints(platformerTdd);
if (platformHints.some((h) => h.genre === "platformer") && !platformHints.some((h) => h.genre === "kart")) {
  ok("inferGenreHints platformer from declared genre");
} else fail("expected platformer without kart");

const brief = buildGenreBrief(kartTdd);
if (/lap must increment/i.test(brief)) ok("buildGenreBrief includes lap contract");
else fail("genre brief missing lap contract");

const report = await advisePlayability({ root: ROOT, tddText: kartTdd });
if (report.ok !== true) fail("advisor must always ok:true");
else ok("advisePlayability ok:true (never blocks)");

if (!Array.isArray(report.advice)) fail("advice array missing");
else ok(`advice entries: ${report.advice.length}`);

const digest = formatAdviceForChat(report.advice);
ok(digest ? `digest length ${digest.length}` : "digest empty or soft-ok");

// Advisor must not throw on empty gameplay either
const emptyReport = await advisePlayability({
  root: path.join(ROOT, "does-not-exist-lab-root-for-advisor"),
  tddText: "collect 5 coins in 60 seconds",
});
if (emptyReport.ok) ok("advisor soft on missing root gameplay");
else fail("advisor should soft-succeed");

if (errors.length) {
  console.error(`\n${errors.length} failure(s)`);
  process.exit(1);
}
console.log("\nAll advisor smoke checks passed");
