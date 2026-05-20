import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'panel — captcha-shaped feedback layer for agent outputs',
  description: 'visitors prove they\'re human by judging a piece of agent work. operators get a captcha. agent stacks get continuous preference data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;510;590;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
