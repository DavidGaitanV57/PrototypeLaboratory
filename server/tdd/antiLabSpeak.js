const LAB_SPEAK =
  /\b(prototype\s*laboratory|tdd-prototype|three\.?js|webgl|webgpu|hot-?reload|sandbox\s+path|public\/gameplay|edited in the lab|validated in (the )?browser)\b/i;

export function findLabSpeak(text) {
  const hits = [];
  const lines = String(text || "").split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (LAB_SPEAK.test(line)) hits.push({ line: idx + 1, text: line.trim().slice(0, 160) });
  });
  return hits;
}

export function assertUnityClean(text) {
  const hits = findLabSpeak(text);
  if (hits.length) {
    const sample = hits
      .slice(0, 5)
      .map((h) => `L${h.line}: ${h.text}`)
      .join("; ");
    throw new Error(`TDD contains lab/web contamination: ${sample}`);
  }
}
