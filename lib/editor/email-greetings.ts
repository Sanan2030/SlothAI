export const EMAIL_GREETINGS = [
  'Salam, hər vaxtınız xeyir.',
  'Salam,',
  'Hər vaxtınız xeyir.',
  'Hörmətli həmkarlar,',
  'Hörmətli tərəfdaşlar,',
  'Hörmətli müştəri,',
] as const;

export type EmailGreeting = (typeof EMAIL_GREETINGS)[number];
export const DEFAULT_EMAIL_GREETING: EmailGreeting = EMAIL_GREETINGS[0];

export function isEmailGreeting(value: unknown): value is EmailGreeting {
  return typeof value === 'string' && EMAIL_GREETINGS.some(greeting => greeting === value);
}
