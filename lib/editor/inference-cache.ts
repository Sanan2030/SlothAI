/** Exact-stage speculation: a changed context always reruns the existing model. */
export type InferenceStage = 'log-spelling' | 'sentence-boundary';
export type InferenceRunner = (stage: InferenceStage, input: string, fallback: () => string) => string;
export interface ProposedEdit { start: number; end: number; replacement: string }
export interface ModelProposal {
  revision: number;
  stage: InferenceStage;
  input: string;
  output: string;
  edits: ProposedEdit[];
}
export interface PreparedInference { revision: number; text: string; proposals: ModelProposal[] }
export interface InferenceStats { proposed: number; rejected: number; reused: number; recomputed: number }

/** UTF-16 offsets are relative to the proposal's immutable stage input. */
export function proposeEdits(input: string, output: string, stage: InferenceStage): ProposedEdit[] | undefined {
  if (stage === 'sentence-boundary') {
    const edits: ProposedEdit[] = [];
    let cursor = 0;
    for (let at = 0; at < output.length; at++) {
      if (output[at] === input[cursor]) { cursor++; continue; }
      if (!/[.?]/u.test(output[at])) return undefined;
      edits.push({ start: cursor, end: cursor, replacement: output[at] });
    }
    return cursor === input.length ? edits : undefined;
  }
  const before = [...input.matchAll(/\p{L}+(?:-\p{L}+)*/gu)];
  const after = [...output.matchAll(/\p{L}+(?:-\p{L}+)*/gu)];
  if (before.length !== after.length) return undefined;
  const edits: ProposedEdit[] = [];
  let previousBefore = 0, previousAfter = 0;
  for (let at = 0; at < before.length; at++) {
    const left = before[at], right = after[at];
    if (input.slice(previousBefore, left.index) !== output.slice(previousAfter, right.index)) return undefined;
    if (left[0] !== right[0]) edits.push({ start: left.index!, end: left.index! + left[0].length, replacement: right[0] });
    previousBefore = left.index! + left[0].length; previousAfter = right.index! + right[0].length;
  }
  return input.slice(previousBefore) === output.slice(previousAfter) ? edits : undefined;
}

export function applyProposal(proposal: ModelProposal, revision: number, validSurface: (word: string) => boolean): string | undefined {
  if (proposal.revision !== revision || !Number.isSafeInteger(revision) || revision < 1
    || proposal.input.length > 10_000 || proposal.output.length > 20_000 || proposal.edits.length > 2_000) return undefined;
  const protectedRanges = [...proposal.input.matchAll(/<!--[\s\S]*?-->|```[\s\S]*?(?:```|$)|`[^`\n]*`|<[^>]*>|https?:\/\/[^\s<>]+|\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b|[\uE000-\uF8FF]+\d*\uE001/gu)]
    .map(match => ({ start: match.index!, end: match.index! + match[0].length }));
  const edits = [...proposal.edits].sort((a, b) => a.start - b.start || a.end - b.end);
  let previousEnd = -1;
  for (const edit of edits) {
    if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end) || edit.start < 0 || edit.end < edit.start || edit.end > proposal.input.length
      || edit.start <= previousEnd || protectedRanges.some(range => edit.start < range.end && edit.end > range.start || edit.start === edit.end && edit.start > range.start && edit.start < range.end)) return undefined;
    if (proposal.stage === 'sentence-boundary') {
      // Boundary heads may only insert a terminal mark into an existing gap.
      if (edit.start !== edit.end || !/^[.?]$/u.test(edit.replacement)
        || !/\p{L}$/u.test(proposal.input.slice(0, edit.start)) || !/^\s+\p{L}/u.test(proposal.input.slice(edit.end))) return undefined;
    } else if (proposal.stage === 'log-spelling') {
      if (!/^\p{L}+(?:-\p{L}+)*$/u.test(proposal.input.slice(edit.start, edit.end))
        || !/^\p{L}+(?:-\p{L}+)*$/u.test(edit.replacement) || !edit.replacement.split('-').every(validSurface)) return undefined;
    } else return undefined;
    previousEnd = edit.end;
  }
  let output = proposal.input;
  for (const edit of edits.reverse()) output = output.slice(0, edit.start) + edit.replacement + output.slice(edit.end);
  return output === proposal.output ? output : undefined;
}

/** All-or-nothing per stage: never partially apply a context-dependent head. */
export function createInferenceRunner(prepared: PreparedInference, text: string, validSurface: (word: string) => boolean) {
  const stats: InferenceStats = { proposed: 0, rejected: 0, reused: 0, recomputed: 0 };
  const cache = new Map<InferenceStage, Map<string, string>>();
  const conflicts = new Set<string>();
  if (prepared.text === text && prepared.proposals.length <= 256) for (const proposal of prepared.proposals) {
    stats.proposed += proposal.edits.length;
    const output = applyProposal(proposal, prepared.revision, validSurface);
    if (output === undefined) { stats.rejected++; continue; }
    let stage = cache.get(proposal.stage);
    if (!stage) { stage = new Map(); cache.set(proposal.stage, stage); }
    // Contradictory results on the same snapshot are discarded, not voted on.
    const key = `${proposal.stage}\0${proposal.input}`;
    if (conflicts.has(key)) { stats.rejected++; continue; }
    if (stage.has(proposal.input) && stage.get(proposal.input) !== output) { stage.delete(proposal.input); conflicts.add(key); stats.rejected++; continue; }
    stage.set(proposal.input, output);
  }
  const run: InferenceRunner = (stage, input, fallback) => {
    const cached = cache.get(stage)?.get(input);
    if (cached !== undefined) { stats.reused++; return cached; }
    stats.recomputed++; return fallback();
  };
  return { run, stats };
}
