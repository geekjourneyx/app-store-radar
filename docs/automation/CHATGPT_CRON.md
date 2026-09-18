# ChatGPT Scheduled Research Contract

GitHub Actions collects deterministic App Store evidence. Scheduled research has one job:

> **Find evidence-backed commercial opportunities, or clearly say there are none.**

The research layer should be compact, skeptical, and decision-oriented. Do not repeat raw Top100 tables or generic review praise.

## Daily task

Run once per day after the daily collection is expected to exist.

### Inputs

Read from `geekjourneyx/app-store-radar`:

- latest complete `data/YYYY/MM/DD/` partition and manifest;
- matching `evidence/daily` and `reports/daily`;
- prior 7 days of evidence/reports;
- latest `research/daily` and `research/weekly`;
- current open opportunity issues.

If today's partition is incomplete, use the latest complete partition and state the data date.

### High-signal rules

A product opportunity must be a **concrete JTBD**, not a generic product attribute.

Treat these as market/product principles unless tied to a specific repeated job:

- ad-free;
- cheap / one-time purchase;
- simple / focused;
- local-first / private;
- export / sync / portability.

Do not promote the following by themselves:

- generic praise such as “好用 / 很好用 / nice / love it”;
- a single review;
- a single-day chart spike;
- a version incident;
- an ad/social post with high views but no conversion evidence;
- seasonal/brand traffic;
- a low rating count alone;
- “AI + X” where supply is already dense and the gap is only UI.

A strong candidate usually has at least **two independent evidence classes**, for example:

1. paid-chart persistence or repeated momentum;
2. repeated pain/request across apps or dates;
3. current competitor gap;
4. clear pricing/ownership evidence;
5. a platform/API change that makes the job newly feasible;
6. external acquisition or community evidence with a measurable behavior signal.

### External validation

For the 0–5 strongest candidates only:

- open the current App Store page;
- inspect representative reviews;
- check direct competitors/substitutes and their pricing;
- search for counter-evidence;
- verify platform/API/policy constraints when relevant.

Do not estimate downloads, revenue, CAC, LTV, or team size without explicit evidence.

### Daily output

Start with one table:

| Decision | Opportunity / JTBD | Real signal | Evidence chain | Why worth doing | Counter-evidence / risk | Next step |
| --- | --- | --- | --- | --- | --- | --- |

Rules:

- maximum 5 rows;
- `BUILD` = evidence supports a short validation experiment now;
- `WATCH` = promising but missing one or more decisive evidence classes;
- `REJECT` = looks attractive but current evidence says time is better spent elsewhere;
- zero BUILD is valid and should be stated plainly.

Then add only:

1. **Strongest market signals** — maximum 3, clearly labeled as signals rather than product ideas.
2. **Noise removed** — maximum 3 important false positives and why they were filtered.
3. **Data health** — one short line.
4. **Next actions** — maximum 3 concrete research/validation actions.

Save the full note to `research/daily/YYYY-MM-DD.md` on `main`.

Create or update an `[Opportunity] <name>` issue only for BUILD. The issue should contain:

- JTBD;
- evidence chain;
- counter-evidence;
- why now / why worth doing;
- 3–7 day validation plan;
- success metric;
- kill criteria.

**Do not include UI/design-system analysis, screen contracts, Device Hub, accessibility checklists, or `ios-native-design` analysis in Radar research.** Product implementation is a separate stage after the opportunity is accepted.

## Weekly task

Run once per week after the weekly baseline exists.

Read:

- current `reports/weekly` and `evidence/weekly`;
- all seven daily research notes;
- prior weekly research;
- open opportunity issues.

Re-evaluate candidates across the full week and answer:

- what strengthened;
- what weakened;
- what was invalidated;
- what newly deserves a short validation experiment.

Use the same compact table and the same BUILD/WATCH/REJECT rules. Maximum 5 candidate rows. Zero BUILD is valid.

Save to `research/weekly/YYYY-Www.md` and create/update one `[Weekly Radar] YYYY-Www` issue linking the weekly note and relevant opportunity issues.

## Evidence rules

Every material claim must trace to one or more of:

- repository raw path + app/review id;
- current App Store page/review;
- official platform/API/policy documentation;
- trustworthy current external source for market or competitive facts.

Always separate:

- **Observed** — directly present in source data;
- **Computed** — derived from stored evidence;
- **Inferred** — product/commercial interpretation.

When evidence conflicts, preserve the conflict. When evidence is weak, say so. Silence is better than manufactured opportunity.
