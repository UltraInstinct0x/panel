---
title: "captcha that produces signal: why pass/fail isn't enough"
slug: captcha-that-produces-signal
date: 2026-05-26
description: "Traditional captcha returns a single bit — human or not. That bit hides everything operators actually need to make a routing decision. Here's what a signal-producing gate looks like instead."
tags: [captcha, threat-model, signal, agent-traffic]
author: goku
draft: false
---

## the short version

A captcha that returns only pass/fail throws away most of what its sensors saw. The page knows whether the visitor moved a mouse, scrolled, dwelled, copy-pasted, switched tabs, and how the request was constructed at the network layer. Collapsing all of that into one bit means the operator can't tell a confused human apart from a low-effort scraper apart from a legitimate agent — they all show up as "fail."

A signal-producing gate keeps the structure. It emits a compact JSON object that says **who you probably are** (human / agent-on-behalf-of-human / autonomous bot), **how confident** the gate is, and **which signals fired**. Then the operator gets to route, not just admit or reject.

## why pass/fail is a category error

Pass/fail made sense when the only meaningful population was "human vs. scraper." That world is gone. Three populations now matter:

| Population | Example | What the operator usually wants |
|---|---|---|
| **Humans** | A person signing up for the product | admit, log normally |
| **Authorized agents** | ChatGPT browsing on a paying user's behalf | admit, tag as agent, throttle, no MFA loop |
| **Autonomous bots** | Credential stuffer, scraper, spam farm | deny or honeypot |

Pass/fail can't tell the second from the third. So operators do one of two bad things:

1. **Block everything that fails the captcha.** This means real users who fail a click-the-traffic-lights challenge are bounced, and legitimate AI agents (which often *will* fail a vision-based challenge) are bounced too — even when the human behind them has paid for the privilege.
2. **Lower the gate.** This admits the legitimate agents but also admits the scrapers, because the gate has no way to distinguish them.

Neither is what the operator actually wants. They want **routing**, not gatekeeping.

## what a signal-producing gate actually emits

```json
{
  "verdict": "agent_authorized",
  "confidence": 0.87,
  "population": {
    "human_likelihood": 0.04,
    "agent_likelihood": 0.91,
    "bot_likelihood": 0.05
  },
  "signals": {
    "interaction": { "mouse_path": "none", "scroll": false, "dwell_ms": 240 },
    "network": { "asn_class": "datacenter", "tls_fingerprint": "browser-like" },
    "agent_provenance": { "header_present": true, "signature_valid": true }
  },
  "advisory": "treat as authorized agent — skip captcha challenge, apply rate limit tier 2"
}
```

The operator can now:
- admit humans normally
- admit authorized agents with a different rate-limit tier and no email-verification loop
- challenge or deny the bot population
- review the borderline confidence cases in a triage UI instead of guessing

## what changes for the user

For humans: nothing visible. The gate is invisible most of the time. When a challenge is needed, it's the same kind of friction they're used to.

For agents acting on behalf of a paid user: the agent presents a signed token (or operates from a known agent IP range, or sets an agent-identification header), the gate sees the signal, and the agent passes without a vision-puzzle they were never going to solve.

For bots: the same friction as before, plus the operator can now feed the verdict into rate-limit and fraud systems with richer data.

## the operator side of the change

The hard part isn't the gate itself — it's persuading operators that "give us signal, we'll do the routing" is a better contract than "give us a yes/no." Three things make this concrete:

1. **Verdict + confidence in the response.** Operators can pick a confidence threshold per route. Login pages might want 0.95+, comment forms might be fine at 0.6.
2. **Per-signal breakdown.** When something fires unexpectedly, the operator can see which sensor disagreed with the verdict and tune.
3. **Audit log.** Every verdict is replayable — same request, same signals, same decision — which matters when an operator has to explain to a customer why their signup was challenged.

## frequently asked questions

### isn't this just a captcha with more telemetry?

No. The point isn't more data — it's that the data leaves the gate in a useful shape. A traditional captcha collects similar telemetry internally and then throws away the structure before returning a single bit. Signal-producing gates return the structure.

### what about privacy?

The signal is about request shape, not identity. No biometrics, no tracking-grade fingerprinting, no PII. The operator gets the same population guess they'd get from a captcha — just with the reasoning attached.

### how does this handle adversarial agents pretending to be authorized?

That's the agent provenance signal's job — signed tokens, known agent endpoints, and behavioral verification. An unauthorized agent claiming to be ChatGPT will fail the signature check and drop into the bot bucket.

### does it work with existing captcha integrations?

The response is a superset of pass/fail, so operators that only care about the verdict can ignore the structured signal. The structured signal is there when they want to upgrade their routing.

## takeaway

Captcha that returns one bit was built for a world where the only meaningful threat was "is this a human." The threat surface has changed. The gate needs to give operators enough information to **route**, not just **admit**. That's what panel does.

---

*panel is a signal-producing gate for captcha and agent traffic. read [how it works](/how-it-works) or try the [gate demo](/demo/gate).*
