import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readHistory } from './storage.js';
import { buildSignals } from './signals.js';
import { extractReviewSignals } from './review-signals.js';
import { evaluateCandidates } from './opportunities.js';
import { inspectChartIntegrity } from './collect.js';

function dateKey(date) {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function appMap(day) {
  return new Map((day?.apps ?? []).map((x) => [`${x.storefront}:${x.app_id}`, x]));
}

function chartMap(day, storefront, chartType) {
  return new Map((day?.charts ?? [])
    .filter((x) => x.storefront === storefront && x.chart_type === chartType)
    .map((x) => [x.app_id, x]));
}

function sortByAbsDelta(a, b) {
  return Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0) || (a.rank ?? 9999) - (b.rank ?? 9999);
}

function summarizeReviewSignals(rows) {
  const counts = {};
  for (const row of rows) {
    const key = `${row.intent}:${row.job}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, count]) => {
      const [intent, ...job] = key.split(':');
      return { intent, job: job.join(':'), count };
    })
    .sort((a, b) => b.count - a.count || a.job.localeCompare(b.job));
}

export async function buildDailyEvidence({ root='.', date=new Date(), config={} }) {
  const target = dateKey(date);
  const history = await readHistory(root);
  const index = history.findIndex((x) => x.date === target);
  if (index < 0) {
    const err = new Error(`MISSING_DAILY_PARTITION ${target}`);
    err.code = 'MISSING_DAILY_PARTITION';
    throw err;
  }
  const current = history[index];
  const previous = index > 0 ? history[index - 1] : null;
  const currentApps = appMap(current);
  const prevPaid = chartMap(previous, 'cn', 'top-paid');
  const signals = buildSignals(history.slice(0, index + 1));
  const signalMap = new Map(signals.map((x) => [x.key, x]));
  const paidRows = (current.charts ?? [])
    .filter((x) => x.storefront === 'cn' && x.chart_type === 'top-paid')
    .sort((a, b) => a.chart_position - b.chart_position)
    .map((row) => {
      const app = currentApps.get(`cn:${row.app_id}`) ?? {};
      const prev = prevPaid.get(row.app_id);
      return {
        app_id: row.app_id,
        app_name: row.app_name ?? app.app_name ?? row.app_id,
        rank: row.chart_position,
        previous_rank: prev?.chart_position ?? null,
        delta: prev ? prev.chart_position - row.chart_position : null,
        price: app.price ?? null,
        formatted_price: app.formatted_price ?? null,
        rating_count: app.rating_count ?? null,
        average_rating: app.average_rating ?? null,
        seller: app.seller ?? null,
        initial_release_date: app.initial_release_date ?? null,
        url: app.url ?? null
      };
    });

  const currentIds = new Set(paidRows.map((x) => x.app_id));
  const prevIds = new Set(prevPaid.keys());
  const newEntrants = paidRows.filter((x) => !prevIds.has(x.app_id));
  const exits = previous ? [...prevIds].filter((id) => !currentIds.has(id)).map((id) => prevPaid.get(id)) : [];
  const movers = paidRows.filter((x) => x.delta !== null && x.delta !== 0).sort(sortByAbsDelta).slice(0, 20);

  const ratingMax = config.small_developer_rating_count_max ?? 500;
  const smallDeveloperSignals = paidRows
    .filter((row) => Number(row.rating_count ?? Infinity) <= ratingMax && Number(row.price ?? 0) > 0)
    .map((row) => {
      const signal = signalMap.get(`cn:${row.app_id}`);
      const paid = signal?.chart_presence?.['top-paid'];
      return {
        ...row,
        paid_chart_days: paid?.days ?? 1,
        best_position: paid?.best_position ?? row.rank,
        confidence: (paid?.days ?? 1) >= 3 ? 'persistent' : 'emerging',
        signal_type: 'small-developer-proxy'
      };
    })
    .sort((a, b) => (b.paid_chart_days - a.paid_chart_days) || a.rank - b.rank)
    .slice(0, 25);

  const reviewSignals = extractReviewSignals(current.reviews ?? []);
  const candidates = evaluateCandidates({ history: history.slice(0, index + 1), signals, config });
  const manifestIntegrity = current.manifest?.health?.chart_integrity;
  const chartIntegrityStatus = Array.isArray(manifestIntegrity) ? 'manifest' : 'derived';
  const chartIntegrity = Array.isArray(manifestIntegrity) ? manifestIntegrity : inspectChartIntegrity(current.charts ?? [], {
    storefronts: config.storefronts ?? [...new Set((current.charts ?? []).map((x) => x.storefront))],
    chartTypes: config.chart_types ?? [...new Set((current.charts ?? []).map((x) => x.chart_type))],
    expectedCount: config.chart_expected_count ?? 100
  });

  return {
    date: target,
    generated_at: new Date().toISOString(),
    collection_health: {
      failures: current.manifest?.failures ?? [],
      chart_integrity: chartIntegrity,
      chart_integrity_status: chartIntegrityStatus,
      chart_complete_ratio: current.manifest?.health?.chart_complete_ratio ?? null,
      reviews_new: current.manifest?.counts?.reviews_new ?? (current.reviews ?? []).length,
      review_watchlist_apps: current.manifest?.counts?.review_watchlist_apps ?? null
    },
    cn_paid: {
      observed_count: paidRows.length,
      top20: paidRows.slice(0, 20),
      new_entrants: newEntrants,
      exits,
      movers
    },
    small_developer_signals: smallDeveloperSignals,
    review_signals: {
      counts: summarizeReviewSignals(reviewSignals),
      items: reviewSignals.slice(0, 60)
    },
    machine_candidates: candidates.slice(0, 20),
    evidence_chain: {
      raw_partition: `data/${target.slice(0,4)}/${target.slice(5,7)}/${target.slice(8,10)}`,
      apps: `data/${target.slice(0,4)}/${target.slice(5,7)}/${target.slice(8,10)}/apps.ndjson`,
      charts: `data/${target.slice(0,4)}/${target.slice(5,7)}/${target.slice(8,10)}/charts.ndjson`,
      reviews: `data/${target.slice(0,4)}/${target.slice(5,7)}/${target.slice(8,10)}/reviews.ndjson`,
      manifest: `data/${target.slice(0,4)}/${target.slice(5,7)}/${target.slice(8,10)}/manifest.json`
    },
    agent_handoff: {
      requires_external_validation: true,
      final_decision_rule: 'Do not promote a machine candidate to BUILD until chart persistence, review evidence, commercial plausibility, counter-evidence, and iOS-native feasibility are externally validated.'
    }
  };
}

function mdTable(headers, rows) {
  if (!rows.length) return '_None._\n';
  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((x) => String(x ?? '—').replace(/\|/g, '\\|')).join(' | ')} |`)
  ];
  return `${lines.join('\n')}\n`;
}

export function renderDailyMarkdown(e) {
  const lines = [
    `# App Store Radar Daily — ${e.date}`,
    '',
    '> Deterministic evidence brief. BUILD decisions require ChatGPT/web validation and the iOS Native Design gate.',
    '',
    '## Collection Health',
    '',
    `- China paid observed: **${e.cn_paid.observed_count}**`,
    `- New reviews captured: **${e.collection_health.reviews_new ?? 'unknown'}**`,
    `- Review watchlist apps: **${e.collection_health.review_watchlist_apps ?? 'unknown'}**`,
    `- Source failures: **${e.collection_health.failures.length}**`,
  ];
  const incomplete = e.collection_health.chart_integrity.filter((x) => !x.complete);
  lines.push(`- Incomplete charts: **${incomplete.length}**`);
  if (e.collection_health.chart_integrity_status === 'derived') lines.push('- Chart integrity was **derived from raw chart rows** because the legacy manifest lacks chart integrity metadata.');
  for (const item of incomplete) lines.push(`  - ${item.storefront}/${item.chart_type}: ${item.observed_count}/${item.expected_count}; missing ${item.missing_positions.join(', ') || 'unknown'}`);

  lines.push('', '## China Paid Chart — Top 20', '');
  lines.push(mdTable(
    ['Rank', 'App', 'Δ vs prev', 'Price', 'Ratings'],
    e.cn_paid.top20.map((x) => [x.rank, x.app_name, x.delta === null ? 'new/unknown' : (x.delta > 0 ? `+${x.delta}` : x.delta), x.formatted_price ?? x.price, x.rating_count])
  ));

  lines.push('## New Entrants', '');
  lines.push(mdTable(['Rank', 'App', 'Price', 'Ratings'], e.cn_paid.new_entrants.slice(0, 20).map((x) => [x.rank, x.app_name, x.formatted_price ?? x.price, x.rating_count])));

  lines.push('## Movers', '');
  lines.push(mdTable(['Rank', 'App', 'Move'], e.cn_paid.movers.map((x) => [x.rank, x.app_name, x.delta > 0 ? `+${x.delta}` : x.delta])));

  lines.push('## Small Developer Signals', '', '> Proxy only: low rating-count + paid-chart presence. This does **not** prove developer/team size.', '');
  lines.push(mdTable(
    ['Rank', 'App', 'Ratings', 'Paid days', 'Best', 'Signal'],
    e.small_developer_signals.map((x) => [x.rank, x.app_name, x.rating_count, x.paid_chart_days, x.best_position, x.confidence])
  ));

  lines.push('## Review Signals', '');
  if (!e.review_signals.counts.length) lines.push('_No deterministic review signals today._', '');
  else {
    lines.push(mdTable(['Intent', 'Job', 'Count'], e.review_signals.counts.map((x) => [x.intent, x.job, x.count])));
    for (const item of e.review_signals.items.slice(0, 20)) {
      lines.push(`- **${item.intent} · ${item.job}** — app ${item.app_id}, review ${item.review_id}, rating ${item.rating ?? '—'}: ${item.evidence_excerpt}`);
    }
    lines.push('');
  }

  lines.push('## Machine Opportunity Triage', '', '> These are candidates for research, not final product recommendations.', '');
  if (!e.machine_candidates.length) lines.push('_None._', '');
  for (const c of e.machine_candidates.slice(0, 10)) {
    lines.push(`### ${c.verdict} · ${c.inferred.underlying_job}`, '', `- Score: ${c.score}`, `- Demand observations: ${c.computed.demand_observations}`, `- Cross-app evidence: ${c.computed.cross_apps}`, `- Persistence dates: ${c.computed.persistence_days}`, `- Noise: ${c.noise_flags.join(', ') || 'none'}`, '');
  }

  lines.push('## Evidence Chain', '', `- Raw partition: \`${e.evidence_chain.raw_partition}\``, `- Charts: \`${e.evidence_chain.charts}\``, `- Apps: \`${e.evidence_chain.apps}\``, `- Reviews: \`${e.evidence_chain.reviews}\``, `- Manifest: \`${e.evidence_chain.manifest}\``, '', '## Agent Handoff', '', `- External validation required: **yes**`, `- ${e.agent_handoff.final_decision_rule}`, '');
  return lines.join('\n') + '\n';
}

export async function writeDaily({ root='.', date=new Date(), config={} }) {
  const evidence = await buildDailyEvidence({ root, date, config });
  await mkdir(path.join(root, 'evidence', 'daily'), { recursive: true });
  await mkdir(path.join(root, 'reports', 'daily'), { recursive: true });
  await writeFile(path.join(root, 'evidence', 'daily', `${evidence.date}.json`), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(path.join(root, 'reports', 'daily', `${evidence.date}.md`), renderDailyMarkdown(evidence));
  return evidence;
}
