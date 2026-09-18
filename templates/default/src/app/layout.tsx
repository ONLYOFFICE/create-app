import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ONLYOFFICE Docs integration demo',
  description: 'A minimal file manager that opens documents in ONLYOFFICE Docs',
  // Declared here rather than as `src/app/favicon.ico`, so that the editor page can replace
  // it with an icon of the document type instead of adding a second <link rel="icon">.
  icons: { icon: { url: '/favicon.ico', sizes: '256x256', type: 'image/x-icon' } },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
