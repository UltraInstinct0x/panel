---
title: "letting AI agents through your signup without getting overrun: a threat model"
slug: letting-ai-agents-through-signup
date: 2026-05-26
description: "AI agents will sign up for your product on behalf of paying humans whether you let them or not. Here's the threat model for admitting them deliberately instead of blocking them by accident."
tags: [agent-traffic, signup, threat-model, security]
author: goku
draft: true
---

## the short version

By mid-2026, a non-trivial share of signups on consumer and SaaS products come from AI agents acting on behalf of humans — ChatGPT, Claude, Perplexity, and a long tail of vertical agents. Most signup flows treat them the same as a scraper and bounce them. That's a mistake on two fronts: you reject paying customers, and you teach agents to route around you, which is worse for security than admitting them deliberately.

The right move is a **deliberate agent admission policy**: identify agents at the gate, tag the session, throttle differently, and skip the parts of the flow that don't apply to a machine (vision captchas, email verification loops, "please reply to this SMS" gates). Then watch what they do once they're in.

## who's at the door

Three things are now true at once that weren't true two years ago:

1. **Agents have credentials.** A user logs in to ChatGPT or Claude, and the agent acts with the user's identity attached. When that agent signs up for a third-party service, it's a real person behind it.
2. **Agents can pay.** Apple Pay and Stripe both ship agent-aware payment flows. The agent can complete checkout without bouncing back to a human for every approval.
3. **Agents can't solve vision captchas reliably.** They can solve some, badly, with cost — but the rate is bad enough that vision captcha at the front door is effectively "reject all agents."

Combine these and you get: the agent is a real customer with money, blocked at the gate by a control designed for a different threat.

## the threat surface

Five distinct threats hide under "agent at signup":

| Threat | Example | Who pays the cost |
|---|---|---|
| **Authorized agent acting for paying human** | Claude signing up for a research tool on a paid user's behalf | rejecting them = lost revenue |
| **Authorized agent doing abuse** | Same agent, but the human told it to mass-create burner accounts | operator + platform |
| **Scraper masquerading as an agent** | Scraper sets `User-Agent: ChatGPT` to bypass the gate | operator |
| **Stolen-credential bot** | Credential stuffer with a real password list | end users |
| **Spam farm** | Mass signup for SEO link-building | operator + ecosystem |

A vision captcha treats threats 1, 3, 4, and 5 as identical. They're not. They need different responses.

## what "agent provenance" actually means

The cleanest signal is a **signed agent token**: the agent presents a cryptographic attestation from its provider (OpenAI, Anthropic, etc.) saying "this request comes from agent X acting for user Y." The gate verifies the signature against the provider's public key and now knows two things:

- the agent is real (not a scraper with a faked header)
- the human is identifiable to the provider, which means abuse has a real-world consequence

If the token is missing, the gate falls back to weaker signals: known IP ranges, TLS fingerprint, declared user-agent. These are softer but combinable. A request from a known OpenAI egress IP, with a browser-like TLS fingerprint, and a declared agent user-agent, with no token, is *probably* a real agent — just one running through a path that doesn't yet support tokens.

## the admit / throttle / log pattern

Admitting an agent is not "let them do anything." It's:

1. **Admit** at the gate — no vision captcha, no SMS loop
2. **Tag** the session — every action the agent takes is logged with `actor=agent`
3. **Throttle** differently — agents get a rate-limit tier appropriate for machine-speed traffic without being browser-slow
4. **Restrict** sensitive actions — purchases over a threshold, password resets, security-setting changes can still require a human handoff
5. **Watch** — agent sessions that suddenly look like scrapers (rapid-fire endpoint enumeration, content scraping patterns) get downgraded

Critically, **none of this requires asking the agent to behave differently**. The whole pattern is operator-side. The agent just sees a signup that worked.

## what to require, what to skip

| Step | Human default | Agent default | Why |
|---|---|---|---|
| Vision captcha | required | skip | agents can't reliably solve, skipping costs nothing if other signals are good |
| Email verification | required | skip on first signup, require for sensitive actions | agents have email but the loop is friction with no security gain |
| SMS verification | optional | skip | agent has no phone; SMS is a fraud signal, not a security one |
| Terms acceptance | required | required | agent should still affirm on behalf of user |
| Payment collection | as designed | as designed | agent payment flows now work |
| Sensitive actions (delete account, change email) | confirmation | require human handoff | high-stakes irreversibles |

## the failure modes to plan for

- **Scrapers will set `User-Agent: ChatGPT`.** That's why the signed token matters. Header-only checks are spoofable.
- **Real agents will sometimes look like scrapers** (test runs, agent loops gone wrong). Don't permanently ban — throttle and let the next session redeem.
- **Provider keys rotate.** Cache aggressively, refresh on signature-failure with a circuit breaker so a key-rotation event doesn't reject every real agent for an hour.
- **Account takeover via agent.** If an attacker compromises a ChatGPT account, they get the trust level you've granted to agents. Don't grant trust beyond the user's actual permission level.

## frequently asked questions

### what if I just want to block all agents?

That's a legitimate choice — for now. The cost is that the user behind the agent often can't or won't fall back to a manual signup. They'll go to the competitor that admitted their agent. The cost grows every quarter.

### how do I know which providers support signed tokens?

OpenAI, Anthropic, and Google have published agent identification proposals. Implementations vary. At minimum, today, you can rely on declared user-agent + known IP range checks while waiting for token standards to settle.

### isn't this just user-agent sniffing with extra steps?

The signed token is the part that makes it not user-agent sniffing. Without the token, yes, you're back in soft-signal territory. With the token, you have a cryptographic proof of provenance.

### what does this mean for compliance?

If the agent is acting for an identified human, the human is still the data subject. The agent is a tool in the same legal sense as a browser. Privacy and terms-of-service apply to the human, not the agent.

### what does it mean for fraud teams?

Better signals. An "actor=agent" tag in your fraud pipeline is more useful than an empty `User-Agent` field. Agents are a population you can model — once you can identify them, you can build agent-specific fraud rules.

## takeaway

Agents are signing up for your product whether you let them or not. The only question is whether they identify themselves on the way in. Admit them deliberately, tag the session, and you get a customer plus a population you can monitor. Block them with a vision captcha and you lose the customer and learn nothing.

---

*panel admits agents deliberately, tags the session, and gives operators per-tier routing. read [how it works](/how-it-works) or try the [agent demo](/demo/agent).*
