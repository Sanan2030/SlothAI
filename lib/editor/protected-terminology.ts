export const PROTECTED_TERMINOLOGY = {
  programming: [
    'API', 'REST', 'REST API', 'JSON', 'XML', 'YAML', 'SQL', 'NoSQL',
    'Java', 'Python', 'JavaScript', 'TypeScript', 'C#', 'C++', '.NET',
    'PHP', 'HTML', 'CSS', 'React', 'Next.js', 'Node.js', 'Spring Boot',
    'FastAPI', 'Pydantic', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
    'RabbitMQ', 'Kafka', 'gRPC', 'GraphQL', 'WebSocket', 'OpenAPI',
  ],
  infrastructure: [
    'Docker', 'Kubernetes', 'Vercel', 'GitHub', 'GitLab', 'Linux', 'Ubuntu',
    'CI/CD', 'DevOps', 'TLS', 'SSL', 'RBAC', 'OAuth', 'OAuth2', 'JWT',
    '2FA', 'SLA', 'HTTP', 'HTTPS', 'TCP', 'IP', 'DNS', 'CDN',
    'Prometheus', 'Grafana',
  ],
  banking: [
    'IBAN', 'SWIFT', 'BIC', 'ATM', 'POS', 'OTP', 'PIN', 'CVV', 'CVC',
    'KYC', 'AML', 'SEPA', 'PCI DSS', 'PSD2', 'ISO 20022', 'AZN',
    'Visa', 'Mastercard', 'Open Banking', 'Core Banking', 'FinTech',
    'chargeback', 'acquiring', 'issuing', 'settlement', 'merchant',
    'transaction', 'ledger',
  ],
  business: [
    'CRM', 'ERP', 'BPMN', 'UML', 'UAT', 'KPI', 'OKR', 'Jira', 'Confluence',
    'Figma', 'Agile', 'Scrum', 'Sprint', 'Backlog', 'Product Owner',
  ],
} as const;

export type ProtectedTerminologyGroup = keyof typeof PROTECTED_TERMINOLOGY;

const canonicalByLower = new Map<string, string>();
for (const terms of Object.values(PROTECTED_TERMINOLOGY)) {
  for (const term of terms) canonicalByLower.set(term.toLocaleLowerCase('en-US'), term);
}

export const PROTECTED_TERMS = [...canonicalByLower.values()];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
}

const protectedPattern = new RegExp(
  `(^|[^\\p{L}\\p{N}_])(${PROTECTED_TERMS
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?=$|[^\\p{L}\\p{N}_])`,
  'giu',
);

export function canonicalProtectedTerm(value: string): string | undefined {
  return canonicalByLower.get(value.toLocaleLowerCase('en-US'));
}

export function protectKnownTerminology(
  text: string,
  protect: (canonical: string) => string,
): string {
  return text.replace(protectedPattern, (_match, prefix: string, raw: string) => {
    const canonical = canonicalProtectedTerm(raw) ?? raw;
    return prefix + protect(canonical);
  });
}
