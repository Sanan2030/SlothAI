import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'SlothAI — Azərbaycan dili mətn düzəldici',
  description: 'Azərbaycan mətnini brauzerdə, AI və API açarı olmadan qaydalarla düzəldin.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
