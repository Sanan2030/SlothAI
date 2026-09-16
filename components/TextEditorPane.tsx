'use client';
import { useId, useState } from 'react';
import { Button } from './ui/button';
interface Props {
  label: string;
  value: string;
  placeholder: string;
  readOnly?: boolean;
  disabled?: boolean;
  maxLength?: number;
  onChange?: (value: string) => void;
  onClear?: () => void;
}
export function TextEditorPane({ label, value, placeholder, readOnly = false, disabled = false,
  maxLength, onChange, onClear }: Props) {
  const id = useId();
  const [copyStatus, setCopyStatus] = useState('');
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setCopyStatus('Mətn kopyalandı.');
    } catch { setCopyStatus('Kopyalama alınmadı. Mətni seçərək əl ilə kopyalayın.'); }
  }
  return <section className="flex min-w-0 flex-col rounded-md border border-border bg-card">
    <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border px-4">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <Button type="button" variant="ghost" size="sm" disabled={!value || disabled}
        onClick={readOnly ? copy : onClear}>{readOnly ? 'Kopyala' : 'Təmizlə'}</Button>
    </div>
    <textarea id={id} value={value} readOnly={readOnly} disabled={disabled}
      maxLength={maxLength} placeholder={placeholder} spellCheck={false}
      aria-describedby={`${id}-status`}
      onChange={event => onChange?.(event.target.value)}
      className="min-h-[360px] w-full flex-1 resize-y rounded-none bg-transparent p-5 text-base leading-8 placeholder:text-muted-foreground/70 disabled:opacity-60 sm:min-h-[420px]" />
    <div id={`${id}-status`} className="flex min-h-11 items-center border-t border-border px-4 text-xs text-muted-foreground">
      {readOnly ? <span role="status">{copyStatus || (value ? 'Kopyalamaq üçün hazırdır.' : 'Düzəldilmiş mətn burada görünəcək.')}</span>
        : <span className="tabular-nums">{value.length.toLocaleString('az-AZ')} / {maxLength?.toLocaleString('az-AZ')} simvol</span>}
    </div>
  </section>;
}
