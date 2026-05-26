// app/blog/feed.xml/route.ts — RSS 2.0 feed
import { listPosts, postUrl } from '@/lib/blog';

export const dynamic = 'force-static';

function escape(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function GET() {
  const base = process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  const posts = listPosts(false);
  const items = posts
    .map(
      (p) => `
    <item>
      <title>${escape(p.title)}</title>
      <link>${postUrl(p.slug, base)}</link>
      <guid isPermaLink="true">${postUrl(p.slug, base)}</guid>
      <pubDate>${new Date(p.date || Date.now()).toUTCString()}</pubDate>
      <description>${escape(p.description)}</description>
      ${p.tags?.map((t) => `<category>${escape(t)}</category>`).join('') ?? ''}
    </item>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>panel blog</title>
    <link>${base}/blog</link>
    <atom:link href="${base}/blog/feed.xml" rel="self" type="application/rss+xml" />
    <description>captcha, agent traffic, and signup signal — notes from the panel team.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
}
