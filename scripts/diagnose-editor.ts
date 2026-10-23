/** Explicit local CLI only: reports may contain document text; no telemetry. */
import { readFileSync, writeFileSync } from 'node:fs';
import { correctText, type CorrectionRuntime } from '../lib/editor/correct';
import type { EditorDiagnostic } from '../lib/editor/diagnostics';

const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const file = argument('input');
const text = file ? readFileSync(file, 'utf8') : argument('text');
if (!text?.trim()) throw new Error('İstifadə: npm run editor:diagnose -- --input=/mətn.txt [--out=/hesabat.json]');
const rules: CorrectionRuntime = { useLocalModel: false, useObservedChannel: false, useWordLM: false };
const policies: Record<string, CorrectionRuntime> = {
  rules,
  wordlm: { ...rules, useWordLM: true },
  full: {},
  experimental: { wordLMMode: 'experimental' },
};
const modes = Object.entries(policies).map(([mode, options]) => {
  const decisions: EditorDiagnostic[] = [];
  const result = correctText(text, false, { ...options, diagnostics: event => decisions.push(event) });
  return { mode, ...result, decisions };
});
const report = { scope: 'Local engine diagnostics; rules mode retains morphology and artifact-derived lexical evidence.',
  offsets: 'Stage edits use offsets in their own input. rawStart refers to the literal-shielded original spelling snapshot; no document-global offset claim.',
  scoreMeaning: 'Relative LM/edit-channel rankings; not correctness probabilities.', input: text, modes };
const json = JSON.stringify(report, null, 2) + '\n';
const output = argument('out');
if (output) { writeFileSync(output, json); console.log(output); } else process.stdout.write(json);
