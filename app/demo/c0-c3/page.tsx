// WS-P demo route — /demo/c0-c3
// renders all 4 tiers in sequence on one page, each with a force_tier flag.
// for screen-recording the animation + escalation continuity.
'use client';
import { useEffect } from 'react';
import Script from 'next/script';

export default function DemoC0C3() {
  useEffect(() => {
    // re-mount on script load (autoMount handles it)
    const id = setInterval(() => {
      // @ts-ignore
      if (window.Panel) { window.Panel.autoMount(); clearInterval(id); }
    }, 200);
    return () => clearInterval(id);
  }, []);

  const tiers = [
    { tier: 'C0', label: 'c0 — invisible auto-check', desc: 'passive fingerprint → scanline + diamond glyph, no popover. ~1200ms total.', delay: 400 },
    { tier: 'C1', label: 'c1 — single judgment', desc: 'one unit, popover anchored to pill. ≤10s budget.', delay: 1200 },
    { tier: 'C2', label: 'c2 — public mix', desc: '2 units across types. retry counter visible.', delay: 2000 },
    { tier: 'C3', label: 'c3 — multi-turn expert', desc: '3+ harder units. fail-any → retry SAME set.', delay: 2800 },
  ];

  return (
    <div style={{
      background: '#08080b', color: '#e2e8f0', minHeight: '100vh', padding: '48px 32px',
      fontFamily: '"Inter",ui-sans-serif,system-ui,sans-serif',
    }}>
      <Script src="/v1.js" strategy="afterInteractive" />
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ font: '600 28px/1.2 "Inter",ui-sans-serif', letterSpacing: '-0.02em', margin: 0, color: '#fafafa' }}>
          tier ladder — c0 to c3
        </h1>
        <p style={{ font: '14px/1.5 "Inter",ui-sans-serif', color: '#a1a1aa', margin: '8px 0 32px' }}>
          ws-p / d14 visible-invisible. each pill below mounts with a forced tier so
          you can see the full escalation envelope on one screen. open devtools network
          to watch /api/challenge/init + /api/challenge/resolve.
        </p>

        {tiers.map(t => (
          <div key={t.tier} style={{
            borderTop: '1px solid #1f2230', padding: '32px 0', display: 'grid',
            gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'center',
          }}>
            <div>
              <div style={{ font: '600 13px/1.4 "JetBrains Mono",ui-monospace,monospace', color: '#67e8f9', letterSpacing: '0.06em' }}>
                {t.label}
              </div>
              <div style={{ font: '13px/1.5 "Inter",ui-sans-serif', color: '#a1a1aa', marginTop: 6 }}>
                {t.desc}
              </div>
            </div>
            <div data-panel-sitekey="pk_demo_a" data-panel-force-tier={t.tier} data-panel-boot-delay-ms={t.delay} />
          </div>
        ))}

        <div style={{ borderTop: '1px solid #1f2230', paddingTop: 24, marginTop: 16,
          font: '11px/1.5 "JetBrains Mono",ui-monospace,monospace', color: '#52525b' }}>
          panel — ws-p demo. animation total budget ≤1500ms. all 4 tiers wire to
          /api/challenge/&#123;init,resolve&#125;. site_key: pk_demo_a.
        </div>
      </div>
    </div>
  );
}
