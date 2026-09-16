import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface TextEditorPaneProps {
  value: string;
  disabled?: boolean;
  maxLength?: number;
  onChange: (value: string) => void;
  onClear: () => void;
}

export function TextEditorPane({
  value,
  disabled,
  maxLength = 10_000,
  onChange,
  onClear,
}: TextEditorPaneProps) {
  return (
    <section className="flex min-h-[420px] flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">Xam mətn</h2>
          <p className="mt-1 text-xs text-slate-500">Düzəldilməsini istədiyiniz mətni daxil edin.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={!value || disabled}>
          <Trash2 className="mr-2 h-4 w-4" />
          Təmizlə
        </Button>
      </div>

      <textarea
        aria-label="Xam mətn"
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Məsələn: salam her vaxtiniz xeyir bu metni duzelt..."
        className="min-h-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
      />

      <div className="mt-3 flex justify-end text-xs text-slate-400">
        {value.length.toLocaleString()} / {maxLength.toLocaleString()}
      </div>
    </section>
  );
}
