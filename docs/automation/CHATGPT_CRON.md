# ChatGPT Scheduled Research Contract

GitHub Actions builds deterministic evidence. ChatGPT scheduled tasks perform the research that requires current web/App Store context and product judgment.

## Daily task

Run once per day after the repository's daily collection is expected to exist.

### Inputs

Read from `geekjourneyx/app-store-radar`:

- today's `data/YYYY/MM/DD/` raw partition and manifest;
- `reports/daily/YYYY-MM-DD.md` and `evidence/daily/YYYY-MM-DD.json`;
- the prior 7 daily reports/evidence files;
- the latest `research/daily` and `research/weekly` notes if present;
- open opportunity issues in the repository.

### Required analysis

1. Validate collection health first. Explicitly call out missing chart positions or review gaps.
2. Analyze China paid Top100: new entrants, large movers, persistent climbers/fallers, low-rating-count paid apps, pricing patterns and category clusters.
3. Analyze new review signals: pain, feature request and value signals. Prefer repeated signals across apps/days over isolated comments.
4. Use current web/App Store evidence to validate the most important candidates and search for counter-evidence.
5. Separate **observed facts**, **computed signals**, and **inference**.
6. Produce a short list of ACTION / WATCH / REJECT signals. Zero ACTION is valid.
7. Save the full note to `research/daily/YYYY-MM-DD.md` on `main` with source links and repository evidence paths.
8. For any new high-confidence ACTION that meets BUILD gates, search existing issues first. Create or update one `[Opportunity] <name>` issue; never create a duplicate.
9. The opportunity issue must follow `docs/IOS_PRODUCT_GATE.md` and `geekjourneyx/ios-native-design`.

### Daily BUILD minimum

Do not create a BUILD issue unless at least two independent evidence classes support it and current counter-evidence has been checked. A single chart spike or single review is insufficient.

## Weekly task

Run once per week after the deterministic weekly baseline exists.

### Inputs

- `reports/weekly/YYYY-Www.md` and `evidence/weekly/YYYY-Www.json`;
- all seven daily reports and daily research notes in the week;
- the prior weekly research note;
- current open opportunity issues and their evidence history.

### Required analysis

1. Re-evaluate every ACTION/WATCH candidate across the full seven-day window.
2. Identify signals that persisted, strengthened, weakened or were invalidated.
3. Look for cross-app review clusters and category-level patterns, not only individual apps.
4. Validate commercial model, competitors, Apple platform changes, App Review/policy constraints and technical feasibility.
5. Produce final weekly BUILD / WATCH / REJECT decisions with explicit reasons and confidence.
6. Save to `research/weekly/YYYY-Www.md` on `main`.
7. Create/update a `[Weekly Radar] YYYY-Www` summary issue linking the research note and any opportunity issues.
8. Create/update BUILD opportunity issues. If prior evidence is invalidated, update the existing issue with the downgrade and reason instead of silently abandoning it.

## Evidence rules

Every material claim should be traceable to at least one of:

- repository raw path + app/review id;
- Apple App Store page;
- Apple developer documentation for platform feasibility;
- a trustworthy current external source for market/competitive facts.

Do not estimate downloads or revenue from chart rank/rating count without an explicit external source. Do not call a developer "small" from rating count alone; use **small-developer proxy**.
