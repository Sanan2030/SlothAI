import type { LocalCorrection } from '../editor/correct';
import type { PunctCaseStats } from '../editor/punctcase/edit';

/** Automatic for both application strategies, including editable structured prose. */
export async function automaticPunctCase(_source: string, baseline: LocalCorrection,
  stableCorrection: (text: string) => LocalCorrection): Promise<{ correction: LocalCorrection; stats: PunctCaseStats }> {
  const { initialPunctCaseStats, editPunctCaseDocument, samePunctCaseWords } = await import('../editor/punctcase/edit');
  const stats = initialPunctCaseStats();
  const { loadPunctCase } = await import('../editor/punctcase/load');
  const model = await loadPunctCase(); stats.loaded = true;
  const started = performance.now();
  const candidate = editPunctCaseDocument(baseline.text, model, stats);
  stats.inferenceTimeMs = performance.now() - started;
  if (!stats.tokens) stats.skippedReason = 'no-editable-prose';
  if (candidate === baseline.text) return { correction: baseline, stats };
  // Only accept a complete proposal that is also a fixed point of the existing engine.
  if (candidate.length > 10_000 || !samePunctCaseWords(baseline.text, candidate)
    || stableCorrection(candidate).text !== candidate
    || editPunctCaseDocument(candidate, model, initialPunctCaseStats()) !== candidate) {
    stats.rejectedUnstable = true; stats.applied = stats.punctuation = stats.capitalization = 0;
    return { correction: baseline, stats };
  }
  return { correction: { text: candidate, corrections: baseline.corrections + stats.applied }, stats };
}
