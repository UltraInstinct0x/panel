import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="topbar">
      <Link href="/" className="brand">▰ panel</Link>
      <Link href="/demo/gate">demo</Link>
      <Link href="/widget?embed=true">widget</Link>
      <Link href="/dashboard">dashboard</Link>
      <Link href="/operator">operator</Link>
      <a href="https://github.com/UltraInstinct0x/panel" target="_blank" rel="noreferrer">github</a>
    </nav>
  );
}
