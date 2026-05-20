// embed layout — no Nav, transparent (inherits root html/body).
export const metadata = { title: 'panel embed' };

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'transparent' }}>{children}</div>;
}
