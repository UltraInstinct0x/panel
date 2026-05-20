// hmac-sha256 signer. node:crypto when available, else web crypto subtle.
// IMPORTANT: never ship the secret to a browser. use a server-side proxy.
// the secret is the per-site-key shared secret panel.goku.codes verifies against.

/**
 * compute hex-encoded hmac-sha256 of body using secret.
 * returns lowercase hex string, byte-identical to node createHmac('sha256').digest('hex').
 */
export async function sign(secret: string, body: string): Promise<string> {
  // prefer node:crypto for correctness + speed when available (node, bun).
  // dynamic import keeps edge/browser bundles clean.
  try {
    // @ts-ignore — optional, only present on node-like runtimes
    const nodeCrypto: typeof import('node:crypto') | undefined =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      typeof process !== 'undefined' && process.versions?.node
        ? await import('node:crypto')
        : undefined;
    if (nodeCrypto?.createHmac) {
      return nodeCrypto.createHmac('sha256', secret).update(body).digest('hex');
    }
  } catch {
    // fall through to web crypto
  }

  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) {
    throw new Error('panel-sdk: no crypto available (need node:crypto or globalThis.crypto.subtle)');
  }
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await subtle.sign('HMAC', key, enc.encode(body));
  const bytes = new Uint8Array(mac);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/** throw if running in a browser without explicit allowBrowser opt-in. */
export function assertServerOnly(allowBrowser?: boolean): void {
  // detect dom-window without leaning on node-only globals.
  const hasWindow = typeof (globalThis as any).window !== 'undefined' &&
    typeof (globalThis as any).document !== 'undefined';
  if (hasWindow && !allowBrowser) {
    throw new Error(
      'panel-sdk: refusing to run in browser. the ingest secret must never ship client-side. ' +
      'put the sdk behind a server-side proxy. (override with createClient({ allowBrowser: true }) only if you know what you are doing.)',
    );
  }
}
