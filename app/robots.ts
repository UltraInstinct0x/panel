import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/widget', '/embed'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
