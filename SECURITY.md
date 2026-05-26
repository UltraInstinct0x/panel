# Security Policy

## Supported versions

panel is pre-1.0 — only `main` is supported. there are no point releases yet.

| version | supported |
|---------|-----------|
| main    | ✅        |
| < main  | ❌        |

## Reporting a vulnerability

use the **[/contact](https://panel.goku.codes/contact?topic=security)** form (topic: `security`) with:

- a short description of the issue
- reproduction steps (or a PoC)
- what you think the impact is

we'll acknowledge within 72h. don't open a public github issue for security stuff.

PGP is not required. if you want it, mention so in the contact form and we'll exchange keys before sending anything sensitive.

## Severity rubric (informal)

- **critical**: authentication bypass, attestation signature forgery, jti replay across keys, RCE, full DB read/write.
- **high**: site-key leak path, persistent XSS in widget/embed, rate-limit bypass that enables credential stuffing of a real backend, gold-label leak via API.
- **medium**: missing security header on a non-critical surface, CSRF on operator surface, time-of-check / time-of-use on judgments.
- **low**: missing CORS preflight, verbose error messages, weak default config that requires non-default action to exploit.

we aim for: critical → triage <24h, fix <7d. high → triage <72h, fix <30d. medium/low → next minor.

## Scope

**in scope**: anything under `panel.goku.codes`, the published widget SDK, `~/panel/app/api/*` routes, the attestation envelope format, the rate limiter, the scrubber-proxy companion service.

**out of scope**:
- DoS / volumetric attacks against the demo instance (we know it's a single VPS)
- social-engineering, phishing of operators
- vulnerabilities in third-party dependencies that don't have a published advisory
- self-XSS in the operator console (single-tenant, single-host PoC)
- missing rate limiting on `/api/stats` (intentional — read-only aggregate)

## What we won't do

- no bug bounty payouts (yet). we'll credit you in the changelog if you want.
- no NDAs.
- no "responsible disclosure" timer brinkmanship. tell us, we fix it, we publish.
