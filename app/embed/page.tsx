// minimal layout for iframe embedding — no nav, transparent bg.
import Widget from '../_components/Widget';

export const dynamic = 'force-dynamic';

export default function EmbedPage({ searchParams }: { searchParams: { site_key?: string; pool?: string; wid?: string } }) {
  const siteKey = searchParams.site_key || 'pk_demo_a';
  const pool = (searchParams.pool || 'public') as 'public' | 'technical';
  const widgetId = searchParams.wid || '';
  return (
    <div style={{ padding: 8, background: 'transparent' }}>
      <Widget siteKey={siteKey} pool={pool} mode="captcha" widgetId={widgetId} />
    </div>
  );
}
