<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="App Store Radar turns public App Store signals into evidence-backed product opportunity decisions.">
</p>

# App Store Radar

Find commercial product opportunities from **real App Store demand, unmet needs, market momentum, review evidence, and counter-evidence — not popularity alone**.

```text
Apple public evidence
        ↓
immutable daily snapshots
        ↓
compact deterministic signal brief
        ↓
current App Store/web validation
        ↓
BUILD / WATCH / REJECT
        ↓
opportunity issue or explicit no-opportunity conclusion
```

## What the radar optimizes for

The radar is a **research system**, not an app-design system.

It should answer:

1. What concrete user job is showing real demand?
2. Is the signal repeated across apps or time?
3. Is there a supply gap?
4. Is there a plausible way to charge?
5. What counter-evidence could kill the idea?
6. Is a short validation experiment worth the time?

Zero BUILDs is a valid result.

## Noise reduction

Generic attributes are useful signals but are not standalone product ideas:

- ad-free;
- cheap / one-time purchase;
- simple / focused;
- local-first / private;
- export / sync / portability.

Generic praise such as “好用 / 很好用” is filtered from opportunity promotion. A single review, one-day rank spike, temporary regression, low rating count, or viral ad impression count cannot become BUILD by itself.

Deterministic machine triage uses:

- `INVESTIGATE` — product-specific signal that clears basic repeatability gates;
- `WATCH` — real signal that is incomplete or represents a broad market principle;
- `REJECT` — noise or a non-opportunity pattern.

Final externally validated research uses `BUILD / WATCH / REJECT`.

## China paid Top100

China paid Top100 remains a first-class discovery surface:

- attempt all 100 paid-chart apps before lower-priority review sampling;
- record missing positions instead of treating missing data as zero;
- preserve price, rating count, release/update dates and minimum OS version when Apple exposes them;
- use low public rating count only as a **small-developer proxy**, never as proof of team size.

## Evidence model

```text
Concrete JTBD
  ↓
Demand / repeated pain
  ↓
Persistence
  ↓
Supply gap
  ↓
Commercial plausibility
  ↓
Counter-evidence
  ↓
Short validation decision
```

## Repository layout

```text
data/YYYY/MM/DD/                  immutable raw Apple evidence
  apps.ndjson
  charts.ndjson
  reviews.ndjson
  search.ndjson
  manifest.json

evidence/daily/YYYY-MM-DD.json   deterministic daily evidence
reports/daily/YYYY-MM-DD.md      compact daily baseline

evidence/weekly/YYYY-Www.json    deterministic seven-day evidence
reports/weekly/YYYY-Www.md       compact weekly baseline

research/daily/YYYY-MM-DD.md     externally validated daily research
research/weekly/YYYY-Www.md      externally validated weekly decision memo
```

Raw `data/` stays immutable. The `research/` layer is where current competition, pricing, counter-evidence, policy/API constraints and commercial judgment are added.

## Review signals

Deterministic extraction keeps evidence excerpts and focuses on specific signals:

- reliability incidents;
- pricing / ownership;
- local/private workflow;
- ad-free value/pain;
- explicit export/import/data-portability requests;
- explicit focused-workflow requests;
- learning-transfer gaps such as vocabulary → reading/listening/speaking.

Specific signals suppress generic “好用” matches from the same review.

## Run locally

Requires Node.js 22+.

```bash
npm test
npm run collect -- --date 2026-09-18
npm run daily -- --date 2026-09-18
npm run weekly -- --date 2026-09-18
```

No database, dashboard, paid API, or secret is required for the baseline collector.

## Automation

### GitHub Actions

- `.github/workflows/daily.yml` — daily collection + compact daily report, committed to `main`.
- `.github/workflows/weekly.yml` — seven-day deterministic baseline, committed to `main`.

### ChatGPT scheduled research

See [`docs/automation/CHATGPT_CRON.md`](./docs/automation/CHATGPT_CRON.md).

Scheduled research should:

- validate only the strongest 0–5 candidates;
- produce a compact opportunity table with full evidence chain;
- explain why an opportunity is worth doing and what could invalidate it;
- keep broad market signals separate from product opportunities;
- create/update opportunity issues only for BUILD;
- explicitly report “no opportunity worth building” when evidence is insufficient.

Implementation and UI/design review are intentionally outside the Radar research loop.

## Evidence guardrails

- `discovery_position` is discovery ordering, not real iPhone App Store keyword rank.
- Rating/review momentum is an adoption proxy, not a download or revenue estimate.
- Missing source data is missing evidence, never zero demand.
- Low rating count is not proof of team size.
- Version incidents and short-lived spikes are filtered before promotion.
- Viral views are acquisition evidence, not product-market-fit evidence.
- Machine `INVESTIGATE` means “worth external research,” not “build this.”
- A weekly report may contain zero opportunities. Silence is better than weak evidence.
