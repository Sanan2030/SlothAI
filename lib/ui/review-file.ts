import { appendReviewCase, emptyReviewCorpus, MAX_REVIEW_FILE_BYTES, parseReviewCorpus,
  REVIEW_FILE_NAME, serializeReviewCorpus, type ReviewCase, type ReviewCorpus } from '../editor/review-corpus';

export interface ReviewFileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(text: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
}
export interface ReviewPickerWindow {
  showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<ReviewFileHandle>;
}
export async function readReviewFile(file: File): Promise<ReviewCorpus> {
  if (file.size > MAX_REVIEW_FILE_BYTES) throw new Error('Test faylı 25 MB həddini keçir.');
  return parseReviewCorpus(await file.text());
}
/** Read before every write so another editor's disk changes are not silently lost. */
export async function saveReviewToFile(handle: ReviewFileHandle, row: ReviewCase, initial: ReviewCorpus = emptyReviewCorpus()): Promise<ReviewCorpus> {
  const file = await handle.getFile();
  const corpus = file.size === 0 ? initial : await readReviewFile(file);
  const next = appendReviewCase(corpus, row);
  const writer = await handle.createWritable();
  try {
    await writer.write(serializeReviewCorpus(next));
    await writer.close();
  } catch (error) {
    try { await writer.abort(); } catch { /* Keep the original write failure. */ }
    throw error;
  }
  return next;
}
export function pickReviewFile(browser: ReviewPickerWindow): Promise<ReviewFileHandle> | undefined {
  return browser.showSaveFilePicker?.({ suggestedName: REVIEW_FILE_NAME,
    types: [{ description: 'SlothAI test nümunələri', accept: { 'application/json': ['.json'] } }] });
}
export function downloadReviewCorpus(corpus: ReviewCorpus): void {
  const url = URL.createObjectURL(new Blob([serializeReviewCorpus(corpus)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = REVIEW_FILE_NAME;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
