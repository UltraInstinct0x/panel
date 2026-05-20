import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'panel — captcha-shaped feedback layer for agent outputs',
  description: 'visitors prove they\'re human by judging a piece of agent work. operators get a captcha. agent stacks get continuous preference data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
