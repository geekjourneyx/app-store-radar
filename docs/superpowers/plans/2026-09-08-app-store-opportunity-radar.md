# App Store Opportunity Radar v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an unattended App Store evidence pipeline that collects daily public data, computes deterministic opportunity signals, rejects common false positives, and publishes a weekly auditable opportunity report.

**Architecture:** Use a zero-service Node.js CLI with built-in `fetch`, `node:test`, and the filesystem. Daily GitHub Actions runs write immutable NDJSON partitions under `data/YYYY/MM/DD`; weekly analysis reads repository history, generates `evidence/YYYY-Www.json` and `reports/YYYY-Www.md`, and commits only changed artifacts. The baseline requires no secrets or hosted database.

**Tech Stack:** Node.js 22+, ES modules, built-in `fetch`, `node:test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-08-app-store-opportunity-radar-design.md`

## Global Constraints

- Storefronts default to `us`, `cn`, `jp`.
- Search ordering is named `discovery_position`, never real App Store rank.
- No required external database, dashboard, vector store, Apple Ads API, or paid service.
- Daily collection and weekly reporting are separate schedules.
- Scheduled runs never overwrite an existing daily partition.
- Tests use fixtures, not live Apple endpoints.
- A weekly report may contain zero `BUILD` opportunities.
- Hard feasibility/economics gates override numeric scores.

---

## File map

- `package.json` — runtime scripts and Node version contract.
- `config/radar.json` — storefronts, job seeds, caps, thresholds.
- `src/apple.js` — Apple endpoint URL builders and network client.
- `src/normalize.js` — normalize Apple search/lookup/review/chart payloads.
- `src/storage.js` — deterministic NDJSON/JSON partition I/O and history discovery.
- `src/collect.js` — daily orchestration and manifest generation.
- `src/signals.js` — deterministic velocity/momentum/persistence calculations.
- `src/opportunities.js` — review-gap aggregation, noise rules, hard gates, verdicts.
- `src/report.js` — weekly evidence JSON and Markdown rendering.
- `src/cli.js` — `collect` and `weekly` commands.
- `test/fixtures/*` — Apple-like fixture payloads and historical snapshots.
- `test/*.test.js` — unit/integration tests.
- `.github/workflows/daily.yml` — unattended daily collection and commit.
- `.github/workflows/weekly.yml` — unattended weekly analysis and commit.
- `README.md` — setup, data semantics, manual commands, automation.

### Task 1: Runtime skeleton and configuration

**Files:**
- Create: `package.json`
- Create: `config/radar.json`
- Create: `test/config.test.js`

**Interfaces:**
- Produces: JSON config with `storefronts`, `seeds`, `search_limit`, `reviews_per_app`, `chart_types`, `thresholds`.

- [ ] **Step 1: Write failing configuration test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('radar config uses job seeds and three default storefronts', async () => {
  const config = JSON.parse(await readFile(new URL('../config/radar.json', import.meta.url)));
  assert.deepEqual(config.storefronts, ['us', 'cn', 'jp']);
  assert.ok(config.seeds.length >= 10);
  assert.ok(config.seeds.every((seed) => seed.query && seed.kind === 'job'));
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm test -- test/config.test.js`
Expected: FAIL because configuration/runtime files do not exist.

- [ ] **Step 3: Add minimal package/config**

`package.json` uses `"type": "module"`, Node `>=22`, and scripts `test`, `collect`, `weekly`.

`config/radar.json` starts with US/CN/JP, job-oriented seeds such as `voice notes`, `habit tracker`, `expense tracker`, `journal`, `meal planner`, `focus timer`, `receipt scanner`, `language learning`, `travel planner`, `photo editor`, `video editor`, `calendar`, `sleep tracker`, `fitness`, `pdf scanner`; search limit 50; reviews cap 100/app/storefront; chart types `top-free`, `top-paid`.

- [ ] **Step 4: Run test and verify GREEN**

Run: `npm test -- test/config.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "chore: add radar runtime and configuration"`

### Task 2: Apple source client and normalization

**Files:**
- Create: `src/apple.js`
- Create: `src/normalize.js`
- Create: `test/apple.test.js`
- Create: `test/fixtures/search.json`
- Create: `test/fixtures/reviews.json`
- Create: `test/fixtures/chart.json`

**Interfaces:**
- Produces: `searchApps(query, storefront, limit)`, `lookupApps(ids, storefront)`, `fetchReviews(appId, storefront, maxPages)`, `fetchChart(storefront, chartType, limit)`.
- Produces normalization functions returning stable plain objects.

- [ ] **Step 1: Write failing tests**

Cover exact endpoint construction, timeout/retry wrapper via injected fetch, `discovery_position` naming, stable review IDs, and ordered chart positions. Assert no normalized field named `rank` exists for search discovery.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/apple.test.js`
Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement minimal source client**

Use built-in `fetch` with `AbortSignal.timeout(15000)`, two retries for retryable network/5xx failures, and dependency injection for tests. Use:

- `https://itunes.apple.com/search`
- `https://itunes.apple.com/lookup`
- `https://itunes.apple.com/{storefront}/rss/customerreviews/.../json`
- `https://rss.applemarketingtools.com/api/v2/{storefront}/apps/{chartType}/{limit}/apps.json`

- [ ] **Step 4: Implement normalization**

Normalize only fields required by the spec. Sort object lists by stable keys where source ordering is not semantically meaningful.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- test/apple.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add Apple public data collectors"`

### Task 3: Deterministic immutable storage

**Files:**
- Create: `src/storage.js`
- Create: `test/storage.test.js`

**Interfaces:**
- Produces: `partitionPath(date)`, `writePartition(root, date, payload)`, `listPartitions(root)`, `readHistory(root)`.

- [ ] **Step 1: Write failing tests**

Test path format `data/2026/09/08`, deterministic NDJSON ordering, refusal to overwrite an existing partition, and chronological history discovery.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/storage.test.js`
Expected: FAIL because storage module is missing.

- [ ] **Step 3: Implement storage**

Write `apps.ndjson`, `search.ndjson`, `reviews.ndjson`, `charts.ndjson`, and `manifest.json`. Sort records by stable compound keys before serialization. Throw `PARTITION_EXISTS` on overwrite unless an explicit test-only destination is empty.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- test/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add immutable daily storage"`

### Task 4: Daily collection orchestration

**Files:**
- Create: `src/collect.js`
- Create: `test/collect.test.js`

**Interfaces:**
- Consumes Apple client + storage.
- Produces: `collectDay({ date, config, client, root }) -> manifest`.

- [ ] **Step 1: Write failing integration test**

Use fake client fixtures. Verify search + charts build one deduplicated tracked-app set, lookup metadata is written once per app/storefront, reviews are deduplicated by review ID, and one failed storefront/query is recorded in manifest without discarding successful data.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/collect.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement minimal orchestration**

Bound concurrency, continue on per-source errors, require at least one successful source, and record success/failure counters plus exact failed operations in manifest.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- test/collect.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: orchestrate daily evidence collection"`

### Task 5: Deterministic temporal signals

**Files:**
- Create: `src/signals.js`
- Create: `test/signals.test.js`

**Interfaces:**
- Produces: `buildSignals(history, options)` with rating velocity, rating acceleration, review velocity, chart momentum, release velocity, and search presence.

- [ ] **Step 1: Write failing tests**

Fixture history must demonstrate:

- rating count growth is measured as delta, not absolute popularity;
- acceleration compares comparable windows only when enough history exists;
- chart position 80 -> 20 is positive momentum;
- search uses `discovery_position` but never emits `app_store_rank`;
- missing days reduce confidence rather than becoming zero activity.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/signals.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement signal calculations**

Keep formulas deterministic and include evidence dates/values in every signal object.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- test/signals.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: compute temporal App Store signals"`

### Task 6: Opportunity gates and noise rejection

**Files:**
- Create: `src/opportunities.js`
- Create: `test/opportunities.test.js`
- Create: `test/fixtures/opportunity-history.json`

**Interfaces:**
- Produces: `evaluateCandidates({ history, signals, config }) -> candidates[]`.
- Candidate fields: `observed`, `computed`, `inferred`, `noise_flags`, `gates`, `score`, `verdict`.

- [ ] **Step 1: Write failing version-incident test**

Create a fixture where one app gets a sudden burst of one-star `crash/login` complaints immediately after one release. Assert verdict is not `BUILD` and `VERSION_INCIDENT` is present.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/opportunities.test.js`
Expected: FAIL.

- [ ] **Step 3: Add cross-app persistent-gap failing test**

Create three apps where independent reviews repeatedly request export/Markdown/local ownership across multiple dates, with positive rating/review momentum. Assert the aggregated underlying job `data portability` can pass demand, gap, cross-app, persistence gates and become `BUILD` when economics/feasibility fixture evidence is positive.

- [ ] **Step 4: Implement deterministic review-gap rules**

Use transparent keyword/pattern dictionaries for v1 categories and unmet-job mappings. Keep raw matched review IDs in evidence. Do not introduce an opaque LLM dependency.

- [ ] **Step 5: Implement hard gates and scoring**

Apply weights from spec. A blocking feasibility/economics value forces `REJECT`; insufficient evidence forces `WATCH`; only all mandatory gates passing permits `BUILD`.

- [ ] **Step 6: Verify GREEN**

Run: `npm test -- test/opportunities.test.js`
Expected: PASS for both false-positive and positive fixtures.

- [ ] **Step 7: Commit**

`git commit -m "feat: gate opportunities and reject noise"`

### Task 7: Weekly evidence bundle and report

**Files:**
- Create: `src/report.js`
- Create: `test/report.test.js`

**Interfaces:**
- Produces: `buildWeeklyEvidence(...)`, `renderWeeklyMarkdown(evidence)`.

- [ ] **Step 1: Write failing tests**

Verify zero-opportunity weeks render honestly, `BUILD/WATCH/REJECT` are separated, facts/computed/inference are labeled, and each promoted candidate includes counter-evidence + feasibility section.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/report.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement deterministic evidence/report rendering**

Produce stable JSON and Markdown ordering. Short representative review excerpts only; preserve IDs so the bundle remains auditable.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- test/report.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: generate weekly opportunity reports"`

### Task 8: CLI and end-to-end fixture verification

**Files:**
- Create: `src/cli.js`
- Create: `test/cli.test.js`

**Interfaces:**
- `node src/cli.js collect [--date YYYY-MM-DD] [--root PATH]`
- `node src/cli.js weekly [--date YYYY-MM-DD] [--root PATH]`

- [ ] **Step 1: Write failing CLI tests**

Spawn commands against a temporary fixture repository. Assert exit codes, created paths, and safe refusal to overwrite a daily partition.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/cli.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement CLI**

Use explicit commands and clear stderr messages. `weekly` derives ISO week from provided/current UTC date.

- [ ] **Step 4: Verify GREEN and full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add radar command line interface"`

### Task 9: GitHub Actions automation

**Files:**
- Create: `.github/workflows/daily.yml`
- Create: `.github/workflows/weekly.yml`
- Create: `test/workflows.test.js`

**Interfaces:**
- Daily schedule runs collector and commits new `data/` partitions.
- Weekly schedule runs after the daily cadence window and commits `evidence/` + `reports/`.

- [ ] **Step 1: Write failing workflow contract test**

Read YAML as text and assert both support `workflow_dispatch`, use Node 22, declare `contents: write`, run tests before generation, and only commit when `git diff --quiet` is false.

- [ ] **Step 2: Verify RED**

Run: `npm test -- test/workflows.test.js`
Expected: FAIL.

- [ ] **Step 3: Add workflows**

Daily cron: `17 1 * * *` UTC.
Weekly cron: `47 2 * * 1` UTC (Monday), after the daily job's normal window.

Both workflows configure a bot commit identity, `git pull --rebase` before push, and push to `main` only after tests/generation succeed.

- [ ] **Step 4: Verify GREEN**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

`git commit -m "ci: automate daily collection and weekly reports"`

### Task 10: Documentation and production verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Documents data semantics, limitations, local commands, automation, evidence model, and extension points.

- [ ] **Step 1: Update README**

Document that Search API ordering is discovery-only; ratings/reviews are proxies, not downloads; daily collection is required; weekly output may contain zero opportunities; no secrets are required for baseline.

- [ ] **Step 2: Run full verification**

Run: `npm test`
Expected: all tests PASS with no network dependency.

Run: `node src/cli.js weekly --date 2026-09-08 --root test/fixtures/repo`
Expected: deterministic fixture evidence/report generation.

- [ ] **Step 3: Optional live smoke test**

Run one constrained collector invocation using small caps. If Apple endpoints are unavailable, record this as an external smoke-test limitation; do not weaken fixture tests.

- [ ] **Step 4: Final review**

Confirm no dashboard/database/service dependency, no `app_store_rank` claim, no committed secrets, and no workflow overwrites daily partitions.

- [ ] **Step 5: Commit**

`git commit -m "docs: document unattended opportunity radar"`
