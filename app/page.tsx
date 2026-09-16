'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { StrategySelector } from '@/components/StrategySelector';
import { TextEditorPane } from '@/components/TextEditorPane';
import { Button } from '@/components/ui/button';
import type { StrategyDescriptor, TransformationMetadata } from '@/lib/strategies/types';

const MAX_CHARS = 10_000;
function errorMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('error' in data)) return;
  const error = data.error;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
}
function isStrategy(value: unknown): value is StrategyDescriptor {
  return typeof value === 'object' && value !== null &&
    ['id', 'name', 'description', 'icon'].every(key => key in value && typeof (value as Record<string, unknown>)[key] === 'string');
}
export default function HomePage() {
  const [strategies, setStrategies] = useState<StrategyDescriptor[]>([]);
  const [selected, setSelected] = useState('text-corrector');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [metadata, setMetadata] = useState<TransformationMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/strategies', { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.strategies) || !data.strategies.length || !data.strategies.every(isStrategy)) {
          throw new Error('Emal növləri yüklənə bilmədi.');
        }
        if (controller.signal.aborted) return;
        const list: StrategyDescriptor[] = data.strategies;
        setStrategies(list);
        setSelected(list.some(strategy => strategy.id === 'text-corrector') ? 'text-corrector' : list[0].id);
        setLoadError('');
      } catch {
        if (!controller.signal.aborted) setLoadError('Emal növləri yüklənə bilmədi. Yenidən cəhd edin.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => request.current?.abort(), []);

  function invalidate() { setOutput(''); setMetadata(null); setError(''); }
  async function transform() {
    if (inFlight.current || loading || !strategies.length || !input.trim() || input.length > MAX_CHARS) return;
    inFlight.current = true;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 58_000);
    setBusy(true); invalidate();
    try {
      const response = await fetch('/api/transform', { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategyId: selected, text: input }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const retry = response.headers.get('Retry-After');
        throw new Error((errorMessage(data) ?? 'Mətn emal edilə bilmədi.') + (response.status === 429 && retry ? ` ${retry} saniyə sonra cəhd edin.` : ''));
      }
      if (!data || typeof data.transformedText !== 'string' || !data.transformedText.trim()) throw new Error('Serverdən düzgün nəticə alınmadı.');
      setOutput(data.transformedText);
      setMetadata(data.metadata ?? null);
    } catch (cause) {
      setError(controller.signal.aborted ? 'Sorğunun vaxtı bitdi. Yenidən cəhd edin.' : cause instanceof Error ? cause.message : 'Şəbəkə xətası. Yenidən cəhd edin.');
    } finally { clearTimeout(timeout); inFlight.current = false; setBusy(false); request.current = null; }
  }
  return <>
    <Header />
    <main id="main" className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-6 sm:pt-16">
      <div className="mb-10 max-w-2xl">
        <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">Fikirləriniz aydın.<br />Mətniniz səliqəli.</h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">Necə düşünürsünüzsə, elə yazın. Hərfləri, durğu işarələrini və abzasları biz səliqəyə salaq.</p>
      </div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <StrategySelector strategies={strategies} selectedId={selected} disabled={loading || busy}
          onSelect={id => { setSelected(id); invalidate(); }} />
        <Button type="button" size="lg" className="sm:mt-7 sm:min-w-36" onClick={transform}
          disabled={busy || loading || !strategies.length || !input.trim() || input.length > MAX_CHARS} aria-busy={busy}>
          {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {busy ? 'Emal olunur…' : 'Düzəlt'}
        </Button>
      </div>
      {(error || loadError) && <div role="alert" className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error || loadError}
        {loadError && <button type="button" className="ml-3 underline underline-offset-4" disabled={loading}
          onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Yenidən yüklə</button>}
      </div>}
      <div className="grid gap-5 md:grid-cols-2" aria-busy={busy}>
        <TextEditorPane label="İlkin mətn" value={input} disabled={busy} maxLength={MAX_CHARS}
          placeholder="meselen sabah gorusde uc meseleye baxaq birinci layiheni planlasdiraq ikinci vaxti deqiqlesdirek ucuncu isleri bolusdurək"
          onChange={value => { setInput(value); invalidate(); }} onClear={() => { setInput(''); invalidate(); }} />
        <TextEditorPane key={output} label="Düzəldilmiş mətn" value={output} readOnly
          placeholder={busy ? 'Mətniniz üzərində işləyirik…' : 'Fikirlərinizin səliqəli forması burada görünəcək.'} />
      </div>
      <div className="mt-4 flex flex-col justify-between gap-2 text-xs leading-5 text-muted-foreground sm:flex-row">
        <p>Mətn emal üçün Anthropic xidmətinə göndərilir. Nəticəni istifadə etməzdən əvvəl yoxlayın.</p>
        <p role="status">{busy ? 'Mətn emal olunur.' : metadata ? `Təxmini ${metadata.correctionsMade} düzəliş · ${(metadata.executionTimeMs / 1000).toFixed(1)} san.` : ''}</p>
      </div>
    </main>
    <footer className="mx-auto max-w-6xl border-t border-border px-6 py-6 text-xs text-muted-foreground">lazy.ai — Azərbaycan dilində fikirlərinizə yer var.</footer>
  </>;
}
