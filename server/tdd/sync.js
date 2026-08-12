import fs from "node:fs/promises";
import path from "node:path";
import { assertUnityClean } from "./antiLabSpeak.js";
import { assertSafeSlug } from "../security/paths.js";

export async function finalizeTddSync(tddsRoot, slug) {
  const safe = assertSafeSlug(slug);
  const tddPath = path.join(tddsRoot, safe, "TDD.md");
  const text = await fs.readFile(tddPath, "utf8");
  assertUnityClean(text);

  const versionMatch = text.match(/Document version\*\*\s*\|\s*([0-9]+)\.([0-9]+)\.([0-9]+)/i);
  let nextVersion = null;
  let nextText = text;
  if (versionMatch) {
    const major = Number(versionMatch[1]);
    const minor = Number(versionMatch[2]);
    const patch = Number(versionMatch[3]) + 1;
    nextVersion = `${major}.${minor}.${patch}`;
    nextText = text.replace(versionMatch[0], `Document version** | ${nextVersion}`);
    const snapName = `TDD.v${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]}.md`;
    await fs.writeFile(path.join(tddsRoot, safe, snapName), text, "utf8");
    await fs.writeFile(tddPath, nextText, "utf8");
  }

  return { version: nextVersion, slug: safe };
}
