import { defineConfig } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  { ignores: ['.next/**', 'node_modules/**', 'lib/editor/generated/**', 'next-env.d.ts'] },
  ...nextVitals,
  ...nextTypescript,
]);
