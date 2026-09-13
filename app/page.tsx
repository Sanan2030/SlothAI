'use client';

import { AlertCircle, Loader2, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Header } from '@/components/Header';
import { OutputPane } from '@/components/OutputPane';
import { StrategySelector } from '@/components/StrategySelector';
import { TextEditorPane } from '@/components/TextEditorPane';
import { Button } from '@/components/ui/button';
import type {
  StrategyDescriptor,
  TransformationMetadata,
  TransformationTone,
} from '@/lib/strategies/types';

interface TransformResponse {
  transformedText: string;
  metadata: TransformationMetadata;
}

const fallbackStrategies: StrategyDescriptor[] = [
  {
    id: 'text-corrector',
    name: 'Mətn Düzəldici',
    description: 'Azərbaycan dilində diakritikləri, durğu işarələrini, abzasları və siyahıları bərpa edir.',
    icon: 'FileText',
  },
];

export default function HomePage() {
  const [strategies, setStrategies] = useState<StrategyDescriptor[]>(fallbackStrategies);
  const [strategyId, setStrategyId] = useState('text-corrector');
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [metadata, setMetadata] = useState<TransformationMetadata | null>(null);
  const [tone, setTone] = useState<TransformationTone>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadStrategies() {
      try {
        const response = await fetch('/api/strategies', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as StrategyDescriptor[];
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setStrategies(data);
          if (!data.some((strategy) => strategy.id === strategyId)) {
            setStrategyId(data[0].id);
          }
        }
      } catch {
        // Keep the built-in fallback so the UI stays usable.
      }
    }

    void loadStrategies();
    return () => {
      cancelled = true;
    };
  }, [strategyId]);

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === strategyId),
    [strategies, strategyId],
  );

  async function transform() {
    if (!text.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId,
          text,
          options: {
            tone,
            preserveFormatting: false,
          },
        }),
      });

      const data = (await response.json()) as TransformResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Mətn emal edilə bilmədi.');
      }

      setOutput(data.transformedText);
      setMetadata(data.metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Naməlum xəta baş verdi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="mb-8 grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft md:grid-cols-[1fr_220px] md:items-end">
          <StrategySelector
            strategies={strategies}
            value={strategyId}
            disabled={loading}
            onChange={(value) => {
              setStrategyId(value);
              setOutput('');
              setMetadata(null);
            }}
          />

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Ton</span>
            <select
              value={tone}
              disabled={loading}
              onChange={(event) => setTone(event.target.value as TransformationTone)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            >
              <option value="default">Orijinal tonu saxla</option>
              <option value="formal">Rəsmi</option>
              <option value="casual">Səmimi</option>
            </select>
          </label>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <TextEditorPane
            value={text}
            disabled={loading}
            onChange={setText}
            onClear={() => {
              setText('');
              setOutput('');
              setMetadata(null);
              setError('');
            }}
          />
          <OutputPane output={output} metadata={metadata} />
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            type="button"
            size="lg"
            disabled={loading || !text.trim()}
            onClick={transform}
            className="min-w-52 shadow-soft"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Emal olunur...
              </>
            ) : (
              <>
                <WandSparkles className="mr-2 h-5 w-5" />
                Düzəlt
              </>
            )}
          </Button>
          <p className="text-center text-xs text-slate-400">
            {selectedStrategy?.name ?? 'SlothAI'} · maksimum 10,000 simvol
          </p>
        </div>
      </main>
    </div>
  );
}
