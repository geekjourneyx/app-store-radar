<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="App Store Radar turns public App Store signals into evidence-backed product opportunity decisions.">
</p>

# App Store Radar

Find product opportunities from **real App Store demand, unmet needs, market momentum, review evidence, and build feasibility — not popularity alone**.

App Store Radar is a continuous research loop:

```text
Apple public evidence
        ↓
immutable daily snapshots
        ↓
readable daily signal report
        ↓
ChatGPT current validation + counter-evidence
        ↓
weekly BUILD / WATCH / REJECT decision
        ↓
GitHub opportunity issue
        ↓
ios-native-design product gate
```

## What v2 changes

The repository is no longer just a pile of NDJSON snapshots.

Every day it now produces:

- raw immutable App Store evidence;
- collection-health checks, including missing chart positions;
- a readable China paid-chart brief;
- movers and new entrants;
- `small-developer-proxy` signals based on low public rating count + paid-chart persistence;
- bilingual review pain / request / value signals;
- machine opportunity triage with an evidence chain.

Every week it produces a seven-day baseline with persistent paid-chart signals, review clusters, and provisional BUILD / WATCH / REJECT candidates. Scheduled ChatGPT research then adds current web/App Store validation and turns only high-confidence opportunities into GitHub issues.

## China paid Top100 is a first-class signal

The China paid chart is treated as a priority discovery surface:

- all 100 paid-chart apps are attempted for review monitoring before lower-priority sampling;
- rank gaps such as `1…99` with missing `100` are recorded as incomplete collection health;
- public metadata such as price, rating count, initial release date, version release date and minimum OS version are preserved when Apple provides them;
- low rating-count paid apps are surfaced as a **small-developer proxy**, never asserted to be verified small teams.

## Evidence model

```text
Demand
  ↓
Supply gap / review pain
  ↓
Persistence
  ↓
Commercial plausibility
  ↓
Counter-evidence
  ↓
Build feasibility
  ↓
iOS-native fit
  ↓
BUILD / WATCH / REJECT
```

A single spike is not enough. Weak or contradictory evidence stays in WATCH or is rejected. Zero BUILDs is a valid outcome.

## Repository layout

```text
data/YYYY/MM/DD/                  immutable raw Apple evidence
  apps.ndjson
  charts.ndjson
  reviews.ndjson
  search.ndjson
  manifest.json

evidence/daily/YYYY-MM-DD.json   deterministic daily evidence
reports/daily/YYYY-MM-DD.md      readable daily baseline

evidence/weekly/YYYY-Www.json    deterministic seven-day evidence
reports/weekly/YYYY-Www.md       readable weekly baseline

research/daily/YYYY-MM-DD.md     ChatGPT-enriched daily research
research/weekly/YYYY-Www.md      ChatGPT-enriched weekly decision memo
```

The `research/` layer is intentionally agent-authored: it is where current App Store/web validation, counter-evidence and product judgment live. Raw `data/` partitions stay immutable.

## Review signals

Deterministic extraction supports both English and Chinese review text and keeps short evidence excerpts. Current signal families include:

- reliability;
- pricing / ownership;
- local/private workflow;
- ad-free experience;
- data portability / sync;
- simple/focused workflow;
- learning transfer such as vocabulary → reading/listening/speaking.

Review matches are evidence, not conclusions. Scheduled research must validate the surrounding product context before BUILD.

## Run locally

Requires Node.js 22+.

```bash
npm test
npm run collect -- --date 2026-09-17
npm run daily -- --date 2026-09-17
npm run weekly -- --date 2026-09-17
```

No database, dashboard, paid API, or secret is required for the baseline collector.

## Automation

### GitHub Actions

- `.github/workflows/daily.yml` — daily collection + readable daily report, committed to `main`.
- `.github/workflows/weekly.yml` — seven-day deterministic baseline, committed to `main`.

### ChatGPT scheduled research

See [`docs/automation/CHATGPT_CRON.md`](./docs/automation/CHATGPT_CRON.md).

The scheduled ChatGPT layer should:

- read the latest repository evidence and prior reports;
- validate important signals against current App Store/web sources;
- look for counter-evidence;
- write `research/daily` and `research/weekly` notes;
- create/update opportunity issues only when BUILD gates are met;
- avoid duplicate issues;
- keep observed facts, computed signals and inference visibly separate.

## From opportunity to iOS product

An App Store signal does not go straight into implementation.

BUILD issues follow [`docs/IOS_PRODUCT_GATE.md`](./docs/IOS_PRODUCT_GATE.md) and the [`ios-native-design`](https://github.com/geekjourneyx/ios-native-design) standard:

- screen contract before styling;
- native SwiftUI component first;
- semantic colors/tokens and Dynamic Type;
- 44×44 pt minimum interactive hit region;
- VoiceOver/accessibility semantics;
- real-app runtime verification;
- Device Hub full-resolution screenshots when available;
- Light/Dark + accessibility Dynamic Type checks;
- stable flows encoded as XCUI regression tests;
- Design DoD before shipping.

## Evidence guardrails

- Search ordering is stored as `discovery_position`; it is **not** treated as the real iPhone App Store keyword rank.
- Rating/review momentum is an adoption proxy; it is **not** a download or revenue estimate.
- Missing source data is recorded as missing evidence, never interpreted as zero demand.
- A low rating count is **not** proof of team size; reports call it a `small-developer-proxy` only.
- Version incidents and other obvious short-lived spikes are filtered before opportunity promotion.
- Machine `BUILD` means “promote to research”; final BUILD requires current external validation.
- A weekly report may contain **zero opportunities**. Silence is better than weak evidence.
