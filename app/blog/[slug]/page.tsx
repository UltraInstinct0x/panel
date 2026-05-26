// app/blog/[slug]/page.tsx — single post w/ Article + FAQ schema where applicable
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost, listPostSlugs, postUrl } from '@/lib/blog';

export const dynamic = 'force-static';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return listPostSlugs(false).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  const base = process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  const imageUrl = post.image ? new URL(post.image, base).toString() : undefined;
  return {
    title: `${post.title} — panel blog`,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.updated || post.date,
      authors: [post.author],
      tags: post.tags,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      creator: '@0xultrainstinct',
      images: imageUrl ? [imageUrl] : undefined,
    },
    alternates: { canonical: postUrl(params.slug) },
  };
}

export default function BlogPost({ params }: { params: Params }) {
  const post = getPost(params.slug);
  if (!post) notFound();
  const base = process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  const imageUrl = post.image ? new URL(post.image, base).toString() : undefined;

  const safeJsonLd = (obj: unknown) =>
    JSON.stringify(obj)
      .replace(/</g, '\\u003c')
      .replace(/-->/g, '--\\u003e')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated || post.date,
    author: {
      '@type': 'Person',
      name: post.author,
      url: 'https://x.com/0xultrainstinct',
      sameAs: ['https://x.com/0xultrainstinct', 'https://github.com/ultrainstinct0x'],
    },
    publisher: {
      '@type': 'Organization',
      name: 'panel',
      url: 'https://panel.goku.codes',
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl(post.slug) },
    keywords: post.tags?.join(', '),
    image: imageUrl ? [imageUrl] : undefined,
  };

  const faqLd =
    post.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((entry) => ({
            '@type': 'Question',
            name: entry.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: entry.answer,
            },
          })),
        }
      : null;

  return (
    <main className="container blog-post">
      <article>
        <header className="post-header">
          {post.draft && <p className="badge badge-warn">DRAFT — not visible in production</p>}
          <h1>{post.title}</h1>
          <p className="post-lede muted">{post.description}</p>
          <div className="post-meta">
            <span className="byline">
              by{' '}
              <a href="https://x.com/0xultrainstinct" rel="author noopener noreferrer" target="_blank">
                {post.author}
              </a>{' '}
              ·{' '}
              <a href="https://github.com/ultrainstinct0x" rel="noopener noreferrer" target="_blank">
                github
              </a>
            </span>
            <span className="sep">·</span>
            <time dateTime={post.date}>published {post.date}</time>
            {post.updated && post.updated !== post.date && (
              <>
                <span className="sep">·</span>
                <time dateTime={post.updated}>updated {post.updated}</time>
              </>
            )}
            {post.tags?.length > 0 && (
              <>
                <span className="sep">·</span>
                {post.tags.map((t) => (
                  <span key={t} className="badge">{t}</span>
                ))}
              </>
            )}
          </div>
        </header>

        <div
          className="post-body prose"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        <footer className="post-footer">
          <p className="muted">
            <Link href="/blog">← all posts</Link> · <Link href="/contact">talk to us</Link>
          </p>
        </footer>
      </article>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqLd) }}
        />
      )}
    </main>
  );
}
