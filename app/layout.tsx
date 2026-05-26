import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AppShell from './_components/AppShell';
import RootSessionProvider from './_components/RootSessionProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'panel — proof-of-humanity that produces signal',
  description: 'three layers of human signal: taste captcha (L1), agent-output rating (L2), expert review (L3). one rater pool, one sdk, one feedback loop.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body style={{ fontFamily: `var(--font-inter), 'Inter', system-ui, sans-serif` }}>
        <RootSessionProvider>
          <AppShell>{children}</AppShell>
        </RootSessionProvider>
      </body>
    </html>
  );
}
