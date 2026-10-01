/** Small nonlinear MLP. Training and inference use bounded ordinary arrays. */
export interface Network { inputs: number; hidden: number; w1: number[]; b1: number[]; w2: number[]; b2: number; epochs: number }
export interface Example { x: number[]; y: number }
export function createNetwork(inputs: number, hidden = 12, seed = 201): Network {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 - 0.5; };
  return { inputs, hidden, w1: Array.from({ length: inputs * hidden }, () => random() * Math.sqrt(6 / inputs)),
    b1: Array(hidden).fill(0), w2: Array.from({ length: hidden }, () => random() * 0.2), b2: 0, epochs: 0 };
}
function hiddenValues(model: Network, x: readonly number[]): number[] {
  if (x.length !== model.inputs) throw new Error('Neural feature dimensions do not match.');
  return model.b1.map((bias, at) => Math.tanh(x.reduce((sum, value, i) => sum + value * model.w1[at * model.inputs + i], bias)));
}
export function predictNetwork(model: Network, x: readonly number[]): number {
  const hidden = hiddenValues(model, x);
  const score = hidden.reduce((sum, value, i) => sum + value * model.w2[i], model.b2);
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, score))));
}
export function trainNetwork(model: Network, examples: readonly Example[], epochs: number): void {
  if (!examples.length || !Number.isInteger(epochs) || epochs < 1 || epochs > 200) throw new Error('Invalid bounded neural training request.');
  for (let step = 0; step < epochs; step++) {
    const epoch = model.epochs, rate = 0.025 / (1 + epoch / 40);
    for (let k = 0; k < examples.length; k++) {
      const { x, y } = examples[(k + epoch * 137) % examples.length];
      const hidden = hiddenValues(model, x);
      const score = hidden.reduce((sum, value, i) => sum + value * model.w2[i], model.b2);
      const error = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, score)))) - y;
      const deltas = hidden.map((value, at) => error * model.w2[at] * (1 - value * value));
      for (let at = 0; at < model.hidden; at++) {
        model.w2[at] -= rate * (error * hidden[at] + 0.0001 * model.w2[at]);
        model.b1[at] -= rate * deltas[at];
        for (let i = 0; i < model.inputs; i++) model.w1[at * model.inputs + i] -= rate * (deltas[at] * x[i] + 0.0001 * model.w1[at * model.inputs + i]);
      }
      model.b2 -= rate * error;
    }
    model.epochs++;
  }
}
export function parameterCount(model: Network): number { return model.w1.length + model.b1.length + model.w2.length + 1; }
