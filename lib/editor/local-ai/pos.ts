/** Small lexical/suffix HMM, trained from attributed UD POS annotations. */
export interface POSToken { word: string; lemma: string; pos: string }
export interface POSModel {
  version: 1; license: 'CC-BY-SA-4.0'; tags: string[];
  words: Record<string, Record<string, number>>;
  suffixes: Record<string, Record<string, number>>;
  transitions: Record<string, Record<string, number>>;
  totals: Record<string, number>; lemmas: Record<string, string[]>;
}
const lower = (text: string) => text.normalize('NFC').toLocaleLowerCase('az-AZ');
export function trainPOS(sentences: readonly POSToken[][]): POSModel {
  const model: POSModel = { version: 1, license: 'CC-BY-SA-4.0', tags: [], words: {}, suffixes: {}, transitions: {}, totals: {}, lemmas: {} };
  const add = (table: Record<string, Record<string, number>>, key: string, label: string) => {
    table[key] ??= {}; table[key][label] = (table[key][label] ?? 0) + 1;
  };
  for (const sentence of sentences) {
    let previous = '<s>';
    for (const token of sentence) {
      const word = lower(token.word);
      add(model.words, word, token.pos); add(model.transitions, previous, token.pos);
      for (const size of [2, 3, 4]) if (word.length >= size) add(model.suffixes, word.slice(-size), token.pos);
      model.totals[token.pos] = (model.totals[token.pos] ?? 0) + 1;
      model.lemmas[word] = [...new Set([...(model.lemmas[word] ?? []), lower(token.lemma)])];
      previous = token.pos;
    }
    add(model.transitions, previous, '</s>');
  }
  model.tags = Object.keys(model.totals).sort();
  return model;
}
export interface POSDecision { tag: string; alternatives: string[]; lemma?: string }
export function tagPOS(model: POSModel, words: readonly string[]): POSDecision[] {
  if (!words.length || !model.tags.length) return words.map(() => ({ tag: 'X', alternatives: [] }));
  let scores: Record<string, number> = { '<s>': 0 };
  const backs: Record<string, string>[] = [];
  const possible: string[][] = [];
  for (const raw of words) {
    const word = lower(raw), lexical = model.words[word];
    const tags = lexical ? Object.keys(lexical) : model.tags;
    possible.push(tags);
    const suffix = [4, 3, 2].map(size => word.length >= size ? model.suffixes[word.slice(-size)] : undefined).find(Boolean);
    const evidence = lexical ?? suffix ?? model.totals;
    const total = Object.values(evidence).reduce((a, b) => a + b, 0);
    const next: Record<string, number> = {}, back: Record<string, string> = {};
    for (const tag of tags) {
      const emission = Math.log(((evidence[tag] ?? 0) + 0.2) / (total + model.tags.length * 0.2));
      let best = -Infinity, winner = '<s>';
      for (const [previous, value] of Object.entries(scores)) {
        const transitions = model.transitions[previous] ?? {};
        const count = Object.values(transitions).reduce((a, b) => a + b, 0);
        const score = value + Math.log(((transitions[tag] ?? 0) + 0.5) / (count + (model.tags.length + 1) * 0.5)) + emission;
        if (score > best) { best = score; winner = previous; }
      }
      next[tag] = best; back[tag] = winner;
    }
    scores = next; backs.push(back);
  }
  let last = Object.keys(scores).sort((a, b) => {
    const terminal = (tag: string) => Math.log(((model.transitions[tag]?.['</s>'] ?? 0) + 0.5)
      / (Object.values(model.transitions[tag] ?? {}).reduce((x, y) => x + y, 0) + (model.tags.length + 1) * 0.5));
    return scores[b] + terminal(b) - scores[a] - terminal(a);
  })[0];
  const output: POSDecision[] = [];
  for (let at = words.length - 1; at >= 0; at--) {
    const lemmas = model.lemmas[lower(words[at])];
    output[at] = { tag: last, alternatives: possible[at], ...(lemmas?.length === 1 ? { lemma: lemmas[0] } : {}) };
    last = backs[at][last];
  }
  return output;
}
