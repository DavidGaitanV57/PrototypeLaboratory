/**
 * Accumulate per-run agent metrics (tokens, turns, tools, wall time).
 */

export function createRunMeter() {
  const startedAt = Date.now();
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let turns = 0;
  let toolCalls = 0;
  let filesWritten = 0;
  let tokensKnown = false;

  function addUsage(usage) {
    if (!usage || typeof usage !== "object") return;
    const prompt = num(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens);
    const completion = num(
      usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens,
    );
    const total = num(usage.total_tokens ?? usage.totalTokens);
    if (prompt || completion || total) tokensKnown = true;
    promptTokens += prompt;
    completionTokens += completion;
    totalTokens += total || prompt + completion;
  }

  return {
    noteTurn(usage) {
      turns += 1;
      addUsage(usage);
    },
    noteUsage(usage) {
      addUsage(usage);
    },
    noteTool() {
      toolCalls += 1;
    },
    noteFile() {
      filesWritten += 1;
    },
    get tokensKnown() {
      return tokensKnown;
    },
    /** @param {Record<string, unknown>} [extra] */
    finish(extra = {}) {
      const durationMs = Date.now() - startedAt;
      return {
        type: "benchmark",
        at: new Date().toISOString(),
        durationMs,
        promptTokens,
        completionTokens,
        totalTokens: totalTokens || promptTokens + completionTokens,
        turns,
        toolCalls,
        filesWritten,
        tokensKnown,
        ...extra,
      };
    },
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatDuration(ms) {
  const s = Math.max(0, Number(ms) || 0) / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}

export function formatTokens(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}
