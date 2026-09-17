# App Store Radar v2 — Continuous Opportunity Research Design

## Goal

Turn App Store Radar from a raw evidence collector into a continuous product-research loop that preserves evidence, produces readable daily/weekly reports, surfaces review-driven unmet needs, and promotes only externally validated opportunities into iOS development issues.

## System boundary

The system has two complementary layers:

1. **Deterministic repository layer** — GitHub Actions + Node.js collect public Apple evidence, validate data health, compute repeatable signals, and commit machine evidence plus readable Markdown baselines.
2. **ChatGPT research layer** — scheduled ChatGPT runs read the accumulated repository history, validate important claims against current App Store/web sources, search for counter-evidence, write final daily/weekly research notes, and create/update GitHub issues only for actionable opportunities.

The Node layer must never invent product conclusions that require external context. The ChatGPT layer must never overwrite immutable raw partitions or treat a one-day spike as a BUILD decision.

## Evidence flow

```text
Apple Search / Lookup / Reviews / Charts
                ↓
      data/YYYY/MM/DD/ (immutable)
                ↓
      deterministic signal extraction
                ↓
 evidence/daily + reports/daily
                ↓
 ChatGPT external validation + counter-evidence
                ↓
 research/daily/YYYY-MM-DD.md
                ↓
      7-day persistence and synthesis
                ↓
 evidence/weekly + reports/weekly
                ↓
 research/weekly/YYYY-Www.md
                ↓
 BUILD / WATCH / REJECT decision
                ↓
 GitHub Opportunity Issue
                ↓
 ios-native-design development gate
```

## China paid-chart contract

China `top-paid` is a priority surface. Every daily run must attempt to:

- collect all 100 paid-chart entries;
- lookup app metadata for those entries;
- fetch recent reviews for all 100 paid-chart apps before lower-priority review sampling;
- record missing chart positions instead of silently treating 99 rows as a complete Top 100;
- preserve price, rating count, initial release date, current release date, minimum OS version, and App Store URL when public lookup data provides them.

`small-developer-proxy` means **low public rating count + paid-chart persistence**, not verified company size. Reports must state that limitation.

## Review signal model

Review extraction is bilingual and evidence-preserving. Deterministic categories include:

- reliability pain;
- pricing / ownership pain;
- local/private workflow value or demand;
- ad-free demand;
- data portability / sync requests;
- focused/simple workflow value;
- learning transfer requests such as vocabulary → reading/listening/speaking.

Each signal keeps the storefront, app id, review id, rating, intent (`pain`, `request`, `value`), and a short evidence excerpt.

## Decision gates

A machine candidate may be promoted to research when deterministic thresholds pass. A final ChatGPT `BUILD` requires all of:

1. **Demand** — paid-chart presence, rating/review activity, or another concrete adoption proxy.
2. **Gap** — repeated pain/request evidence, preferably across apps or days.
3. **Persistence** — normally at least two independent dates; one-day spikes remain WATCH unless a strong platform event explains them.
4. **Commercial plausibility** — a credible purchase/upgrade model and no obvious incumbent lockout.
5. **Counter-evidence check** — current competitors, Apple built-in capabilities, policy/legal constraints, and obvious substitutes are checked.
6. **Build feasibility** — a small team can validate the core job without requiring network-effect, licensing, regulated, or heavy-content moats that dominate the problem.
7. **iOS-native fit** — the proposed solution can be expressed with native platform behaviors and has a concrete runtime verification path.

Zero BUILDs is a valid report.

## Storage contract

```text
data/YYYY/MM/DD/                  immutable raw evidence
evidence/daily/YYYY-MM-DD.json   deterministic daily evidence
reports/daily/YYYY-MM-DD.md      human-readable daily baseline
evidence/weekly/YYYY-Www.json    deterministic seven-day evidence
reports/weekly/YYYY-Www.md       human-readable weekly baseline
research/daily/YYYY-MM-DD.md     ChatGPT-enriched daily research
research/weekly/YYYY-Www.md      ChatGPT-enriched weekly decision memo
```

## Opportunity issue contract

ChatGPT creates an opportunity issue only when a candidate is new or materially changed and final evidence supports action. The issue contains:

- problem / JTBD;
- evidence chain with dates, ranks, app ids, review ids, and source links;
- counter-evidence;
- target user;
- smallest MVP;
- pricing hypothesis;
- validation and kill criteria;
- iOS-native screen contract;
- Apple APIs / platform leverage;
- privacy/local-first stance;
- Design DoD and runtime verification plan.

Duplicate issues are updated, not recreated.

## iOS development gate

Any BUILD issue must follow `geekjourneyx/ios-native-design`:

- establish the screen contract before styling;
- native component first;
- semantic tokens/colors and Dynamic Type;
- minimum 44×44 pt interactive targets;
- loading/empty/populated/error/long-content states where relevant;
- VoiceOver and accessibility semantics;
- run the real app and exercise the primary flow;
- capture Device Hub full-resolution screenshots when available;
- validate Light/Dark, Dynamic Type and applicable environment variants;
- convert stable critical paths into deterministic XCUI regression tests;
- do not call design complete from source review, preview, or one screenshot alone.
