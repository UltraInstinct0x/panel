// lib/blog.ts — load + render markdown posts from content/blog/
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

export type PostMeta = {
  slug: string;
  title: string;
  date: string;          // ISO yyyy-mm-dd
  updated?: string;      // ISO yyyy-mm-dd (optional, falls back to date)
  description: string;
  tags: string[];
  author: string;        // display name
  draft: boolean;
};

export type Post = PostMeta & {
  html: string;
  raw: string;
};

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const SHOW_DRAFTS = process.env.NODE_ENV !== 'production';

function readPostFile(slug: string): Post | null {
  const file = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  const html = remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).processSync(content).toString();
  const meta: PostMeta = {
    slug,
    title: String(data.title ?? slug),
    date: String(data.date ?? ''),
    updated: data.updated ? String(data.updated) : undefined,
    description: String(data.description ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    author: String(data.author ?? 'goku'),
    draft: Boolean(data.draft),
  };
  return { ...meta, html, raw: content };
}

export function listPostSlugs(includeDrafts = SHOW_DRAFTS): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .filter((slug) => {
      if (includeDrafts) return true;
      const p = readPostFile(slug);
      return p && !p.draft;
    });
}

export function listPosts(includeDrafts = SHOW_DRAFTS): PostMeta[] {
  return listPostSlugs(includeDrafts)
    .map((slug) => readPostFile(slug))
    .filter((p): p is Post => Boolean(p))
    .filter((p) => includeDrafts || !p.draft)
    .map(({ html: _h, raw: _r, ...meta }) => meta)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function getPost(slug: string, includeDrafts = SHOW_DRAFTS): Post | null {
  const p = readPostFile(slug);
  if (!p) return null;
  if (p.draft && !includeDrafts) return null;
  return p;
}

export function postUrl(slug: string, base?: string): string {
  const root = base || process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  return `${root}/blog/${slug}`;
}
