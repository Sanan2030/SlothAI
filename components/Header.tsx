import { PenLine } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
            <PenLine className="h-4 w-4" />
          </div>
          <div>
            <span className="font-serif text-lg font-semibold leading-none text-foreground">
              lazy.ai
            </span>
            <p className="text-xs text-muted-foreground">Azərbaycan dili mətn köməkçisi</p>
          </div>
        </div>
        <span className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          Beta
        </span>
      </div>
    </header>
  );
}
