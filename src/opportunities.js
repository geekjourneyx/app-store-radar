import { extractReviewSignals } from './review-signals.js';

function daysBetween(a, b) {
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

const MARKET_SIGNAL_JOBS = new Set([
  'affordable ownership',
  'data portability',
  'offline/private workflow',
  'local/private workflow',
  'ad-free experience',
  'focused workflow'
]);

export function evaluateCandidates({ history, signals, config = { thresholds: {} } }) {
  const matched = [];
  for (const day of history) {
    for (const signal of extractReviewSignals(day.reviews ?? [])) matched.push({ ...signal, date: day.date });
  }

  const groups = new Map();
  for (const item of matched) {
    const job = item.job === 'local/private workflow' ? 'offline/private workflow' : item.job;
    if (!groups.has(job)) groups.set(job, []);
    groups.get(job).push({ ...item, job });
  }

  const results = [];
  for (const [job, rows] of groups) {
    const apps = new Set(rows.map((r) => `${r.storefront}:${r.app_id}`));
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const demand = rows.length;
    const gap = rows.filter((r) => r.intent !== 'value').length;
    const reliabilityRows = rows.filter((r) => r.category === 'bug/regression').length;
    const incident = job === 'reliability' && reliabilityRows >= Math.max(3, Math.ceil(rows.length * 0.7)) && dates.length <= 2;
    const min = config.thresholds ?? {};
    const gates = {
      demand: demand >= (min.min_demand ?? 2),
      gap: gap >= (min.min_gap ?? 2),
      cross_app: apps.size >= (min.min_cross_apps ?? 2),
      persistence: dates.length >= (min.min_persistence_days ?? 2) && (!dates.length || daysBetween(dates[0], dates.at(-1)) >= 1)
    };

    const candidateType = job === 'reliability'
      ? 'noise'
      : (MARKET_SIGNAL_JOBS.has(job) ? 'market-signal' : 'product-candidate');

    const allGates = Object.values(gates).every(Boolean);
    const noise_flags = incident ? ['VERSION_INCIDENT'] : [];
    let verdict = 'WATCH';
    if (candidateType === 'noise') verdict = 'REJECT';
    else if (candidateType === 'product-candidate' && allGates && !incident) verdict = 'INVESTIGATE';

    const score = Math.min(100, demand * 4 + gap * 5 + apps.size * 8 + dates.length * 3);

    results.push({
      id: job.replace(/\W+/g, '-'),
      candidate_type: candidateType,
      observed: {
        review_ids: [...new Set(rows.map((r) => r.review_id))],
        apps: [...apps],
        dates,
        categories: [...new Set(rows.map((r) => r.category))],
        evidence: rows.slice(0, 8).map((r) => ({
          review_id: r.review_id,
          app_id: r.app_id,
          storefront: r.storefront,
          rating: r.rating,
          intent: r.intent,
          specificity: r.specificity,
          excerpt: r.evidence_excerpt
        }))
      },
      computed: {
        demand_observations: demand,
        gap_observations: gap,
        cross_apps: apps.size,
        persistence_days: dates.length
      },
      inferred: {
        underlying_job: job,
        adjacent_jobs: job === 'data portability' ? ['Markdown export', 'Obsidian', 'Logseq', 'local files', 'API'] : []
      },
      signal_context: signals.filter((signal) => apps.has(`${signal.storefront}:${signal.app_id}`)),
      noise_flags,
      gates,
      score,
      verdict,
      confidence: 'machine-triage'
    });
  }

  return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
