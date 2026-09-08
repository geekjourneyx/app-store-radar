const RULES = [
  { category: 'integration gap', job: 'data portability', re: /\b(export|markdown|obsidian|logseq|local files?|api)\b/i },
  { category: 'pricing gap', job: 'affordable ownership', re: /\b(subscription|too expensive|price|lifetime|one[- ]time)\b/i },
  { category: 'workflow gap', job: 'offline/private workflow', re: /\b(offline|local[- ]first|privacy|without cloud)\b/i },
  { category: 'bug/regression', job: 'reliability', re: /\b(crash|login|won't open|broken|battery drain)\b/i }
];

function daysBetween(a, b) {
  return Math.abs((new Date(a) - new Date(b)) / 86400000);
}

export function evaluateCandidates({ history, signals, config = { thresholds: {} } }) {
  const matched = [];
  for (const day of history) {
    for (const review of day.reviews) {
      const text = `${review.title} ${review.body}`;
      for (const rule of RULES) {
        if (rule.re.test(text)) matched.push({ ...review, date: day.date, category: rule.category, job: rule.job });
      }
    }
  }

  const groups = new Map();
  for (const item of matched) {
    if (!groups.has(item.job)) groups.set(item.job, []);
    groups.get(item.job).push(item);
  }

  const results = [];
  for (const [job, rows] of groups) {
    const apps = new Set(rows.map((r) => `${r.storefront}:${r.app_id}`));
    const dates = [...new Set(rows.map((r) => r.date))].sort();
    const demand = rows.length;
    const gap = rows.filter((r) => r.category !== 'bug/regression').length;
    const incident = rows.filter((r) => r.category === 'bug/regression').length >= Math.max(3, Math.ceil(rows.length * 0.7)) && dates.length <= 2;
    const min = config.thresholds ?? {};
    const gates = {
      demand: demand >= (min.min_demand ?? 2),
      gap: gap >= (min.min_gap ?? 2),
      cross_app: apps.size >= (min.min_cross_apps ?? 2),
      persistence: dates.length >= (min.min_persistence_days ?? 2) && (!dates.length || daysBetween(dates[0], dates.at(-1)) >= 1),
      feasibility: true,
      economics: ['affordable ownership', 'data portability', 'offline/private workflow'].includes(job)
    };
    const allGates = Object.values(gates).every(Boolean);
    const noise_flags = incident ? ['VERSION_INCIDENT'] : [];
    let verdict = allGates && !incident ? 'BUILD' : 'WATCH';
    if (!gates.feasibility || !gates.economics) verdict = 'REJECT';
    const score = Math.min(100, demand * 4 + gap * 4 + apps.size * 8 + dates.length * 3 + (gates.economics ? 10 : 0) + (gates.feasibility ? 15 : 0));

    results.push({
      id: job.replace(/\W+/g, '-'),
      observed: {
        review_ids: rows.map((r) => r.review_id),
        apps: [...apps],
        dates,
        categories: [...new Set(rows.map((r) => r.category))]
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
      verdict
    });
  }
  return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
