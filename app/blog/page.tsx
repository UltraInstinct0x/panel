// app/blog/page.tsx — blog index
import type { Metadata } from 'next';
import Link from 'next/link';
import { listPosts } from '@/lib/blog';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'panel blog — captcha, agent traffic, and signal',
  description:
    'Threat models, comparisons, and engineering notes on captcha, agent traffic, and signup signal from the panel team.',
  openGraph: {
    title: 'panel blog',
    description: 'Threat models, comparisons, and engineering notes on captcha and agent traffic.',
    type: 'website',
  },
};

export default function BlogIndex() {
  const posts = listPosts();
  return (
    <main className="container blog-index">
      <header className="blog-header">
        <h1>blog</h1>
        <p className="muted">
          notes on captcha, agent traffic, and what an honest signup signal looks like.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="muted">no posts yet — first ones land soon.</p>
      ) : (
        <ul className="post-list">
          {posts.map((p) => (
            <li key={p.slug} className="post-card">
              <Link href={`/blog/${p.slug}`} className="post-link">
                <div className="post-meta">
                  <time dateTime={p.date}>{p.date}</time>
                  {p.draft && <span className="badge badge-warn">DRAFT</span>}
                  {p.tags?.slice(0, 3).map((t) => (
                    <span key={t} className="badge">{t}</span>
                  ))}
                </div>
                <h2 className="post-title">{p.title}</h2>
                <p className="post-desc">{p.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
