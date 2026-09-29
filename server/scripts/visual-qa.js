/**
 * CLI: run visual QA against the running lab (npm start first).
 *   npm run qa                     → capture + score current public/gameplay build
 *   npm run qa -- --base http://127.0.0.1:3850 --slug ThresholdRooms
 * Prints the digest and the report folder (sessions/qa/<stamp>/).
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runVisualQa } from "../agent/visualQa.js";
import { readTdd } from "../tdd/parser.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const baseUrl = arg("base", `http://127.0.0.1:${process.env.PORT || 3850}`);
const slug = arg("slug", "");
let tddText = "";
if (slug) {
  try {
    tddText = (await readTdd(path.join(ROOT, "docs", "tdds"), slug)).text;
  } catch {
    /* optional */
  }
}
const report = await runVisualQa({
  root: ROOT,
  baseUrl,
  tddText,
  onEvent: (ev) => ev.type === "status" && console.log(`· ${ev.message}`),
});
console.log(`\n${report.digest}`);
if (report.capture?.dir) console.log(`\nShots + report.json: ${path.relative(ROOT, report.capture.dir)}`);
process.exit(report.capture?.ok ? 0 : 1);
