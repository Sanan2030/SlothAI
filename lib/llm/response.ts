import * as z from 'zod';
import { AppError } from '../errors';

export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1].trim() ?? trimmed;
}
const schema = z.object({
  transformedText: z.string().min(1).max(60_000).refine(value => value.trim().length > 0),
  correctionsCount: z.number().int().nonnegative().max(100_000),
});
export function parseTransformationResponse(raw: string) {
  let value: unknown;
  try {
    value = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new AppError('LLM_INVALID_JSON', 'Modelin cavabı düzgün JSON formatında deyil. Yenidən cəhd edin.');
  }
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('LLM_INVALID_RESPONSE', 'Modelin cavabında tələb olunan mətn və ya düzəliş sayı yoxdur.');
  return result.data;
}
