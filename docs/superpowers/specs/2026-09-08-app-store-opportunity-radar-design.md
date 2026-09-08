# App Store Opportunity Radar — v1 Design

## Purpose

App Store Radar detects emerging product opportunities from real App Store demand, unmet needs, market momentum, and build feasibility — not popularity alone.

The v1 goal is an unattended, reproducible pipeline that accumulates daily App Store evidence and produces one weekly opportunity report with a small number of high-confidence candidates. It must prefer silence over weak claims.

## Product principles

1. **Delta over snapshot.** Raw popularity is not an opportunity signal; changes over time are.
2. **Evidence before conclusion.** No single signal can promote an opportunity.
3. **Reject noise aggressively.** Version incidents, brand queries, campaigns, review bombing, and seasonality must be treated as alternative explanations.
4. **Separate facts from inference.** Raw observations, computed signals, and final opportunity judgments are stored separately.
5. **Reproducible by default.** Data and reports live in Git; no required hosted database or dashboard.
6. **Daily collection, weekly reasoning.** Weekly-only collection loses reviews and cannot measure acceleration reliably.

## Scope

### In scope for v1

- Storefronts: `us`, `cn`, `jp`.
- Apple public endpoints:
  - iTunes Search API for discovery.
  - iTunes Lookup API for app metadata and rating snapshots.
  - Apple Marketing Tools chart feeds for chart snapshots.
  - App Store customer-review RSS/JSON feeds for recent written reviews.
- Seed-based discovery with configurable job-oriented keywords.
- Daily immutable NDJSON partitions.
- Daily delta computation from repository history.
- Candidate signal generation.
- Weekly evidence bundles and Markdown report.
- Hard opportunity gates and explicit `BUILD`, `WATCH`, `REJECT` verdicts.
- GitHub Actions for unattended daily collection and weekly report generation.

### Explicitly out of scope

- Web dashboard.
- PostgreSQL, Elasticsearch, Kafka, vector databases, or always-on backend services.
- Claiming iTunes Search API ordering is the real iPhone App Store keyword rank.
- Download/revenue estimates presented as facts.
- Apple Ads API as a required dependency.
- Automated product building from detected opportunities.

## Source-of-truth model

### Search discovery

Search responses are used to answer: *which apps are associated with this job-oriented query in this storefront?*

The order is stored as `discovery_position`, never `app_store_rank`.

### App snapshots

For every tracked app and storefront, persist fields needed for temporal analysis, including:

- app ID, bundle ID, name, seller, genres;
- price/currency;
- average rating and rating count;
- current-version rating/count when present;
- version, release date, release notes;
- description and App Store URL.

### Reviews

Persist stable review IDs and enough context to reason about unmet jobs:

- review ID;
- app ID;
- storefront;
- rating;
- title/body;
- app version;
- author;
- created timestamp.

Collectors must tolerate malformed or unavailable review feeds. A missing feed is an observation gap, not a zero-review fact.

### Charts

Persist ordered chart entries from Apple Marketing Tools for configured chart types. v1 starts with `top-free` and `top-paid` when available.

## Repository data layout

Raw data is append-only by UTC date:

```text
data/
  YYYY/
    MM/
      DD/
        apps.ndjson
        search.ndjson
        reviews.ndjson
        charts.ndjson
        manifest.json
```

Reports are versioned separately:

```text
reports/
  YYYY-Www.md
```

Machine-readable weekly evidence bundles:

```text
evidence/
  YYYY-Www.json
```

No SQLite database is committed to Git.

## Configuration

`config/radar.json` defines:

- storefronts;
- seed queries;
- search result limits;
- chart types;
- opportunity thresholds;
- optional per-run caps.

Seeds describe jobs, not brands. Brand-heavy queries may exist only when explicitly tagged for comparison and are excluded from opportunity generation by default.

## Daily pipeline

1. Load configuration.
2. Search every seed query in each storefront.
3. Build the tracked-app set from search results plus chart entries.
4. Lookup app metadata.
5. Fetch recent reviews for tracked apps within configured caps.
6. Normalize and deduplicate records by stable keys.
7. Write one immutable daily partition plus a manifest recording source success/failure counts.
8. Compute deterministic deltas against earlier available partitions.
9. Emit candidate machine signals for weekly analysis.

A partial source failure must not discard successful source data. The manifest exposes gaps explicitly.

## Deterministic signals

The v1 signal engine computes facts that do not require an LLM:

### Rating velocity

Change in `userRatingCount` over an available lookback window.

### Rating acceleration

Recent rating velocity versus the preceding comparable window when enough history exists.

### Review velocity

Count of newly observed stable review IDs per app/storefront and window.

### Chart momentum

Improvement or persistence in chart position over available snapshots.

### Release velocity

Observed release cadence from version/release dates and changes.

### Search presence

Breadth and persistence across job-oriented queries. This is explicitly not real device search rank.

## Review-gap reasoning

Weekly analysis classifies review evidence into:

- bug/regression;
- feature request;
- workflow gap;
- integration gap;
- pricing gap;
- UX gap;
- trust/privacy concern;
- platform limitation;
- support problem.

A candidate product gap should be promoted only when the underlying unmet job is supported by multiple independent reviews and, preferably, multiple apps.

The reasoning step must abstract one level above literal feature requests. Example:

`"export to Obsidian" -> data portability -> local/owned knowledge workflow -> adjacent jobs: Markdown, Logseq, local files, API.`

## Noise filters

The weekly analyzer must actively test alternative explanations:

### Version incident

A review spike concentrated immediately after one release and dominated by one bug cluster is an incident, not a new market opportunity.

### Paid-promotion / campaign anomaly

Chart movement without corroborating rating/review momentum is weak evidence.

### Review bombing

Large rating/review shocks dominated by policy, politics, bans, or a one-off controversy are excluded from product-gap scoring.

### Brand demand

Brand/navigation queries are not treated as unmet job demand.

### Seasonality

When insufficient year-over-year history exists, seasonal categories are marked with reduced confidence rather than asserted as structural growth.

## Opportunity model

An opportunity is evaluated on seven dimensions:

| Dimension | Weight |
| --- | ---: |
| Demand strength | 20 |
| Supply gap | 20 |
| Momentum | 15 |
| Pain recurrence | 15 |
| Monetization evidence | 10 |
| Build feasibility | 15 |
| Independent corroboration | 5 |

The score is explanatory, not sufficient. Hard gates override the score.

## Hard gates

A weekly candidate may be labeled `BUILD` only if all mandatory gates pass:

1. **Demand:** at least two independent demand observations.
2. **Gap:** at least two independent supply-gap observations.
3. **Cross-source or cross-app:** the conclusion is not dependent on one app/review cluster alone.
4. **Persistence:** evidence is not explained by one incident window.
5. **Feasibility:** no known iOS/platform/legal blocker makes the core job unrealistic.
6. **Economics:** there is a plausible willingness-to-pay or acquisition path grounded in observed market behavior.

Candidates failing a non-fatal evidence gate become `WATCH`. Candidates with a blocking feasibility/economics problem become `REJECT`.

## Evidence bundle

Every weekly candidate must carry an auditable bundle with:

- observed facts and dates;
- app/storefront/query references;
- quantitative deltas;
- representative review excerpts kept short;
- identified gap and underlying job;
- adjacent opportunity tree;
- alternative explanations considered;
- monetization evidence;
- engineering feasibility assessment;
- confidence level;
- gate results;
- final verdict.

The report must clearly distinguish `observed`, `computed`, and `inferred` fields.

## Engineering feasibility assessment

For each promoted candidate, report:

- MVP scope;
- difficulty 1–5;
- estimated implementation shape (`days`, `weeks`, not guaranteed delivery time);
- backend complexity: low/medium/high;
- AI dependency/cost: low/medium/high;
- iOS framework/entitlement dependencies;
- privacy/compliance risk;
- platform-incumbent risk;
- solo-builder fit 1–5;
- biggest technical unknowns.

External/current platform claims used here must be cited in the weekly evidence when web verification is available. The deterministic pipeline itself must not invent them.

## Weekly report

The report prioritizes quality over count. It may contain zero opportunities.

Recommended order:

1. Executive summary.
2. Confirmed opportunities (`BUILD`).
3. Watchlist (`WATCH`).
4. Rejected false positives worth learning from.
5. New demand phrases / review gaps.
6. Collection health and missing-data caveats.

Each opportunity includes: evidence chain, why now, supply gap, underlying job, adjacent opportunities, monetization, development difficulty, counter-evidence, and verdict.

## Automation

### Daily workflow

- Run once per day on GitHub Actions.
- Collect current public data.
- Commit only when generated data changed.
- Use least-privilege `contents: write`.
- Manual `workflow_dispatch` supported.

### Weekly workflow

- Run once per week after sufficient daily history has accumulated.
- Generate evidence bundle and report from repository data.
- Commit report/evidence only when changed.
- Manual `workflow_dispatch` supported.

The workflow must remain useful without secrets. Optional future LLM or Apple Ads enrichment must be additive, never required for baseline collection.

## Reliability requirements

- Network operations use bounded retries and timeouts.
- A failed storefront/query/app does not fail the entire collection unless no meaningful source succeeds.
- Every run emits source-health statistics.
- Output ordering is deterministic to minimize noisy Git diffs.
- Existing date partitions are never silently overwritten by scheduled runs.
- Tests use fixtures and do not require live Apple endpoints.

## Success criteria for v1

1. A clean checkout can run tests with one standard runtime.
2. Daily collector can produce a valid partition from fixtures and from live Apple endpoints when network is available.
3. Re-running the same fixture collection is deterministic and deduplicated.
4. Signal calculations distinguish growth from snapshots and avoid calling search position a real App Store rank.
5. Weekly report can return zero candidates when gates are not met.
6. At least one fixture scenario proves a version incident is downgraded instead of promoted.
7. At least one fixture scenario proves a cross-app persistent gap can become a `BUILD` candidate.
8. GitHub Actions are fully unattended and require no paid infrastructure.
