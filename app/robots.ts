import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  // AI search bots are explicitly allowed — citation is the whole point.
  // CCBot (Common Crawl, used for training, not citation) is blocked.
  const aiSearchBots = [
    'GPTBot',
    'ChatGPT-User',
    'PerplexityBot',
    'ClaudeBot',
    'anthropic-ai',
    'Google-Extended',
    'Bingbot',
    'Applebot-Extended',
  ];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/widget', '/embed', '/admin/'] },
      ...aiSearchBots.map((bot) => ({
        userAgent: bot,
        allow: ['/', '/blog/'],
        disallow: ['/api/', '/widget', '/embed', '/admin/'],
      })),
      // Training-only crawler: block.
      { userAgent: 'CCBot', disallow: '/' },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: new URL(base).host,
  };
}
