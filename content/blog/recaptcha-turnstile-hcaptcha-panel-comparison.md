---
title: "reCAPTCHA v3 / Turnstile / hCaptcha / panel: what each actually measures"
slug: recaptcha-turnstile-hcaptcha-panel-comparison
date: 2026-05-26
description: "Four captcha-replacement systems, compared on what they actually measure, what they emit, and what operators can do with the output. No marketing summary — the underlying signal."
tags: [captcha, comparison, recaptcha, turnstile, hcaptcha, agent-traffic]
author: goku
image: /blog/captcha-systems-comparison.svg
faq:
  - question: "which captcha is best if I have real AI-agent traffic?"
    answer: "the system that returns structured, agent-aware verdicts is best for routing; bit-only systems are optimized for human-vs-bot only."
  - question: "is Turnstile or reCAPTCHA enough for low agent traffic?"
    answer: "yes, for mostly human traffic they are often sufficient and operationally simple."
  - question: "can I combine systems?"
    answer: "yes — run a cheap edge gate first, then use a richer signal layer at signup or checkout for nuanced policy decisions."
draft: false
---

## the short version

![diagram: captcha systems comparison](/blog/captcha-systems-comparison.svg)

reCAPTCHA v3, Turnstile, hCaptcha, and panel all sit at the same point in the request lifecycle — the front door. They differ on three axes that actually matter: **what they measure**, **what they return to the operator**, and **how they handle the agent population**. This post compares those three axes head-to-head with no marketing summary.

## the comparison

| Dimension | reCAPTCHA v3 | Turnstile | hCaptcha | panel |
|---|---|---|---|---|
| **Vendor** | Google | Cloudflare | Intuition Machines | independent |
| **Visible challenge** | none by default | none by default | invisible + checkbox + image fallback | invisible + signal-aware fallback |
| **Primary signal** | risk score (0.0–1.0) | proof-of-work + bot heuristics | image classification + behavior | structured population estimate |
| **Operator response** | numeric score | binary pass/fail | binary pass/fail | verdict + confidence + per-signal breakdown |
| **Agent handling** | implicit (often fails) | implicit (often fails) | explicit refusal (vision-based) | explicit identification + routing |
| **Data sent to vendor** | full telemetry (Google) | minimal (Cloudflare) | full telemetry (hCaptcha) | configurable, minimum-viable |
| **Self-hosted option** | no | no | enterprise tier | yes |
| **Pricing** | free (with privacy cost) | free (Cloudflare account) | free up to limit, paid above | usage-based, lower bands |
| **Best for** | Google-stack sites comfortable with telemetry | Cloudflare-stack sites wanting minimum-effort gate | sites that genuinely want a vision challenge | sites with non-trivial agent traffic |

## what each one actually measures

### reCAPTCHA v3 — risk score

reCAPTCHA v3 watches user behavior across the page and returns a score between 0.0 (probably bot) and 1.0 (probably human). The operator picks a threshold. There's no challenge unless the operator builds one on top.

**Signal it produces:** one float.

**What you can do with the signal:** decide a threshold, route above/below.

**What you can't do:** see *why* the score is what it is, distinguish populations beyond human/not, or reason about agents at all.

### Cloudflare Turnstile — proof-of-work + heuristics

Turnstile combines a small proof-of-work challenge with behavioral heuristics. The output is a token the operator validates server-side. Pass means "Cloudflare thinks this is human-ish, here's a token." Fail means "not."

**Signal it produces:** one bit (valid token or not).

**What you can do with the signal:** admit or deny.

**What you can't do:** route by population, reason about agents, see why a request was denied.

### hCaptcha — image classification + behavior

hCaptcha leans more on visible challenges than the other two. Behavioral signals reduce challenge frequency, but the system's core is "can you classify this image grid." Operators get pass/fail.

**Signal it produces:** one bit.

**What you can do with the signal:** admit or deny.

**Agent reality:** an explicit vision challenge is the *worst* failure mode for legitimate agents. They will reliably fail.

### panel — structured population estimate

panel returns a verdict (`human` / `agent_authorized` / `agent_unverified` / `bot`), a confidence score (0.0–1.0), per-population likelihoods, and the per-signal breakdown that drove the verdict. The agent population is first-class — agent provenance is one of the input signals, not an afterthought.

**Signal it produces:** structured object.

**What you can do with the signal:** per-route routing, per-population rate limits, audit logs, agent admission policy, triage UI for borderline cases.

## per-population behavior

This is where the systems diverge most.

| Visitor type | reCAPTCHA v3 | Turnstile | hCaptcha | panel |
|---|---|---|---|---|
| Confident human | high score, pass | pass | pass | `human`, high confidence |
| Low-effort scraper | low score, deny | deny | challenge → deny | `bot`, high confidence |
| Skilled scraper with browser-fingerprint emulation | sometimes passes | sometimes passes | sometimes passes | depends on which signals it spoofed |
| **Authorized AI agent (with provenance token)** | likely low score, deny | likely deny | image challenge → deny | `agent_authorized`, route per agent policy |
| **Authorized AI agent (no token, declared agent UA)** | likely deny | likely deny | likely deny | `agent_unverified`, configurable response |
| Bot pretending to be agent (faked UA) | unchanged from scraper case | unchanged | unchanged | `bot` if other signals disagree with claim |

The pattern: the first three systems handle "human vs. not" and treat everything in the not-human bucket the same. panel splits the not-human bucket into authorized agent / unauthorized agent / bot and lets operators route accordingly.

## what each does well

| System | Best for |
|---|---|
| reCAPTCHA v3 | sites already on Google stack, low agent traffic, willing to send full telemetry to Google |
| Turnstile | sites on Cloudflare wanting minimum-friction gate, low agent traffic |
| hCaptcha | sites that genuinely want a visible challenge as a deterrent, low agent traffic, privacy concerns about Google |
| panel | sites with non-trivial agent traffic, sites that need to *route* not just admit/deny, sites where the operator wants the signal breakdown |

## what each does badly

- **reCAPTCHA v3** — full Google telemetry; the score is opaque; agents systematically punished
- **Turnstile** — bit-only output; no agent handling; locked to Cloudflare account
- **hCaptcha** — vision challenge is hostile to agents and to users with vision-system difficulties
- **panel** — younger product, smaller integration footprint than the big three, ecosystem is still building

Be honest about the tradeoffs. None of these are strictly better than the others — they're optimized for different threat models. The big three were designed for "block bots." panel was designed for "route the modern traffic mix."

## frequently asked questions

### can I run two of these in parallel?

Yes. Common patterns: Turnstile or reCAPTCHA at the edge to filter the obvious bots cheaply, panel deeper in the flow to handle the agent population on requests that pass the first gate. The two signals combine cleanly.

### what about Arkose, GeeTest, FunCaptcha?

Same family as hCaptcha (visible challenge + behavioral). They have the same agent-friendliness problem and the same pass/fail output. The comparison axes above apply.

### what does panel cost?

Usage-based pricing with a free tier for low traffic. See the [pricing page](/pricing).

### does panel work with my framework?

JS SDK for any web framework, server SDKs in Node, Python, Go. The HTTP API is also direct-usable. See the [docs](/docs).

### isn't this just an ad for panel?

The comparison is intentionally on dimensions where the systems actually differ. If your traffic is 99.9% human and 0.1% scraper, reCAPTCHA v3 or Turnstile will serve you fine and cost less effort. If your traffic mix includes legitimate agents and you're losing them at the gate, the comparison tilts toward panel.

## takeaway

The four systems are not interchangeable. reCAPTCHA v3, Turnstile, and hCaptcha return a single signal designed for "block bots, admit humans." panel returns a structured signal designed for "route the modern traffic mix, including agents." Pick on the dimension that matches your actual traffic, not on brand familiarity.

---

*panel emits a structured signal designed for routing, not just admitting. read [how it works](/how-it-works) or try the [gate demo](/demo/gate).*
