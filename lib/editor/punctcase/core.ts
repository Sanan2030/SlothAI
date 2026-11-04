import info from './model-info.json';

type TensorName = keyof typeof info.tensors;
export interface TagLogits { punctuation: number[][]; case: number[][] }
export const punctCaseLower = (text: string): string => text.normalize('NFC').replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
// Python [^\W\d_]: Unicode letters and non-decimal numbers, without combining marks.
export const punctCaseWordPattern = (): RegExp => /[\p{L}\p{Nl}\p{No}]+/gu;
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

/** Original float32 checkpoint: character CNN, masked max pool, bidirectional PyTorch GRU. */
export class PunctCaseModel {
  private readonly tensors = new Map<TensorName, Float32Array>();
  private readonly characters = new Map(Array.from(info.characters, (char, at) => [char, at + 2]));
  constructor(values: Float32Array) {
    if (values.length !== info.parameters || values.some(value => !Number.isFinite(value))) throw new Error('PunctCase çəkiləri uyğun deyil.');
    let end = 0;
    for (const name of Object.keys(info.tensors) as TensorName[]) {
      const tensor = info.tensors[name], size = tensor.shape.reduce((a, b) => a * b, 1);
      if (tensor.offset !== end) throw new Error('PunctCase tensor sərhədi uyğun deyil.');
      this.tensors.set(name, values.slice(end, end + size)); end += size;
    }
    if (end !== values.length) throw new Error('PunctCase tensor ölçüsü uyğun deyil.');
  }
  private tensor(name: TensorName): Float32Array { return this.tensors.get(name)!; }
  private linear(input: ArrayLike<number>, weights: Float32Array, bias: Float32Array): Float32Array {
    const output = new Float32Array(bias.length);
    for (let row = 0; row < output.length; row++) {
      let sum = bias[row];
      for (let column = 0; column < input.length; column++) sum += weights[row * input.length + column] * input[column];
      output[row] = sum;
    }
    return output;
  }
  private encode(word: string): Float32Array {
    const { charEmbedding: embedding, charChannels: channels, maxWordChars: width } = info.config;
    const ids = Array.from(word).slice(0, width).map(char => this.characters.get(char) ?? 1);
    const table = this.tensor('encoder.embedding.weight');
    const pooled = new Float32Array(channels * 2);
    for (const [head, kernel] of [3, 5].entries()) {
      const weights = this.tensor(kernel === 3 ? 'encoder.conv3.weight' : 'encoder.conv5.weight');
      const bias = this.tensor(kernel === 3 ? 'encoder.conv3.bias' : 'encoder.conv5.bias');
      const pad = (kernel - 1) / 2;
      for (let channel = 0; channel < channels; channel++) {
        let maximum = 0; // ReLU and the all-padding masked-pool convention.
        for (let at = 0; at < ids.length; at++) {
          let sum = bias[channel];
          for (let feature = 0; feature < embedding; feature++) {
            const offset = (channel * embedding + feature) * kernel;
            for (let k = 0; k < kernel; k++) {
              const position = at + k - pad;
              if (position >= 0 && position < ids.length) sum += weights[offset + k] * table[ids[position] * embedding + feature];
            }
          }
          maximum = Math.max(maximum, sum);
        }
        pooled[head * channels + channel] = maximum;
      }
    }
    return this.linear(pooled, this.tensor('encoder.project.weight'), this.tensor('encoder.project.bias')).map(Math.tanh);
  }
  private recurrent(embeddings: Float32Array[], reverse: boolean): Float32Array[] {
    const hidden = info.config.taggerHidden, suffix = reverse ? '_reverse' : '';
    const inputWeight = this.tensor(('context.weight_ih_l0' + suffix) as TensorName);
    const hiddenWeight = this.tensor(('context.weight_hh_l0' + suffix) as TensorName);
    const inputBias = this.tensor(('context.bias_ih_l0' + suffix) as TensorName);
    const hiddenBias = this.tensor(('context.bias_hh_l0' + suffix) as TensorName);
    const result = Array<Float32Array>(embeddings.length);
    let previous = new Float32Array(hidden);
    for (let step = 0; step < embeddings.length; step++) {
      const at = reverse ? embeddings.length - step - 1 : step;
      const x = this.linear(embeddings[at], inputWeight, inputBias);
      const h = this.linear(previous, hiddenWeight, hiddenBias);
      const next = new Float32Array(hidden);
      for (let i = 0; i < hidden; i++) {
        const reset = sigmoid(x[i] + h[i]), update = sigmoid(x[hidden + i] + h[hidden + i]);
        const candidate = Math.tanh(x[hidden * 2 + i] + reset * h[hidden * 2 + i]);
        next[i] = (1 - update) * candidate + update * previous[i];
      }
      result[at] = next; previous = next;
    }
    return result;
  }
  /** At most one trained 96-token chunk. The caller owns document chunk boundaries. */
  predict(words: readonly string[], cache = new Map<string, Float32Array>()): TagLogits {
    if (words.length > info.config.maxSentenceTokens) throw new Error('PunctCase token həddi keçildi.');
    if (!words.length) return { punctuation: [], case: [] };
    const embeddings = words.map(raw => {
      const word = punctCaseLower(raw);
      let value = cache.get(word);
      if (!value) {
        value = this.encode(word);
        if (cache.size < 2000) cache.set(word, value);
      }
      return value;
    });
    const forward = this.recurrent(embeddings, false), reverse = this.recurrent(embeddings, true);
    const punctuation: number[][] = [], cases: number[][] = [];
    for (let at = 0; at < words.length; at++) {
      const context = new Float32Array(info.config.taggerHidden * 2);
      context.set(forward[at]); context.set(reverse[at], info.config.taggerHidden);
      punctuation.push(Array.from(this.linear(context, this.tensor('punctuation.weight'), this.tensor('punctuation.bias'))));
      cases.push(Array.from(this.linear(context, this.tensor('case.weight'), this.tensor('case.bias'))));
    }
    return { punctuation, case: cases };
  }
}

export function tagProbabilities(logits: readonly number[]): number[] {
  const maximum = Math.max(...logits), values = logits.map(value => Math.exp(value - maximum));
  const sum = values.reduce((total, value) => total + value, 0);
  return values.map(value => value / sum);
}
