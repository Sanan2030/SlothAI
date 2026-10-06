import { ExpertPool, supportsSpeculation } from './expert-pool';
import type { TransformationRequest, TransformationResult } from '../strategies/types';
import type { EditorWorkerRequest, EditorWorkerResponse } from './editor-protocol';
export interface EditorWorker {
  onmessage: ((event: MessageEvent<EditorWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(value: EditorWorkerRequest): void;
  terminate(): void;
}
export const EDITOR_TIMEOUT_MS = 10 * 60 * 1000;

/** The editor never runs heavy synchronous inference on the browser UI thread. */
export class EditorClient {
  private worker?: EditorWorker;
  private experts?: ExpertPool;
  private sequence = 0;
  private pending?: { id: number; resolve: (value: TransformationResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
  constructor(private readonly factory: () => EditorWorker = () => new Worker(new URL('./editor.worker.ts', import.meta.url), { type: 'module' }), private readonly timeoutMs = EDITOR_TIMEOUT_MS) {}
  /** Debounced by the UI; never changes the input or persists an unfinished draft. */
  prepare(text: string): void {
    if (!supportsSpeculation() || this.pending) return;
    this.experts ??= new ExpertPool(() => new Worker(new URL('./expert.worker.ts', import.meta.url), { type: 'module' }));
    this.experts.prepare(text);
  }
  invalidatePreparation(): void { this.experts?.invalidate(); }
  transform(strategyId: string, request: TransformationRequest): Promise<TransformationResult> {
    if (this.pending) return Promise.reject(new Error('Əvvəlki düzəliş hələ davam edir.'));
    return new Promise((resolve, reject) => {
      try {
        if (!this.worker) {
          this.worker = this.factory();
          this.worker.onmessage = ({ data }) => {
            const task = this.pending;
            if (!task || data.id !== task.id) return;
            clearTimeout(task.timer); this.pending = undefined;
            if ('error' in data) task.reject(new Error(data.error)); else task.resolve(data.result);
          };
          this.worker.onerror = this.worker.onmessageerror = () => this.dispose('Yerli mühərrik açılmadı. Səhifəni yeniləyib yenidən cəhd edin.');
        }
        const id = ++this.sequence;
        const deadline = this.timeoutMs % 60_000 === 0 ? `${this.timeoutMs / 60_000} dəqiqə` : `${Math.ceil(this.timeoutMs / 1000)} saniyə`;
        const timer = setTimeout(() => this.dispose(`Emal ${deadline} həddini keçdi. Mətni kiçik hissələrə bölüb yenidən cəhd edin.`), this.timeoutMs);
        this.pending = { id, resolve, reject, timer };
        const prepared = this.experts?.snapshot(request.text);
        this.worker.postMessage({ id, strategyId, request, ...(prepared ? { prepared } : {}) });
      } catch (cause) { this.dispose(cause instanceof Error ? cause.message : 'Yerli mühərrik açılmadı.'); reject(cause); }
    });
  }
  dispose(message = 'Düzəliş dayandırıldı.'): void {
    this.experts?.dispose(); this.experts = undefined;
    this.worker?.terminate(); this.worker = undefined;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error(message)); this.pending = undefined; }
  }
}
