'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { OutputPane } from '@/components/OutputPane';
import { StrategySelector } from '@/components/StrategySelector';
import { TextEditorPane } from '@/components/TextEditorPane';
import { Button } from '@/components/ui/button';
import { getStrategyRegistry } from '@/lib/strategies/bootstrap';
import type { TransformationMetadata } from '@/lib/strategies/types';

const registry = getStrategyRegistry();
const strategies = registry.listStrategies();

export default function HomePage() {
  const [strategyId, setStrategyId] = useState('text-corrector');
  const [text, setText] = useState('');
  const [output, setOutput] = useState('');
  const [metadata, setMetadata] = useState<TransformationMetadata | null>(null);
  const [preserveFormatting, setPreserveFormatting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  function invalidate() { setOutput(''); setMetadata(null); setError(''); }
  async function transform() {
    if (!text.trim() || loading) return;
    setLoading(true);
    invalidate();
    try {
      const result = await registry.get(strategyId).transform({ text, options: { preserveFormatting } });
      setOutput(result.transformedText);
      setMetadata(result.metadata);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mətn emal edilə bilmədi.');
    } finally { setLoading(false); }
  }
  return <div className="min-h-screen">
    <Header />
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <h1 className="mb-3 text-3xl font-semibold text-slate-950">Mətninizi səliqəyə salın.</h1>
      <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600">
        Mətni yazın və Düzəlt düyməsinə basın. Yazılış, durğu işarələri, cümlə başlanğıcları və siyahılar
        proqramın öz qaydaları ilə brauzerinizdə emal olunur. Model yükləmək və API açarı lazım deyil.
      </p>
      <p className="mb-6 text-xs text-slate-500">38 174 söz və ifadəlik açıq lüğət · <a className="underline" href="/dictionaries/az/metadata.json">Mənbə məlumatları</a> · <a className="underline" href="/dictionaries/az/LICENSE">Lisenziya</a></p>
      <section className="mb-6 grid gap-5 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2 md:items-center">
        <StrategySelector strategies={strategies} value={strategyId} disabled={loading}
          onChange={value => { setStrategyId(value); invalidate(); }} />
        <label className="flex items-center gap-3 text-sm text-slate-700">
          <input type="checkbox" checked={preserveFormatting} disabled={loading || strategyId === 'gmail-corrector'}
            onChange={event => { setPreserveFormatting(event.target.checked); invalidate(); }} />
          Mövcud abzas və siyahı quruluşunu saxla
        </label>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <TextEditorPane value={text} disabled={loading} onChange={value => { setText(value); invalidate(); }}
          onClear={() => { setText(''); invalidate(); }} />
        <OutputPane key={output} output={output} metadata={metadata} />
      </div>
      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="mt-6 flex flex-col items-center gap-3">
        <Button type="button" size="lg" disabled={loading || !text.trim() || text.length > 10_000}
          onClick={transform} className="min-w-52">{loading ? 'Emal olunur…' : 'Düzəlt'}</Button>
        <p className="text-xs text-slate-500">Mətn serverə göndərilmir · maksimum 10 000 simvol</p>
        <p className="max-w-2xl text-center text-xs leading-5 text-slate-500">
          Qaydalı redaktor bütün mənaları və qrammatik səhvləri tanımır; qeyri-müəyyən sözləri olduğu kimi saxlayır.
          Nəticəni nəzərdən keçirin.
        </p>
      </div>
    </main>
  </div>;
}
