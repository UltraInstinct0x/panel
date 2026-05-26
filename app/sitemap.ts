import type { MetadataRoute } from 'next';
import { listPosts } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/demo/gate`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/dashboard`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/operator`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];
  const posts: MetadataRoute.Sitemap = listPosts(false).map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(p.updated || p.date || now),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));
  return [...staticPages, ...posts];
}
