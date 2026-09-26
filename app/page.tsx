'use client';

import { BrandEmoji } from '@/components/BrandEmoji';
import { RichEditor } from '@/components/RichEditor';
import { Check, Copy, FileText, Mail, Moon, Sun, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { getStrategyRegistry } from '@/lib/strategies/bootstrap';
import { buildAnimatedDiff } from '@/lib/ui/text-diff';
import type { TransformationMetadata } from '@/lib/strategies/types';
import { MAX_TEXT_LENGTH } from '@/lib/editor/correct';
import { documentHTML, documentText, plainDocument, transferMarks, type RichDocument } from '@/lib/ui/rich-document';

type ModuleId = 'text' | 'mail';
type Theme = 'dark' | 'light';

const registry = getStrategyRegistry();

const MODULES = {
  text: {
    strategyId: 'text-corrector',
    title: 'Mətn Düzəldici',
    description: 'Səliqəsiz yazılmış mətni diakritiklər, durğu işarələri və böyük hərflərlə səliqəyə sal.',
    inputLabel: 'Xam mətn',
    placeholder: 'Məsələn: salam her vaxtiniz xeyir bu metni duzelt...',
  },
  mail: {
    strategyId: 'gmail-corrector',
    title: 'Mail Düzəldici',
    description: 'Tələsik yazılmış qaralamanı rəsmi məktub formasına sal.',
    inputLabel: 'Qaralama',
    placeholder: 'Məsələn: salam sorgunuza baxildi problem askar edilmeyib...',
  },
} as const;

export default function HomePage() {
  const [activeModule, setActiveModule] = useState<ModuleId>('text');
  const [textValue, setTextValue] = useState('');
  const [mailValue, setMailValue] = useState('');
  const [textDocument, setTextDocument] = useState<RichDocument>(() => plainDocument(''));
  const [mailDocument, setMailDocument] = useState<RichDocument>(() => plainDocument(''));
  const [mailSubject, setMailSubject] = useState('');
  const [textOutput, setTextOutput] = useState('');
  const [mailOutput, setMailOutput] = useState('');
  const [textOutputDocument, setTextOutputDocument] = useState<RichDocument>(() => plainDocument(''));
  const [mailOutputDocument, setMailOutputDocument] = useState<RichDocument>(() => plainDocument(''));
  const [editingOutput, setEditingOutput] = useState(false);
  const [textMetadata, setTextMetadata] = useState<TransformationMetadata | null>(null);
  const [mailMetadata, setMailMetadata] = useState<TransformationMetadata | null>(null);
  const [preserveFormatting, setPreserveFormatting] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    try {
      const saved = localStorage.getItem('lazyai-theme');
      const next: Theme = saved === 'light' || saved === 'dark'
        ? saved
        : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      setTheme(next);
      document.documentElement.dataset.theme = next;
    } catch {
      document.documentElement.dataset.theme = 'dark';
    }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const config = MODULES[activeModule];
  const inputValue = activeModule === 'text' ? textValue : mailValue;
  const output = activeModule === 'text' ? textOutput : mailOutput;
  const sourceDocument = activeModule === 'text' ? textDocument : mailDocument;
  const outputDocument = activeModule === 'text' ? textOutputDocument : mailOutputDocument;
  const metadata = activeModule === 'text' ? textMetadata : mailMetadata;

  const inputLength = useMemo(() => inputValue.length, [inputValue]);
  const diffSource = useMemo(() => {
    if (activeModule !== 'mail' || !mailSubject.trim() || /^\s*mövzu:/iu.test(inputValue)) {
      return inputValue;
    }
    return `Mövzu: ${mailSubject.trim()}\n${inputValue}`;
  }, [activeModule, inputValue, mailSubject]);
  const animatedOutput = useMemo(
    () => buildAnimatedDiff(diffSource, output),
    [diffSource, output],
  );

  function setInput(value: string, rich: RichDocument = plainDocument(value)) {
    if (value.length > MAX_TEXT_LENGTH) return;
    setError('');
    setCopied(false);
    setEditingOutput(false);
    if (activeModule === 'text') {
      setTextValue(value);
      setTextDocument(rich);
      setTextOutput('');
      setTextMetadata(null);
    } else {
      setMailValue(value);
      setMailDocument(rich);
      setMailOutput('');
      setMailMetadata(null);
    }
  }

  function clearCurrent() {
    setInput('');
  }

  function selectModule(module: ModuleId) {
    setActiveModule(module);
    setError('');
    setCopied(false);
    setEditingOutput(false);
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('lazyai-theme', next);
    } catch {}
  }

  async function transform() {
    if (!inputValue.trim() || loading || diffSource.length > MAX_TEXT_LENGTH) return;

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      let requestText = inputValue;
      if (activeModule === 'mail' && mailSubject.trim() && !/^\s*mövzu:/iu.test(inputValue)) {
        requestText = `Mövzu: ${mailSubject.trim()}\n${inputValue}`;
      }

      const result = await registry.get(config.strategyId).transform({
        text: requestText,
        options: activeModule === 'text' ? { preserveFormatting } : undefined,
      });

      if (activeModule === 'text') {
        setTextOutput(result.transformedText);
        setTextOutputDocument(transferMarks(textDocument, result.transformedText));
        setEditingOutput(textDocument.blocks.some(block => block.children.some(inline => inline.marks.length > 0)));
        setTextMetadata(result.metadata);
      } else {
        setMailOutput(result.transformedText);
        setMailOutputDocument(transferMarks(mailDocument, result.transformedText));
        setEditingOutput(mailDocument.blocks.some(block => block.children.some(inline => inline.marks.length > 0)));
        setMailMetadata(result.metadata);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Mətn emal edilə bilmədi.');
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!output) return;
    try {
      if (navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([new ClipboardItem({
            'text/plain': new Blob([output], { type: 'text/plain' }),
            'text/html': new Blob([documentHTML(outputDocument)], { type: 'text/html' }),
          })]);
        } catch {
          await navigator.clipboard.writeText(output);
        }
      } else await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Kopyalama alınmadı. Mətni seçərək əl ilə kopyalayın.');
    }
  }

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <span className="workspace-brand-mark" aria-hidden="true">
            <BrandEmoji />
          </span>
          <span className="workspace-brand-name">SlothAI</span>
        </div>

        <nav className="workspace-nav" aria-label="Modullar">
          <span
            className={`workspace-nav-indicator ${activeModule === 'mail' ? 'mail' : ''}`}
            aria-hidden="true"
          />
          <button
            type="button"
            className={`workspace-nav-item ${activeModule === 'text' ? 'active' : ''}`}
            onClick={() => selectModule('text')}
          >
            <FileText size={17} strokeWidth={2} />
            Mətn Düzəldici
          </button>
          <button
            type="button"
            className={`workspace-nav-item ${activeModule === 'mail' ? 'active' : ''}`}
            onClick={() => selectModule('mail')}
          >
            <Mail size={17} strokeWidth={2} />
            Mail Düzəldici
          </button>
        </nav>

        <div className="workspace-sidebar-meta">
          <span>Yerli mühərrik</span>
          <span>API açarı tələb olunmur</span>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <div className="workspace-topbar-title">{config.title}</div>
            <div className="workspace-topbar-subtitle">Azərbaycan dili üçün yerli mətn redaktoru</div>
          </div>
          <button
            type="button"
            className="workspace-theme-toggle"
            aria-label="Açıq/tünd rejimi dəyiş"
            onClick={toggleTheme}
          >
            <span className="workspace-toggle-track">
              <span className="workspace-toggle-thumb">
                {theme === 'light' ? <Sun size={13} /> : <Moon size={13} />}
              </span>
            </span>
          </button>
        </header>

        <main className="workspace-content">
          <section className="workspace-card">
            <div className="workspace-card-header">
              <div>
                <h1>{config.title}</h1>
                <p>{config.description}</p>
              </div>
              <button
                type="button"
                className={`workspace-run-btn ${loading ? 'is-loading' : ''}`}
                onClick={transform}
                disabled={loading || !inputValue.trim() || diffSource.length > MAX_TEXT_LENGTH}
              >
                <span className="workspace-spinner" aria-hidden="true" />
                {loading ? 'Emal olunur…' : 'Düzəlt'}
              </button>
            </div>

            {activeModule === 'mail' && (
              <div className="workspace-field-row">
                <label htmlFor="mail-subject">Mövzu</label>
                <input
                  id="mail-subject"
                  type="text"
                  value={mailSubject}
                  placeholder="Məsələn: Layihə haqqında"
                  disabled={loading}
                  onChange={(event) => {
                    setMailSubject(event.target.value);
                    setMailOutput('');
                    setMailMetadata(null);
                  }}
                />
              </div>
            )}

            <div className="workspace-editor-grid">
              <div className="workspace-editor-column">
                <div className="workspace-column-head">
                  <span>{config.inputLabel}</span>
                  <button
                    type="button"
                    className="workspace-icon-btn"
                    onClick={clearCurrent}
                    disabled={!inputValue || loading}
                    aria-label="Mətni təmizlə"
                  >
                    <Trash2 size={15} />
                    Təmizlə
                  </button>
                </div>

                <RichEditor value={sourceDocument} disabled={loading}
                  maxLength={Math.max(0, MAX_TEXT_LENGTH - (diffSource.length - inputValue.length))}
                  label={config.inputLabel} placeholder={config.placeholder}
                  onChange={document => setInput(documentText(document), document)} />

                <div className="workspace-editor-footer">
                  {activeModule === 'text' ? (
                    <label className="workspace-check">
                      <input
                        type="checkbox"
                        checked={preserveFormatting}
                        disabled={loading}
                        onChange={(event) => {
                          setPreserveFormatting(event.target.checked);
                          setTextOutput('');
                          setTextMetadata(null);
                        }}
                      />
                      Mövcud formatı saxla
                    </label>
                  ) : <span />}
                  <span className={inputLength > 9_500 ? 'limit-warning' : ''}>
                    {diffSource.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="workspace-divider" aria-hidden="true" />

              <div className="workspace-editor-column">
                <div className="workspace-column-head">
                  <span>Nəticə</span>
                  {output && <button type="button" className="workspace-icon-btn"
                    onClick={() => setEditingOutput(value => !value)}>
                    {editingOutput ? 'Dəyişiklikləri göstər' : 'Formatı redaktə et'}
                  </button>}
                  <button
                    type="button"
                    className="workspace-icon-btn"
                    onClick={copyOutput}
                    disabled={!output}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                    {copied ? 'Kopyalandı' : 'Kopyala'}
                  </button>
                </div>

                <div className="workspace-output" aria-live="polite">
                  {output && editingOutput ? (
                    <RichEditor value={outputDocument} label="Nəticəni redaktə et"
                      onChange={document => {
                        const value = documentText(document);
                        if (activeModule === 'text') {
                          setTextOutputDocument(document);
                          setTextOutput(value);
                          setTextMetadata(null);
                        } else {
                          setMailOutputDocument(document);
                          setMailOutput(value);
                          setMailMetadata(null);
                        }
                      }} />
                  ) : output ? (
                    <pre>
                      {animatedOutput.map((part, index) => (
                        <span
                          key={`${index}-${part.text}`}
                          className={part.changed ? 'workspace-diff-change' : undefined}
                          style={part.changed ? { animationDelay: `${Math.min(index, 36) * 18}ms` } : undefined}
                        >
                          {part.text}
                        </span>
                      ))}
                    </pre>
                  ) : (
                    <span className="workspace-placeholder">Nəticə burada görünəcək.</span>
                  )}
                </div>
              </div>
            </div>

            {error && <div className="workspace-error" role="alert">{error}</div>}

            <div className="workspace-changelog">
              <div className="workspace-changelog-head">
                Emal məlumatı
                <span className="workspace-change-count">
                  {metadata?.correctionsMade ?? 0} dəyişiklik
                </span>
              </div>
              {metadata ? (
                <div className="workspace-stats">
                  <span className="workspace-stat-chip">
                    <span className="workspace-dot accent" />
                    Təxminən <b>{metadata.correctionsMade}</b> dəyişmiş token
                  </span>
                  <span className="workspace-stat-chip">
                    <span className="workspace-dot success" />
                    <b>{metadata.executionTimeMs}</b> ms
                  </span>
                  <span className="workspace-stat-chip">
                    <span className="workspace-dot muted" />
                    Emal dili: <b>{(metadata.processingLanguage ?? metadata.detectedLanguage).toUpperCase()}</b>
                  </span>
                </div>
              ) : (
                <span className="workspace-changelog-empty">Hələ emal aparılmayıb.</span>
              )}
            </div>

            <div className="workspace-disclaimer">
              Mətn lokal qayda mühərriki ilə emal olunur. Qeyri-müəyyən sözlər mümkün qədər dəyişdirilmir.
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
