/** Normalized pruned Kneser-Ney backoff; no network, SQLite or Python at inference. */
export interface WordLMArtifact {
  schemaVersion: number;
  words: string[];
  unigrams: number[];
  contexts2: number[][];
  bigrams: number[][];
  contexts3: number[][];
  trigrams: number[][];
}
const suffixes = ['lardan', 'lərdən', 'larının', 'lərinin', 'ları', 'ləri', 'ların', 'lərin',
  'lara', 'lərə', 'dan', 'dən', 'da', 'də', 'lar', 'lər', 'dır', 'dir', 'dur', 'dür'];
export const wordLMTokens = (text: string): string[] =>
  // Python [^\W\d_]+ retains Unicode letter/other numbers (e.g. Roman numerals),
  // while decimal digits and underscores delimit tokens.
  (text.normalize('NFC').match(/[\p{L}\p{Nl}\p{No}]+/gu) ?? []).map(word => word.toLocaleLowerCase('az-AZ'));

export class BrowserWordLM {
  private ids: Map<string, number>;
  private contexts2: Map<number, number>;
  private contexts3: Map<string, number>;
  private bigrams: Map<string, number>;
  private trigrams: Map<string, number>;
  constructor(private artifact: WordLMArtifact) {
    if (artifact.schemaVersion !== 1) throw new Error('Unsupported WordLM schema');
    this.ids = new Map(artifact.words.map((word, i) => [word, i]));
    this.contexts2 = new Map(artifact.contexts2.map(([a, mass]) => [a, mass]));
    this.contexts3 = new Map(artifact.contexts3.map(([a, b, mass]) => [`${a}:${b}`, mass]));
    this.bigrams = new Map(artifact.bigrams.map(([a, b, probability]) => [`${a}:${b}`, probability]));
    this.trigrams = new Map(artifact.trigrams.map(([a, b, c, probability]) => [`${a}:${b}:${c}`, probability]));
  }
  mapped(word: string): number {
    const lower = word.normalize('NFC').toLocaleLowerCase('az-AZ');
    const known = this.ids.get(lower);
    if (known !== undefined) return known;
    const suffix = suffixes.find(value => lower.endsWith(value) && lower.length > value.length + 2);
    return (suffix ? this.ids.get(`<suffix:${suffix}>`) : undefined) ?? this.ids.get('<unk>')!;
  }
  probability(left: number, previous: number, word: number): number {
    const unigram = this.artifact.unigrams[word] ?? 0;
    const bigram = (this.bigrams.get(`${previous}:${word}`) ?? 0)
      + (this.contexts2.get(previous) ?? 1) * unigram;
    return (this.trigrams.get(`${left}:${previous}:${word}`) ?? 0)
      + (this.contexts3.get(`${left}:${previous}`) ?? 1) * bigram;
  }
  /** Compare only the three predictions affected by a replacement, at most 8 candidates. */
  rank(left: readonly string[], candidates: readonly string[], right: readonly string[]) {
    const history = ['<s>', '<s>', ...left.slice(-2)].slice(-2).map(w => this.mapped(w));
    return [...new Set(candidates)].slice(0, 8).map(word => {
      const sequence = [...history, this.mapped(word), ...right.slice(0, 2).map(w => this.mapped(w))];
      let score = 0;
      let evidence = false;
      const lexical = (id: number) => this.artifact.words[id] === '<s>'
        || (this.artifact.words[id] !== undefined && !this.artifact.words[id].startsWith('<'));
      for (let i = 2; i < sequence.length; i++) {
        const [a, b, c] = sequence.slice(i - 2, i + 1);
        const p = this.probability(a, b, c);
        score += p > 0 ? Math.log(p) : -Infinity;
        // A generic OOV/suffix class is not evidence about this lexical context.
        evidence ||= (lexical(a) && lexical(b) && lexical(c) && this.trigrams.has(`${a}:${b}:${c}`))
          || (i < 4 && lexical(b) && lexical(c) && this.bigrams.has(`${b}:${c}`));
      }
      return { word, score, evidence: evidence && this.artifact.words[sequence[2]] === word };
    }).sort((a, b) => b.score - a.score || a.word.localeCompare(b.word, 'az'));
  }
}
