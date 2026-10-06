'use client';

import { BrandEmoji } from '@/components/BrandEmoji';
import { RichEditor } from '@/components/RichEditor';
import { Check, Copy, Download, FileText, Info, Mail, Moon, Sun, Trash2, BookOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { EditorClient } from '@/lib/workers/editor-client';
import { buildAnimatedDiff } from '@/lib/ui/text-diff';
import type { TransformationMetadata } from '@/lib/strategies/types';
import { MAX_TEXT_LENGTH } from '@/lib/editor/limits';
import { DEFAULT_EMAIL_GREETING, EMAIL_GREETINGS, type EmailGreeting } from '@/lib/editor/email-greetings';
import { appendTransformLog, exportTransformLog, readTransformLog, type TransformLogEntry } from '@/lib/editor/transform-log';
import { applyPersonalLexicon, confirmPersonalCandidate, dismissPersonalCandidate,
  extractPersonalCandidates, queuePersonalCandidates, readPersonalLexicon,
  writePersonalLexicon, type PersonalLexicon } from '@/lib/editor/personal-lexicon';
import { shouldSubmitEditorKey } from '@/lib/ui/editor-keys';
import type { ExpectedResult } from '@/lib/editor/expected-results';
import { appendReviewCase, emptyReviewCorpus, type ReviewCorpus } from '@/lib/editor/review-corpus';
import { downloadReviewCorpus, pickReviewFile, readReviewFile, saveReviewToFile,
  type ReviewFileHandle, type ReviewPickerWindow } from '@/lib/ui/review-file';
import { documentHTML, documentText, plainDocument, type RichDocument } from '@/lib/ui/rich-document';

type ModuleId = 'text' | 'mail';
type Theme = 'dark' | 'light';


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
  const editorClient = useRef<EditorClient | null>(null);
  useEffect(() => () => { editorClient.current?.dispose(); editorClient.current = null; }, []);
  const [activeModule, setActiveModule] = useState<ModuleId>('text');
  const [textValue, setTextValue] = useState('');
  const [mailValue, setMailValue] = useState('');
  const [mailGreeting, setMailGreeting] = useState<EmailGreeting>(DEFAULT_EMAIL_GREETING);
  const [logCount, setLogCount] = useState(0);
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
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showResultInfo, setShowResultInfo] = useState(false);
  const [personalLexicon, setPersonalLexicon] = useState<PersonalLexicon>({ pending: [], confirmed: [] });
  const personalRef = useRef<PersonalLexicon>({ pending: [], confirmed: [] });
  const reviewFileRef = useRef<ReviewFileHandle | null>(null);
  const reviewCorpusRef = useRef<ReviewCorpus>(emptyReviewCorpus());
  const reviewImportRef = useRef<HTMLInputElement>(null);
  const savingReviewRef = useRef(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewNotice, setReviewNotice] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [expectedDraft, setExpectedDraft] = useState('');
  const [resultSource, setResultSource] = useState<Pick<ExpectedResult, 'module' | 'input' | 'preserveFormatting' | 'greeting'> | null>(null);
  const sourceRef = useRef<Partial<Record<ModuleId, Pick<ExpectedResult, 'module' | 'input' | 'preserveFormatting' | 'greeting'>>>>({});

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const loaded = readPersonalLexicon(window.localStorage);
        personalRef.current = loaded;
        setPersonalLexicon(loaded);
        setLogCount(readTransformLog(window.localStorage).length);
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

  // A finished draft version is speculative; explicit correction owns the result.
  // Invalidate immediately, before the debounce, so a quick click cannot reuse stale work.
  useEffect(() => {
    editorClient.current?.invalidatePreparation();
    if (loading || composing || !inputValue.trim() || inputValue.length > MAX_TEXT_LENGTH) return;
    const timer = setTimeout(() => {
      editorClient.current ??= new EditorClient();
      editorClient.current.prepare(inputValue);
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, activeModule, loading, composing]);

  const inputLength = useMemo(() => inputValue.length, [inputValue]);
  const diffSource = inputValue;
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
    setReviewNotice('');
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

  function recordTransform(input: string, result: string, source: TransformLogEntry['source']) {
    try {
      const count = appendTransformLog(window.localStorage, {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        at: new Date().toISOString(), module: activeModule,
        input, output: result, ...(activeModule === 'mail' ? { greeting: mailGreeting } : {}), source,
      });
      setLogCount(count);
    } catch {
      setError('Nəticə yaradıldı, lakin günlük brauzerdə saxlanmadı. Yaddaş icazəsini yoxlayın.');
    }
  }

  function downloadLog() {
    try {
      const contents = exportTransformLog(window.localStorage);
      const blob = new Blob([contents], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `slothai-log-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Günlük yüklənmədi. Brauzer yaddaşını yoxlayın.'); }
  }

  async function importReviewFile(file: File) {
    if (savingReviewRef.current) return;
    savingReviewRef.current = true;
    setSavingReview(true);
    try {
      const corpus = await readReviewFile(file);
      reviewCorpusRef.current = corpus;
      reviewFileRef.current = null;
      setReviewNotice(`${corpus.cases.length} nümunə açıldı. Növbəti yükləməyə əlavə olunacaq.`);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Test faylı açılmadı.');
    } finally { savingReviewRef.current = false; setSavingReview(false); }
  }

  async function saveExpected() {
    if (savingReviewRef.current) return;
    if (!resultSource || !expectedDraft.trim()) { setError('Düzgün nəticəni yazın.'); return; }
    const row = { ...resultSource,
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      actual: activeModule === 'text' ? textGenerated : mailGenerated,
      expected: expectedDraft, reviewStatus: 'user-approved' as const, reviewedAt: new Date().toISOString(),
    };
    savingReviewRef.current = true;
    setSavingReview(true);
    setReviewNotice('');
    try {
      // The picker must be called inside the user's click, before asynchronous reads.
      const selected = reviewFileRef.current ?? await pickReviewFile(window as unknown as ReviewPickerWindow);
      if (selected) {
        const corpus = await saveReviewToFile(selected, row, reviewCorpusRef.current);
        reviewFileRef.current = selected;
        reviewCorpusRef.current = corpus;
        setReviewNotice(`${selected.name}: ${corpus.cases.length} nümunə fayla yazıldı.`);
      } else {
        const corpus = appendReviewCase(reviewCorpusRef.current, row);
        downloadReviewCorpus(corpus);
        reviewCorpusRef.current = corpus;
        setReviewNotice(`${corpus.cases.length} nümunəli test faylı yükləmə üçün hazırlandı.`);
      }
      setError('');
      setFeedbackOpen(false);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      // Do not silently fall back to a download after a denied/failed disk write.
      setError(cause instanceof Error ? cause.message : 'Test faylı saxlanmadı.');
    } finally { savingReviewRef.current = false; setSavingReview(false); }
  }

  async function transform() {
    if (!inputValue.trim() || loading || diffSource.length > MAX_TEXT_LENGTH) return;

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const requestText = inputValue;

      const source = { module: activeModule, input: requestText,
        preserveFormatting: activeModule === 'text' && preserveFormatting,
        ...(activeModule === 'mail' ? { greeting: mailGreeting } : {}) };
      setResultSource(source);
      sourceRef.current[activeModule] = source;
      setFeedbackOpen(false);
      setReviewNotice('');

      editorClient.current ??= new EditorClient();
      const result = await editorClient.current.transform(config.strategyId, {
        text: requestText,
        options: activeModule === 'text' ? { preserveFormatting }
          : { emailGreeting: mailGreeting, omitSubject: true },
      });

      const improved = applyPersonalLexicon(result.transformedText, personalRef.current.confirmed);
      recordTransform(requestText, improved, 'transformed');
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
                <label htmlFor="mail-greeting">Salamlaşma</label>
                <select
                  id="mail-greeting"
                  value={mailGreeting}
                  disabled={loading}
                  onChange={(event) => {
                    setMailGreeting(event.target.value as EmailGreeting);
                    setMailOutput('');
                    setMailMetadata(null);
                    setFeedbackOpen(false);
                    setResultSource(null);
                    delete sourceRef.current.mail;
                  }}>
                  {EMAIL_GREETINGS.map(greeting => <option key={greeting} value={greeting}>{greeting}</option>)}
                </select>
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
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
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
                    <BookOpen size={15} /> Düzgün nəticəni testə əlavə et
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

                {reviewNotice && <p className="workspace-learned-note" role="status">{reviewNotice}</p>}
                {feedbackOpen && output && (
                  <div className="workspace-feedback" id="workspace-expected-form">
                    <label htmlFor="workspace-expected-text">Bu giriş üçün nəticə necə olmalıdır?</label>
                    <textarea id="workspace-expected-text" value={expectedDraft} maxLength={MAX_TEXT_LENGTH}
                      onChange={event => setExpectedDraft(event.target.value)} />
                    <p>Xam mətn, proqramın nəticəsi və düzgün nəticə test üçün JSON faylına yazılır. Bu düymə redaktoru öyrətmir. Fayl seçimi dəstəklənmirsə, fayl yüklənir. Sabah davam etmək üçün eyni faylı seç və ya mövcud faylı aç.</p>
                    <button type="button" className="workspace-feedback-save" disabled={savingReview} onClick={saveExpected}>{savingReview ? 'Saxlanır…' : 'Düzgün nəticəni fayla saxla'}</button>
                    <button type="button" disabled={savingReview} onClick={() => reviewImportRef.current?.click()}>Mövcud test faylını aç</button>
                    <input ref={reviewImportRef} type="file" accept=".json,application/json" hidden
                      onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importReviewFile(file); }} />
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
            <div className="workspace-log-actions">
              <span>Bu brauzerdə {logCount} giriş/nəticə qeydi saxlanır.</span>
              <button type="button" className="workspace-icon-btn" onClick={downloadLog} disabled={!logCount}>
                <Download size={15} /> Günlüyü yüklə
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
