import * as z from 'zod';
export const MAX_INPUT_LENGTH = 10_000;
export const transformationSchema = z.object({
  strategyId: z.string().trim().min(1).max(64),
  text: z.string().max(MAX_INPUT_LENGTH, 'Mətn maksimum 10 000 simvol ola bilər.')
    .refine(text => text.trim().length > 0, 'Mətn boş ola bilməz.'),
  options: z.object({
    tone: z.enum(['default', 'formal', 'casual']).optional(),
    preserveFormatting: z.boolean().optional(),
    customRules: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
  }).strict().optional(),
}).strict();
