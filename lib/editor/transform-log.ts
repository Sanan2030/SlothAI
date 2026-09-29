/** Browser-local opt-in export of editor input/output pairs. No network calls. */
export interface TransformLogEntry {
  id: string;
  at: string;
  module: 'text' | 'mail';
  input: string;
  output: string;
  greeting?: string;
  source: 'transformed' | 'remembered' | 'reviewed';
}

export const TRANSFORM_LOG_KEY = 'slothai-transform-log-v1';
const MAX_ENTRIES = 50;
const MAX_ENTRY_LENGTH = 10_000;

function valid(value: unknown): value is TransformLogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === 'string' && entry.id.length <= 80
    && typeof entry.at === 'string' && entry.at.length <= 40
    && (entry.module === 'text' || entry.module === 'mail')
    && typeof entry.input === 'string' && entry.input.length <= MAX_ENTRY_LENGTH
    && typeof entry.output === 'string' && entry.output.length <= MAX_ENTRY_LENGTH * 2
    && (entry.greeting === undefined || typeof entry.greeting === 'string' && entry.greeting.length <= 100)
    && (entry.source === 'transformed' || entry.source === 'remembered' || entry.source === 'reviewed');
}

export function readTransformLog(storage: Pick<Storage, 'getItem'>): TransformLogEntry[] {
  try {
    const raw = storage.getItem(TRANSFORM_LOG_KEY);
    if (!raw || raw.length > 2_100_000) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid).slice(-MAX_ENTRIES) : [];
  } catch { return []; }
}

export function appendTransformLog(storage: Pick<Storage, 'getItem' | 'setItem'>, entry: TransformLogEntry): number {
  if (!valid(entry)) throw new Error('Günlük qeydi etibarsızdır.');
  const entries = [...readTransformLog(storage), entry].slice(-MAX_ENTRIES);
  storage.setItem(TRANSFORM_LOG_KEY, JSON.stringify(entries));
  return entries.length;
}

export function exportTransformLog(storage: Pick<Storage, 'getItem'>): string {
  return JSON.stringify({ schemaVersion: 1, entries: readTransformLog(storage) }, null, 2) + '\n';
}
