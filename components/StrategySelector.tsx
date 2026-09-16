'use client';
import type { StrategyDescriptor } from '@/lib/strategies/types';
interface Props {
  strategies: StrategyDescriptor[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}
export function StrategySelector({ strategies, selectedId, onSelect, disabled }: Props) {
  const selected = strategies.find(strategy => strategy.id === selectedId);
  return <div className="w-full max-w-md">
    <label htmlFor="strategy" className="mb-2 block text-sm font-medium">Emal növü</label>
    <select id="strategy" value={selectedId} onChange={event => onSelect(event.target.value)}
      disabled={disabled || !strategies.length} aria-describedby="strategy-description"
      className="w-full rounded-md border border-border bg-card px-3 py-3 text-sm disabled:opacity-60">
      {!strategies.length && <option value="">Emal növləri yüklənir…</option>}
      {strategies.map(strategy => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}
    </select>
    <p id="strategy-description" className="mt-2 min-h-8 text-xs leading-5 text-muted-foreground">{selected?.description}</p>
  </div>;
}
