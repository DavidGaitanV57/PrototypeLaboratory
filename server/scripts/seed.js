import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const destDir = path.join(ROOT, "docs", "tdds", "CoinRush");
const dest = path.join(destDir, "TDD.md");
const candidates = [
  path.join("E:/Repositorio/Base_Unity_V57/V57/Test/TDD_CoinRush3D.md"),
  path.join(ROOT, "..", "Base_Unity_V57", "V57", "Test", "TDD_CoinRush3D.md"),
];

await fs.mkdir(destDir, { recursive: true });
try {
  await fs.access(dest);
  console.log("TDD already present:", dest);
  process.exit(0);
} catch {
  /* seed */
}

let src = null;
for (const c of candidates) {
  try {
    await fs.access(c);
    src = c;
    break;
  } catch {
    /* */
  }
}

if (src) {
  await fs.copyFile(src, dest);
  console.log("Seeded CoinRush TDD from", src);
} else {
  await fs.writeFile(
    dest,
    `# TDD — Coin Rush 3D\n\n| **Game title** | Coin Rush 3D |\n| **Document version** | 1.0.0 |\n\n\`\`\`yaml\nproject_name: "Coin Rush 3D"\nengine: "Unity 2022.3.50f1 (LTS)"\n\`\`\`\n\n## Mechanic: PlayerMovement\n\n- type: feature\n- Move with WASD, run with Shift, jump with Space. topSpeed 7.\n\n## Mechanic: CoinCollectible\n\n- Collect 5 coins via trigger overlap.\n\n## Mechanic: WinLoseSystem\n\n- Win at 5 coins within 60 seconds; lose on timeout or fall below y=-5.\n\n## Mechanic: GameHud\n\n- Show coin count, timer, win/lose panels.\n`,
    "utf8",
  );
  console.log("Wrote minimal CoinRush TDD (Base Unity example not found)");
}
