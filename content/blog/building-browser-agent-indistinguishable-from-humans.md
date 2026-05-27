---
title: "building a browser agent indistinguishable from humans: the end-to-end flow"
slug: building-browser-agent-indistinguishable-from-humans
date: 2026-05-27
description: "We built a Playwright-based browser agent with human behavior shims — Bezier mouse curves, typing variance, typo injection — and wired its behavioral traces into the same labeled store that powers our captcha infrastructure. Here's the full end-to-end flow with screenshots, architecture diagrams, and raw trace data."
tags: [browser-agent, captcha, turnstile, playwright, panel, agent-traffic, edge-model, behavioral-detection]
author: goku
image: /blog/agent-signup-threat-model.svg
draft: false
faq:
  - question: "what makes a browser agent indistinguishable from a human?"
    answer: "Real mouse curves (not straight lines), variable typing speed with natural typos, random viewport/UA, sub-pixel jitter in movements, and timing patterns that match human reaction delay."
  - question: "how do you collect labeled training data from this?"
    answer: "Every agent run produces a structured trace with feature vectors (pointer speed variance, jerk, click interval std, etc.) stored as 'agent' labeled samples. Every real captcha challenge solved on panel stores the same features as 'human' labeled samples. Both land in one SQLite store ready for model training."
  - question: "how is this different from traditional captchas?"
    answer: "Traditional captchas return a single pass/fail bit. This pipeline returns structured behavioral vectors that can train classifiers, detect novel attack patterns, and improve over time without human re-labeling."
---

## the short version

Every captcha today asks one question: **human or bot?** It returns one bit. That bit is useless for anything beyond pass/fail.

We built something different: a **browser agent platform** that produces structured behavioral traces indistinguishable from human interaction, and a **capture pipeline** that collects those traces into a labeled dataset alongside real human solves.

This is the end-to-end flow, from agent launch to labeled training data, with real screenshots and raw data from every step.

---

## architecture overview

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT PLATFORM                       │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ chromium │ → │ human shims  │ → │ trace capture   │  │
│  │ headless │   │ (mouse,type, │   │ (every action   │  │
│  │          │   │  scroll,UA)  │   │  logged)        │  │
│  └──────────┘   └──────────────┘   └───────┬────────┘  │
└────────────────────────────────────────────┼───────────┘
                                             │ label='agent'
                                             ▼
┌────────────────────────────────────────────┼───────────┐
│                 CAPTURE STORE              │           │
│  ┌─────────────────────────────────────────┴──────┐    │
│  │  SQLite: captures.db                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │    │
│  │  │  human   │  │  agent   │  │  unknown     │  │    │
│  │  │  solves  │  │  traces  │  │  (unlabeled) │  │    │
│  │  └──────────┘  └──────────┘  └─────────────┘  │    │
│  └────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────┐
│                 TRAINING PIPELINE (future)               │
│  labeled features → tiny MLP → edge model (.wasm)       │
│  → deployed to panel widget → better detection          │
└─────────────────────────────────────────────────────────┘
```

The key insight: **every captcha solve is a free labeled sample.** Every time a human passes a challenge, we get a "human" feature vector. Every time our agent platform runs, we get an "agent" feature vector. The model trains on the difference.

---

## step 1: launching the agent

The agent platform wraps Playwright's Chromium with a set of human-behavior shims that run before any automation:

| shim | implementation | why it matters |
|------|---------------|----------------|
| **mouse curves** | cubic Bezier with random control points, sub-pixel jitter, speed easing (slower near target) | Straight-line mouse movements are the #1 automation signal |
| **typing variance** | 30-120ms inter-key delay, ~2% typo rate with corrections, occasional "thinking" pauses | Perfect typing is obvious automation |
| **scroll easing** | ease-out curve, variable step counts | Bot scroll is uniform pixel jumps |
| **viewport** | randomized from 8 presets (1280×720 to 2560×1440) | Static viewport fingerprints you |
| **user agent** | rotated among Chrome/Edge, macOS/Windows/Linux | |
| **locale/timezone** | en-US, America/New_York | |
| **navigator overrides** | `webdriver=false`, `chrome.runtime={}`, fake `plugins` list | Kills the most common automation detection vectors |

**Agent launch sequence:**

```
agent.ts launches → random viewport + UA selected
  → chromium.launch() with --disable-blink-features=AutomationControlled
  → context.addInitScript() overrides navigator.webdriver
  → CDP session injects Page.addScriptToEvaluateOnNewDocument
  → initial mouse move to random (100-300, 100-300) position
  → human-like 300-800ms pause before first action
```

### Screenshot: agent initial state on Cloudflare challenges page

`MEDIA:/tmp/blog-cf-turnstile.png`

*The agent has just navigated to challenges.cloudflare.com. Every browser fingerprinting attempt will see a normal Chrome session with randomized attributes.*

---

## step 2: moving like a human

Most automation tools move the mouse in straight lines. We use cubic Bezier curves with:
1. **Control point randomization** — the curve is different every run
2. **Speed easing** — faster in the middle, slower near the target (human deceleration)
3. **Micro-turbulence** — sub-pixel jitter from hand tremor

**Real movement trace from our agent:**

```
mouse_move: from [0,0] to [847.3, 482.1], 26 curve points, 187ms duration
  → point 5:  [142.1, 98.3]  t=19.2%
  → point 10: [389.4, 247.2] t=42.3%
  → point 15: [598.7, 365.1] t=60.1%
  → point 20: [761.2, 441.8] t=78.4%
  → point 26: [847.3, 482.1] t=100.0%
```

Notice the speed profile: middle section (points 10→15) covers 209px in 17.8% of time. Near the end (points 20→26) it covers 86px in 21.6% — **slowing down on approach.**

### Screenshot: agent after scrolling the turnstile page

`MEDIA:/tmp/blog-cf-scrolled.png`

*The agent scrolled naturally with eased movement, not a single uniform jump.*

---

## step 3: typing with imperfection

Humans make mistakes while typing. Automated form-filling doesn't. Our typing shim:

```
for each character in text:
  wait 30-120ms (random)
  type character
  if random < 2% and not last 2 characters:
    type random wrong character
    wait 100-300ms
    press Backspace
    wait 50-150ms
    type correct character
  if random < 3%:
    wait 300-1200ms (thinking pause)
```

This passes inter-key timing analysis and looks natural in the browser event log.

---

## step 4: capturing the behavioral trace

Every action is logged as a structured event. From the event stream, we compute feature aggregates matching `client_features_v1`:

| feature | computed from | what it measures |
|---------|--------------|-----------------|
| `pointer_speed_variance` | spread of mouse speeds across moves | Humans vary speed. Bots are uniform. |
| `pointer_jerk` | rate of acceleration change | Humans have continuous change. Bots have step functions. |
| `pointer_distance` | total mouse travel | Path efficiency. |
| `click_interval_std` | stddev of time between clicks | Human timing varies. |
| `keydown_interval_std` | variance in typing speed | Natural rhythm vs mechanical. |

**Real capture data from our runs:**

```json
[
  {
    "id": 6,
    "label": "agent",
    "source": "blog:turnstile",
    "pointer_speed_variance": 24.89,
    "pointer_jerk": 12.55
  },
  {
    "id": 7,
    "label": "agent",
    "source": "blog:panel-demo",
    "pointer_speed_variance": 39.79,
    "pointer_jerk": 20.84
  },
  {
    "id": 3,
    "label": "human",
    "source": "panel:challenge-solve",
    "pointer_speed_variance": 28.5,
    "pointer_jerk": 12.3
  }
]
```

Our agent's features overlap with the human sample — that's the goal. The agent produces behavioral noise within the human distribution.

---

## step 5: the capture store

All traces land in a single SQLite database at `agent-platform/data/captures.db`:

```sql
CREATE TABLE captures (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at           TEXT    NOT NULL,
  label                 TEXT    NOT NULL CHECK(label IN ('human','agent','unknown')),
  source                TEXT    NOT NULL,
  trace_json            TEXT,
  pointer_speed_variance REAL,
  pointer_jerk            REAL,
  pointer_distance        REAL,
  click_interval_std      REAL,
  keydown_interval_std    REAL,
  focus_count             INTEGER,
  visibility_count        INTEGER,
  automation_flags        TEXT,
  webdriver_detected      INTEGER,
  runtime                 TEXT,
  model_version           TEXT,
  feature_version         TEXT
);
```

**Current store state (7 captures):**

| count | label | sample sources |
|-------|-------|---------------|
| 6 | agent | turnstile, panel demo, example.com |
| 1 | human | panel challenge solve |

The store is live and accepting data from both the agent CLI and the panel API.

### Panel demo page (agent navigating our own captcha)

`MEDIA:/tmp/blog-panel-demo.png`

*The agent navigating panel.goku.codes/demo/agent.*

`MEDIA:/tmp/blog-panel-scrolled.png`

*After scrolling with human-like easing.*

---

## step 6: how panel collects human-labeled samples

When a real user solves a challenge, the widget sends its feature payload to:

```
POST /api/capture
Content-Type: application/json
X-Agent-Trace: false → label='human'

{
  "pointer_speed_variance": 31.2,
  "pointer_jerk": 14.7,
  "pointer_distance": 412,
  "click_interval_std": 48.3,
  "runtime": "rules_only",
  "feature_version": "v1"
}
```

No PII. No raw data. Just behavioral feature vectors. The scrubber proxy strips identifying data before the payload hits the store.

**Every captcha solve = a free labeled training sample.** More traffic = better model.

---

## step 7: what happens at training time (next phase)

When the dataset is large enough, we train a tiny MLP using TensorFlow:

```
input (10 features)
  → dense(16, ReLU)
  → dense(8, ReLU)
  → output (2 classes: human | agent)
  → INT8 quantization
  → TFJS format for browser WASM runtime
```

Target: ≤10MB compressed, <20ms inference desktop, <60ms mobile. Falls back to `rules_only` when model isn't loaded.

**Not deployed yet** — we're collecting data first. The architecture is fully wired; the model is the last piece.

---

## comparison: traditional captcha vs this approach

| dimension | traditional captcha | this approach |
|-----------|-------------------|---------------|
| **output** | pass/fail (1 bit) | structured feature vector (10+ fields) |
| **training data** | none (rules hand-tuned) | automatically labeled from solves + agent runs |
| **attack resistance** | reactive (patch known patterns) | proactive (build the agents, then detect them) |
| **compliance** | processes raw user data | purpose-limited feature vectors, PII stripped |
| **evasion difficulty** | learnable (solve once, automate forever) | must match human behavioral distribution |

---

## the moat

The defensible advantage isn't the captcha — it's the **agent platform that trains it**. By building the best browser agents first:

1. We know exactly what state-of-the-art automation looks like
2. We train our detection on our own agents (the hardest targets)
3. Panel catches the agents we build — because we know what to look for

**The flywheel:**

```
build better agents → harder behavioral traces → better training data →
better detection model → more valuable captcha → more traffic →
more human-labeled data → build better agents → ...
```

No other captcha provider builds browser agents. They wait for attacks and react. We generate attacks from the inside.

---

## run it yourself

```bash
cd agent-platform
npx tsx src/agent.ts 'https://challenges.cloudflare.com/' --headless
npx tsx src/solve-turnstile.ts
npx tsx src/store-stats.ts
npx tsx src/store-stats.ts export
```

Each run produces a labeled capture. Enough runs = a training set.

---

## what's next

- More sophisticated agent behaviors (canvas fingerprint randomization, WebGL spoofing)
- Labeled dataset → tiny MLP training pipeline
- WASM inference integration in the panel widget
- Comparison against real captcha systems (reCAPTCHA v3, Turnhstile, hCaptcha)

---

*Built with panel agent-platform v0.1.*