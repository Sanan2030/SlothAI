import type { StrategyDescriptor } from '@/lib/strategies/types';

interface StrategySelectorProps {
  strategies: StrategyDescriptor[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function StrategySelector({
  strategies,
  value,
  disabled,
  onChange,
}: StrategySelectorProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">Emal növü</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {strategies.map((strategy) => (
          <option key={strategy.id} value={strategy.id}>
            {strategy.name}
          </option>
        ))}
      </select>
      <p className="mt-2 min-h-5 text-xs leading-5 text-slate-500">
        {strategies.find((strategy) => strategy.id === value)?.description ?? ''}
      </p>
    </label>
  );
}
