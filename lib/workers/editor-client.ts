import type { TransformationRequest, TransformationResult } from '../strategies/types';
import type { EditorWorkerRequest, EditorWorkerResponse } from './editor-protocol';
export interface EditorWorker {
  onmessage: ((event: MessageEvent<EditorWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(value: EditorWorkerRequest): void;
  terminate(): void;
}
/** The editor never runs heavy synchronous inference on the browser UI thread. */
export class EditorClient {
  private worker?: EditorWorker;
  private sequence = 0;
  private pending?: { id: number; resolve: (value: TransformationResult) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
  constructor(private readonly factory: () => EditorWorker = () => new Worker(new URL('./editor.worker.ts', import.meta.url), { type: 'module' }), private readonly timeoutMs = 10_000) {}
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
        const timer = setTimeout(() => this.dispose('Emal 10 saniyə həddini keçdi. Mətni kiçik hissələrə bölüb yenidən cəhd edin.'), this.timeoutMs);
        this.pending = { id, resolve, reject, timer };
        this.worker.postMessage({ id, strategyId, request });
      } catch (cause) { this.dispose(cause instanceof Error ? cause.message : 'Yerli mühərrik açılmadı.'); reject(cause); }
    });
  }
  dispose(message = 'Düzəliş dayandırıldı.'): void {
    this.worker?.terminate(); this.worker = undefined;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error(message)); this.pending = undefined; }
  }
}
