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
  date: string; // ISO yyyy-mm-dd
  updated?: string; // ISO yyyy-mm-dd (optional, falls back to date)
  description: string;
  tags: string[];
  author: string; // display name
  draft: boolean;
};

export type Post = PostMeta & {
  html: string;
  raw: string;
};

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');
const SHOW_DRAFTS = process.env.NODE_ENV !== 'production';

function parseDraft(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') return value.trim().toLowerCase() === 'true';
  return false;
}

function parseMeta(slug: string, data: Record<string, unknown>): PostMeta {
  return {
    slug,
    title: String(data.title ?? slug),
    date: String(data.date ?? ''),
    updated: data.updated ? String(data.updated) : undefined,
    description: String(data.description ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    author: String(data.author ?? 'goku'),
    draft: parseDraft(data.draft),
  };
}

function readRaw(slug: string): { data: Record<string, unknown>; content: string } | null {
  const file = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  return { data: data as Record<string, unknown>, content };
}

function renderMarkdown(content: string): string {
  // sanitize remains enabled (default) to avoid raw-html XSS when rendering markdown.
  return remark().use(remarkGfm).use(remarkHtml).processSync(content).toString();
}

function readPostMeta(slug: string): PostMeta | null {
  const raw = readRaw(slug);
  if (!raw) return null;
  return parseMeta(slug, raw.data);
}

function readPostFile(slug: string): Post | null {
  const raw = readRaw(slug);
  if (!raw) return null;
  const meta = parseMeta(slug, raw.data);
  const html = renderMarkdown(raw.content);
  return { ...meta, html, raw: raw.content };
}

export function listPostSlugs(includeDrafts = SHOW_DRAFTS): string[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const slugs = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));

  if (includeDrafts) return slugs;
  return slugs.filter((slug) => {
    const meta = readPostMeta(slug);
    return meta ? !meta.draft : false;
  });
}

export function listPosts(includeDrafts = SHOW_DRAFTS): PostMeta[] {
  return listPostSlugs(includeDrafts)
    .map((slug) => readPostMeta(slug))
    .filter((p): p is PostMeta => Boolean(p))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function getPost(slug: string, includeDrafts = SHOW_DRAFTS): Post | null {
  const p = readPostFile(slug);
  if (!p) return null;
  if (p.draft && !includeDrafts) return null;
  return p;
}

export function safeDate(value: string | undefined, fallback = new Date()): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export function postUrl(slug: string, base?: string): string {
  const root = base || process.env.PANEL_PUBLIC_URL || 'https://panel.goku.codes';
  return `${root}/blog/${slug}`;
}
