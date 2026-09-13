'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { TransformationMetadata } from '@/lib/strategies/types';

interface OutputPaneProps {
  output: string;
  metadata?: TransformationMetadata | null;
}

export function OutputPane({ output, metadata }: OutputPaneProps) {
  const [copied, setCopied] = useState(false);

  async function copyOutput() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="flex min-h-[420px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">Nəticə</h2>
          <p className="mt-1 text-xs text-slate-500">Bərpa olunmuş və strukturlaşdırılmış mətn.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={!output} onClick={copyOutput}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        {output ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-900">{output}</pre>
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-slate-400">
            Nəticə burada görünəcək.
          </div>
        )}
      </div>

      {metadata && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          <span>Düzəliş: {metadata.correctionsMade}</span>
          <span>Dil: {metadata.detectedLanguage}</span>
          <span>Müddət: {metadata.executionTimeMs} ms</span>
        </div>
      )}
    </section>
  );
}
