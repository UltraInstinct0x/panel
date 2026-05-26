// V7 — Public Archive Seeder for media_origin honeypots.
//
// Pulls Featured Pictures from Wikimedia Commons (CC-licensed real photos),
// inserts them as media_origin honeypots with true_answer="real", decoy="ai".
// Raters who lazily-classify everything as AI fail these → trust hit.
//
// Run: PANEL_ARCHIVE_TOKEN=<admin> tsx scripts/seed-archive-honeypots.ts [count]
// Default count = 25. Idempotent on (source, source_id).
//
// Source: Wikimedia Commons Featured Pictures category. CDN allows hotlink for
// non-commercial + with attribution. We pass thumburl (1024px) which is built
// for hotlinking. UA is set per Wikimedia API policy.

import { insertHoneypot } from '../lib/honeypot';
import { db } from '../lib/db';
import type { UnitType } from '../lib/store';

const UA = 'PanelArchiveSeeder/1.0 (+https://panel.goku.codes/contact?topic=abuse)';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const CATEGORY = 'Category:Featured_pictures_on_Wikimedia_Commons';

interface CommonsFile {
  pageid: number;
  title: string;
  thumburl?: string;
  url?: string;
  width?: number;
  height?: number;
  artist?: string;
  license?: string;
}

// Track which archive items we've already seeded (avoids re-emit on re-run).
db.exec(`
  CREATE TABLE IF NOT EXISTS archive_seed_log (
    source       TEXT NOT NULL,
    source_id    TEXT NOT NULL,
    honeypot_id  TEXT NOT NULL,
    seeded_at    INTEGER NOT NULL,
    PRIMARY KEY (source, source_id)
  );
`);

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(`commons api ${r.status}: ${url}`);
  return r.json();
}

function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

async function listFeatured(limit: number, cmcontinue?: string): Promise<{ ids: number[]; next?: string }> {
  const u = new URL(COMMONS_API);
  u.searchParams.set('action', 'query');
  u.searchParams.set('format', 'json');
  u.searchParams.set('list', 'categorymembers');
  u.searchParams.set('cmtitle', CATEGORY);
  u.searchParams.set('cmtype', 'file');
  u.searchParams.set('cmlimit', String(Math.min(limit, 50)));
  if (cmcontinue) u.searchParams.set('cmcontinue', cmcontinue);
  const j = await fetchJson(u.toString());
  return {
    ids: (j.query?.categorymembers || []).map((m: any) => m.pageid),
    next: j.continue?.cmcontinue,
  };
}

async function fileInfo(pageids: number[]): Promise<CommonsFile[]> {
  if (!pageids.length) return [];
  const u = new URL(COMMONS_API);
  u.searchParams.set('action', 'query');
  u.searchParams.set('format', 'json');
  u.searchParams.set('prop', 'imageinfo');
  u.searchParams.set('iiprop', 'url|size|mime|extmetadata');
  u.searchParams.set('iiurlwidth', '1024');
  u.searchParams.set('pageids', pageids.join('|'));
  const j = await fetchJson(u.toString());
  const out: CommonsFile[] = [];
  for (const [, page] of Object.entries<any>(j.query?.pages || {})) {
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    if (ii.mime && !ii.mime.startsWith('image/')) continue; // images only for V7
    const meta = ii.extmetadata || {};
    out.push({
      pageid: page.pageid,
      title: page.title,
      thumburl: ii.thumburl || ii.url,
      url: ii.url,
      width: ii.thumbwidth || ii.width,
      height: ii.thumbheight || ii.height,
      artist: stripHtml(meta.Artist?.value || '').slice(0, 200),
      license: meta.LicenseShortName?.value || meta.UsageTerms?.value || 'cc',
    });
  }
  return out;
}

async function main() {
  const target = parseInt(process.argv[2] || '25', 10);
  if (!Number.isFinite(target) || target < 1 || target > 200) {
    console.error('count must be 1..200');
    process.exit(2);
  }

  const seen = new Set<string>(
    (db.prepare(`SELECT source_id FROM archive_seed_log WHERE source = 'commons'`).all() as Array<{ source_id: string }>)
      .map(r => r.source_id)
  );

  const seedRow = db.prepare(`
    INSERT INTO archive_seed_log (source, source_id, honeypot_id, seeded_at) VALUES (?, ?, ?, ?)
  `);

  let cmcontinue: string | undefined;
  let inserted = 0;
  let skipped = 0;
  let scanned = 0;
  const cap = target * 4; // safety: scan at most 4x target before giving up

  while (inserted < target && scanned < cap) {
    const page = await listFeatured(50, cmcontinue);
    if (!page.ids.length) break;
    cmcontinue = page.next;

    const fresh = page.ids.filter(id => !seen.has(String(id)));
    scanned += page.ids.length;
    if (!fresh.length) {
      if (!cmcontinue) break;
      continue;
    }

    const infos = await fileInfo(fresh);
    for (const f of infos) {
      if (inserted >= target) break;
      if (!f.thumburl) { skipped++; continue; }
      const sourceId = String(f.pageid);

      const payload = {
        question: 'is this AI-generated or real?',
        media_url: f.thumburl,
        media_type: 'image',
        source: 'wikimedia_commons',
        source_url: `https://commons.wikimedia.org/?curid=${f.pageid}`,
        attribution: f.artist ? `${f.artist} / Wikimedia Commons (${f.license})` : `Wikimedia Commons (${f.license})`,
        choices: [
          { id: 'real', label: 'Real' },
          { id: 'ai',   label: 'AI-generated' },
        ],
      };

      const hp = insertHoneypot({
        unit_type: 'media_origin' as UnitType,
        payload: JSON.stringify(payload),
        decoy_answer: 'ai',
        true_answer:  'real',
        expert_notes: `commons featured: ${f.title.replace(/^File:/, '').slice(0, 120)}`,
      });
      seedRow.run('commons', sourceId, hp.honeypot_id, Date.now());
      seen.add(sourceId);
      inserted++;
      console.log(`+ ${hp.honeypot_id}  ${f.title.slice(0, 80)}`);
    }
    if (!cmcontinue) break;
  }

  const totals = db.prepare(`SELECT COUNT(*) AS n FROM honeypots WHERE unit_type='media_origin' AND retired_at IS NULL`).get() as { n: number };
  console.log(JSON.stringify({ inserted, skipped, scanned, total_active_media_origin: totals.n }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
