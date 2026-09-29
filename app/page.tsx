'use client';

import { BrandEmoji } from '@/components/BrandEmoji';
import { RichEditor } from '@/components/RichEditor';
import { Check, Copy, FileText, Info, Mail, Moon, Sun, Trash2, BookOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { getStrategyRegistry } from '@/lib/strategies/bootstrap';
import { buildAnimatedDiff } from '@/lib/ui/text-diff';
import type { TransformationMetadata } from '@/lib/strategies/types';
import { MAX_TEXT_LENGTH } from '@/lib/editor/correct';
import { applyPersonalLexicon, confirmPersonalCandidate, dismissPersonalCandidate,
  extractPersonalCandidates, queuePersonalCandidates, readPersonalLexicon,
  writePersonalLexicon, type PersonalLexicon } from '@/lib/editor/personal-lexicon';
import { shouldSubmitEditorKey } from '@/lib/ui/editor-keys';
import { findExpectedResult, readExpectedResults, saveExpectedResult, writeExpectedResults,
  type ExpectedResult } from '@/lib/editor/expected-results';
import { documentHTML, documentText, plainDocument, type RichDocument } from '@/lib/ui/rich-document';

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
  const [mailSubject, setMailSubject] = useState('');
  const [textOutput, setTextOutput] = useState('');
  const [mailOutput, setMailOutput] = useState('');
  const [textGenerated, setTextGenerated] = useState('');
  const [mailGenerated, setMailGenerated] = useState('');
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
  const [showResultInfo, setShowResultInfo] = useState(false);
  const [personalLexicon, setPersonalLexicon] = useState<PersonalLexicon>({ pending: [], confirmed: [] });
  const personalRef = useRef<PersonalLexicon>({ pending: [], confirmed: [] });
  const expectedRef = useRef<ExpectedResult[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [expectedDraft, setExpectedDraft] = useState('');
  const [resultSource, setResultSource] = useState<Pick<ExpectedResult, 'module' | 'input' | 'preserveFormatting'> | null>(null);
  const sourceRef = useRef<Partial<Record<ModuleId, Pick<ExpectedResult, 'module' | 'input' | 'preserveFormatting'>>>>({});
  const [learnedResult, setLearnedResult] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const loaded = readPersonalLexicon(window.localStorage);
        personalRef.current = loaded;
        setPersonalLexicon(loaded);
        expectedRef.current = readExpectedResults(window.localStorage);
      } catch { /* Private browsing may disable storage. The editor still works. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

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
  const generated = activeModule === 'text' ? textGenerated : mailGenerated;
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

  function setInput(value: string) {
    if (value.length > MAX_TEXT_LENGTH) return;
    setError('');
    setCopied(false);
    setEditingOutput(false);
    setFeedbackOpen(false);
    setResultSource(null);
    delete sourceRef.current[activeModule];
    if (activeModule === 'text') {
      setTextValue(value);
      setTextOutput('');
      setTextMetadata(null);
    } else {
      setMailValue(value);
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
    setFeedbackOpen(false);
    setLearnedResult(false);
    setResultSource(sourceRef.current[module] ?? null);
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('lazyai-theme', next);
    } catch {}
  }

  function persistPersonal(next: PersonalLexicon) {
    personalRef.current = next;
    setPersonalLexicon(next);
    let saved = false;
    try { saved = writePersonalLexicon(window.localStorage, next); } catch { /* Storage blocked. */ }
    if (!saved) {
      setError('Şəxsi lüğət bu brauzerdə saxlanmadı. Yaddaş icazəsini yoxlayın.');
    }
  }

  function collectSuggestions() {
    if (!generated || !output || generated === output) return;
    const candidates = extractPersonalCandidates(generated, output);
    if (candidates.length) persistPersonal(queuePersonalCandidates(personalRef.current, candidates));
  }

  function saveExpected() {
    if (!resultSource || !expectedDraft.trim()) {
      setError('Düzgün nəticəni yazın.');
      return;
    }
    try {
      const next = saveExpectedResult(expectedRef.current, { ...resultSource, output: expectedDraft });
      if (!writeExpectedResults(window.localStorage, next)) {
        setError('Nümunə saxlanmadı. Brauzer yaddaşını yoxlayın.');
        return;
      }
      expectedRef.current = next;
      setError('');
      setFeedbackOpen(false);
      setLearnedResult(true);
      if (activeModule === 'text') {
        setTextOutput(expectedDraft);
        setTextOutputDocument(plainDocument(expectedDraft));
        setTextMetadata(null);
      } else {
        setMailOutput(expectedDraft);
        setMailOutputDocument(plainDocument(expectedDraft));
        setMailMetadata(null);
      }
      setEditingOutput(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nümunə saxlanmadı.');
    }
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

      const source = { module: activeModule, input: requestText,
        preserveFormatting: activeModule === 'text' && preserveFormatting };
      const remembered = findExpectedResult(expectedRef.current, source);
      setResultSource(source);
      sourceRef.current[activeModule] = source;
      setFeedbackOpen(false);
      setLearnedResult(Boolean(remembered));

      if (remembered) {
        if (activeModule === 'text') {
          setTextGenerated(remembered.output);
          setTextOutput(remembered.output);
          setTextOutputDocument(plainDocument(remembered.output));
          setTextMetadata(null);
        } else {
          setMailGenerated(remembered.output);
          setMailOutput(remembered.output);
          setMailOutputDocument(plainDocument(remembered.output));
          setMailMetadata(null);
        }
        setEditingOutput(false);
        return;
      }

      const result = await registry.get(config.strategyId).transform({
        text: requestText,
        options: activeModule === 'text' ? { preserveFormatting } : undefined,
      });

      const improved = applyPersonalLexicon(result.transformedText, personalRef.current.confirmed);
      if (activeModule === 'text') {
        setTextGenerated(improved);
        setTextOutput(improved);
        setTextOutputDocument(plainDocument(improved));
        setEditingOutput(false);
        setTextMetadata(result.metadata);
      } else {
        setMailGenerated(improved);
        setMailOutput(improved);
        setMailOutputDocument(plainDocument(improved));
        setEditingOutput(false);
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
                    setFeedbackOpen(false);
                    setResultSource(null);
                    delete sourceRef.current.mail;
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

                <textarea
                  className="workspace-raw-input"
                  aria-label={config.inputLabel}
                  placeholder={config.placeholder}
                  value={inputValue}
                  disabled={loading}
                  maxLength={Math.max(0, MAX_TEXT_LENGTH - (diffSource.length - inputValue.length))}
                  onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (shouldSubmitEditorKey({ key: event.key, shiftKey: event.shiftKey,
                      altKey: event.altKey, isComposing: event.nativeEvent.isComposing })) {
                      event.preventDefault();
                      void transform();
                    }
                  }}
                />

                <div className="workspace-editor-footer">
                  <span className="workspace-key-hint">Enter — düzəlt · Shift+Enter — yeni sətir</span>
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
                          setFeedbackOpen(false);
                          setResultSource(null);
                          delete sourceRef.current.text;
                        }}
                      />
                      Mövcud abzasları saxla
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
                  <div className="workspace-result-label">
                    <span>Nəticə</span>
                    <button type="button" className="workspace-result-info-button"
                      aria-label="Nəticə haqqında məlumat" aria-expanded={showResultInfo}
                      aria-controls="workspace-result-info"
                      onClick={() => setShowResultInfo(value => !value)}>
                      <Info size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {output && <button type="button" className="workspace-icon-btn"
                    onClick={() => setEditingOutput(value => !value)}>
                    {editingOutput ? 'Dəyişiklikləri göstər' : 'Nəticəni redaktə et'}
                  </button>}
                  {output && <button type="button" className="workspace-icon-btn"
                    aria-expanded={feedbackOpen} aria-controls="workspace-expected-form"
                    onClick={() => {
                      setExpectedDraft(output);
                      setFeedbackOpen(value => !value);
                    }}>
                    <BookOpen size={15} /> Düzgün nəticəni öyrət
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

                {showResultInfo && (
                  <p id="workspace-result-info" className="workspace-result-info">
                    Qırmızı işarələr dəyişən sözləri və əlavə olunan durğu işarələrini göstərir.
                    Nəticəni redaktə et düyməsi yalnız nəticəyə tətbiq olunur. Kopyala həm mətn,
                    həm də seçdiyiniz nəticə formatını mümkün olduqda köçürür. Nəticədə düzəltdiyiniz
                    tək sözlər şəxsi lüğətə namizəd olur; yalnız təsdiqləyəndən sonra oxşar kontekstdə işlənir.
                  </p>
                )}

                <div className="workspace-output" aria-live="polite">
                  {output && editingOutput ? (
                    <RichEditor value={outputDocument} label="Nəticəni redaktə et"
                      onBlur={collectSuggestions}
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

                {learnedResult && output && <p className="workspace-learned-note">Bu nəticə saxladığınız nümunədən götürülüb.</p>}
                {feedbackOpen && output && (
                  <div className="workspace-feedback" id="workspace-expected-form">
                    <label htmlFor="workspace-expected-text">Bu giriş üçün nəticə necə olmalıdır?</label>
                    <textarea id="workspace-expected-text" value={expectedDraft} maxLength={MAX_TEXT_LENGTH}
                      onChange={event => setExpectedDraft(event.target.value)} />
                    <p>Eyni mətn və modul yenidən göndəriləndə bu nəticə istifadə olunacaq. Nümunə yalnız bu brauzerdə saxlanır.</p>
                    <button type="button" className="workspace-feedback-save" onClick={saveExpected}>Düzgün nəticəni saxla</button>
                  </div>
                )}

                {(personalLexicon.pending.length > 0 || personalLexicon.confirmed.length > 0) && (
                  <details className="workspace-personal-lexicon">
                    <summary>Şəxsi lüğət · {personalLexicon.pending.length} namizəd,
                      {' '}{personalLexicon.confirmed.length} təsdiqli</summary>
                    <p>Yalnız bu brauzerdə saxlanır. Yeni sözlər əsas lüğətə avtomatik əlavə olunmur.</p>
                    {personalLexicon.pending.map((rule, index) => (
                      <div className="workspace-personal-rule" key={`pending-${index}-${rule.source}-${rule.target}`}>
                        <span>{rule.source} → {rule.target}</span>
                        <button type="button" onClick={() => persistPersonal(confirmPersonalCandidate(personalRef.current, rule))}
                          aria-label={`${rule.source} sözünün ${rule.target} düzəlişini təsdiqlə`}>Təsdiqlə</button>
                        <button type="button" onClick={() => persistPersonal(dismissPersonalCandidate(personalRef.current, rule))}
                          aria-label={`${rule.source} namizədini sil`}>Sil</button>
                      </div>
                    ))}
                    {personalLexicon.confirmed.map((rule, index) => (
                      <div className="workspace-personal-rule" key={`confirmed-${index}-${rule.source}-${rule.target}`}>
                        <span>{rule.source} → {rule.target}</span>
                        <button type="button" onClick={() => persistPersonal({ ...personalRef.current,
                          confirmed: personalRef.current.confirmed.filter(item => item !== rule) })}
                          aria-label={`${rule.source} təsdiqli düzəlişini sil`}>Sil</button>
                      </div>
                    ))}
                  </details>
                )}
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
