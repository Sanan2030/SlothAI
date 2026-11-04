import type { LocalCorrection } from '../editor/correct';
import type { PunctCaseStats } from '../editor/punctcase/edit';

/** Off by default. The model is imported only for an explicit application request. */
export async function optionalPunctCase(source: string, baseline: LocalCorrection, enabled: boolean | undefined,
  stableCorrection: (text: string) => LocalCorrection): Promise<{ correction: LocalCorrection; stats?: PunctCaseStats }> {
  if (enabled !== true) return { correction: baseline };
  const { initialPunctCaseStats, punctCaseSkipReason, editWithPunctCase, samePunctCaseWords } = await import('../editor/punctcase/edit');
  const stats = initialPunctCaseStats(), reason = punctCaseSkipReason(source);
  if (reason) { stats.skippedReason = reason; return { correction: baseline, stats }; }
  const { loadPunctCase } = await import('../editor/punctcase/load');
  const model = await loadPunctCase(); stats.loaded = true;
  const started = performance.now();
  const candidate = editWithPunctCase(baseline.text, model, stats);
  stats.inferenceTimeMs = performance.now() - started;
  if (candidate === baseline.text) return { correction: baseline, stats };
  // Only accept a complete proposal that is also a fixed point of the existing engine.
  if (candidate.length > 10_000 || !samePunctCaseWords(baseline.text, candidate)
    || stableCorrection(candidate).text !== candidate) {
    stats.rejectedUnstable = true; stats.applied = stats.punctuation = stats.capitalization = 0;
    return { correction: baseline, stats };
  }
  return { correction: { text: candidate, corrections: baseline.corrections + stats.applied }, stats };
}
