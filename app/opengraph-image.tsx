import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'panel — captcha-shape feedback for agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#0a0a0a', color: '#e6e6e6',
          display: 'flex', flexDirection: 'column',
          padding: 64, fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          <div style={{ height: 14, background: '#e6e6e6', width: 520 }} />
          <div style={{ height: 14, background: '#e6e6e6', width: 320 }} />
          <div style={{ height: 14, background: '#e6e6e6', width: 520 }} />
        </div>
        <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 16 }}>panel</div>
        <div style={{ fontSize: 36, lineHeight: 1.2, color: '#a0a0a0', maxWidth: 1000 }}>
          captcha-shape feedback for agent outputs. one click proves you&apos;re human and labels a unit of agent work.
        </div>
        <div style={{ marginTop: 'auto', fontSize: 24, color: '#707070', display: 'flex', justifyContent: 'space-between' }}>
          <span>panel.goku.codes</span>
          <span>panel-gate · panel-data</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
