import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="topbar">
      <Link href="/" className="brand">▰ panel</Link>
      <Link href="/demo/agent">agent demo</Link>
      <Link href="/demo/gate">gate demo</Link>
      <Link href="/review/u_skill_001">reviews</Link>
      <Link href="/pricing">pricing</Link>
      <Link href="/dashboard">dashboard</Link>
      <Link href="/operator">operator</Link>
      <Link href="/privacy">privacy</Link>
    </nav>
  );
}
