# App Store Radar

App Store Radar detects emerging product opportunities from **real user demand, unmet needs, market momentum, and build feasibility — not popularity alone**.

## What v1 does

- Collects Apple public App Store evidence every day for US, China, and Japan.
- Stores immutable daily search discovery, app metadata, reviews, charts, and source-health manifests in Git.
- Computes deltas such as rating velocity, review velocity, chart momentum, release velocity, and search presence.
- Aggregates persistent review gaps across apps and rejects common false positives such as version incidents.
- Produces one weekly evidence bundle and Markdown report with `BUILD`, `WATCH`, and `REJECT` verdicts.

## Important semantics

- iTunes Search ordering is recorded as **`discovery_position`**. It is **not** claimed to be the real iPhone App Store keyword rank.
- Rating/review momentum is an adoption proxy, **not** download or revenue data.
- Missing review feeds are treated as missing evidence, never zero demand.
- A weekly report may contain **zero opportunities**. Silence is preferable to weak evidence.

## Runtime

Node.js 22+; no database, dashboard, paid API, or secret is required for the baseline pipeline.

```bash
npm test
npm run collect -- --date 2026-09-08
npm run weekly -- --date 2026-09-08
```

Daily partitions are written to `data/YYYY/MM/DD/`; weekly machine-readable evidence to `evidence/YYYY-Www.json`; reports to `reports/YYYY-Www.md`.

## Automation

- `.github/workflows/daily.yml`: runs daily at 01:17 UTC, tests, collects evidence, and commits new partitions. Re-running the same UTC date is a safe no-op if that partition already exists.
- `.github/workflows/weekly.yml`: runs Mondays at 02:47 UTC, tests, generates the weekly report, and commits it.
- `.github/workflows/ci.yml`: runs the test suite for pull requests and pushes to `main`.
- Daily and weekly workflows also support `workflow_dispatch`.

The schedules intentionally separate **daily evidence accumulation** from **weekly reasoning**. Weekly-only collection would lose high-volume reviews and make acceleration impossible to measure reliably.

## Evidence model

An opportunity is not promoted because one app is popular. v1 requires corroborated demand, a recurring gap, cross-app evidence, persistence, feasibility, and plausible economics. Numeric scores are explanatory; hard gates override them.

The deterministic v1 review-gap engine is intentionally transparent. Current platform/legal feasibility checks and richer semantic clustering can be added later as optional enrichment, but must not become required infrastructure.

## Design docs

- `docs/superpowers/specs/2026-09-08-app-store-opportunity-radar-design.md`
- `docs/superpowers/plans/2026-09-08-app-store-opportunity-radar.md`
