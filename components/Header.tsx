import { Sparkles } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-950">SlothAI</p>
            <p className="text-xs text-slate-500">Azərbaycan dili üçün ağıllı mətn emalı</p>
          </div>
        </div>
        <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:block">
          Next.js · Vercel Ready
        </div>
      </div>
    </header>
  );
}
