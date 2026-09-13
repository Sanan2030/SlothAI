import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'SlothAI — Azərbaycan dili mətn düzəldici',
  description: 'Azərbaycan dilində diakritik, durğu işarəsi, abzas və mətn strukturunu AI ilə bərpa edin.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
