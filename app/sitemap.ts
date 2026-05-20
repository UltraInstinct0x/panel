import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/demo/gate`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/dashboard`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/operator`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
