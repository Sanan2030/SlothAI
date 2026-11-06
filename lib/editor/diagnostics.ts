/** Opt-in, in-memory diagnostics. Nothing is persisted or uploaded by the engine. */
export interface StageDiagnostic {
  kind: 'stage'; source: string; category: 'rule' | 'model' | 'format';
  input: string; output: string;
  edit: { start: number; before: string; after: string };
}
export interface CandidateDiagnostic {
  kind: 'candidates'; source: 'wordlm-selection'; raw: string; rawStart: number;
  current: string; ruleProposal: string; baselineProposal: string; mode: 'automatic' | 'fallback' | 'experimental' | 'disabled';
  candidates: { word: string; sources: string[]; lmLogScore: number; lmEvidence?: boolean; corpusLogScore?: number; charLogit?: number; oovLogPenalty: number; channelLogScore: number; score: number; evidence: boolean; bridgeEvidence?: boolean; sourceContextExamples?: number; sourceContextBridge?: boolean; contextLogAdjustment?: number }[];
  selected: string; reason: string;
}
export type EditorDiagnostic = StageDiagnostic | CandidateDiagnostic;
export type DiagnosticSink = (event: EditorDiagnostic) => void;

export function editorStage(sink: DiagnosticSink | undefined, source: string, category: StageDiagnostic['category'], input: string, operation: (text: string) => string): string {
  const output = operation(input);
  if (sink && output !== input) {
    let start = 0, end = 0;
    while (start < Math.min(input.length, output.length) && input[start] === output[start]) start++;
    while (end < Math.min(input.length, output.length) - start && input[input.length - end - 1] === output[output.length - end - 1]) end++;
    sink({ kind: 'stage', source, category, input, output,
      edit: { start, before: input.slice(start, input.length - end), after: output.slice(start, output.length - end) } });
  }
  return output;
}
