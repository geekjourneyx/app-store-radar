import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readHistory } from './storage.js';
import { buildSignals } from './signals.js';
import { evaluateCandidates } from './opportunities.js';
import { extractReviewSignals } from './review-signals.js';

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((d - y) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}

function windowThrough(history, date, days=7) {
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return history.filter((x) => {
    const d = new Date(`${x.date}T00:00:00Z`);
    return d >= start && d <= end;
  });
}

function reviewSummary(history) {
  const rows = history.flatMap((day) => extractReviewSignals(day.reviews ?? []).map((x) => ({ ...x, date: day.date })));
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.intent}:${row.job}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, items]) => {
    const [intent, ...job] = key.split(':');
    return {
      intent,
      job: job.join(':'),
      count: items.length,
      apps: new Set(items.map((x) => `${x.storefront}:${x.app_id}`)).size,
      dates: new Set(items.map((x) => x.date)).size,
      evidence: items.slice(0, 5).map((x) => ({
        review_id: x.review_id,
        app_id: x.app_id,
        storefront: x.storefront,
        specificity: x.specificity,
        excerpt: x.evidence_excerpt
      }))
    };
  }).sort((a, b) => b.count - a.count || a.job.localeCompare(b.job));
}

function mdTable(headers, rows) {
  if (!rows.length) return '_None._\n';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((x) => String(x ?? '—').replace(/\|/g, '\\|')).join(' | ')} |`)
  ].join('\n') + '\n';
}

export async function buildWeeklyEvidence({ root='.', date=new Date(), config }) {
  const allHistory = await readHistory(root);
  const history = windowThrough(allHistory, date, 7);
  const signals = buildSignals(history);
  const candidates = evaluateCandidates({ history, signals, config });
  const paidSignals = signals
    .filter((x) => x.storefront === 'cn' && x.chart_presence?.['top-paid'])
    .map((x) => ({
      app_id:x.app_id,
      app_name:x.app_name,
      rating_count:x.rating_count,
      price:x.price,
      ...x.chart_presence['top-paid'],
      rating_delta:x.rating_velocity.delta
    }))
    .sort((a, b) => b.days - a.days || a.latest_position - b.latest_position)
    .slice(0, 30);

  return {
    week: isoWeek(date),
    generated_at: date.toISOString(),
    history_days: history.length,
    date_range: history.length ? { from: history[0].date, to: history.at(-1).date } : null,
    collection_health: {
      partial_days: history.filter((d) => d.manifest?.failures?.length).length,
      incomplete_chart_days: history.filter((d) => (d.manifest?.health?.chart_integrity ?? []).some((x) => !x.complete)).length
    },
    persistent_cn_paid: paidSignals,
    review_signal_summary: reviewSummary(history),
    candidates
  };
}

export function renderWeeklyMarkdown(e) {
  const productCandidates = (e.candidates ?? []).filter((c) => c.candidate_type === 'product-candidate').slice(0, 10);
  const marketSignals = (e.candidates ?? []).filter((c) => c.candidate_type === 'market-signal').slice(0, 8);
  const rejected = (e.candidates ?? []).filter((c) => c.verdict === 'REJECT').slice(0, 5);
  const reviewGaps = (e.review_signal_summary ?? []).filter((x) => x.intent !== 'value').slice(0, 10);

  const lines = [
    `# App Store Opportunity Radar — ${e.week}`,
    '',
    `History days: **${e.history_days}** · Partial collection days: **${e.collection_health?.partial_days ?? 0}** · Incomplete chart days: **${e.collection_health?.incomplete_chart_days ?? 0}**`,
    '',
    '> Deterministic weekly baseline. Search positions are discovery positions, not real App Store keyword ranks. Final BUILD/WATCH/REJECT belongs to externally validated research.',
    '',
    '## Product-specific Research Queue',
    ''
  ];

  if (!productCandidates.length) lines.push('_No product-specific candidate clears INVESTIGATE/WATCH triage in this window._', '');
  else lines.push(mdTable(
    ['Triage', 'JTBD', 'Requests/Pain', 'Apps', 'Dates', 'Score'],
    productCandidates.map((c) => [c.verdict, c.inferred.underlying_job, c.computed.gap_observations, c.computed.cross_apps, c.computed.persistence_days, c.score])
  ), '');

  lines.push('## Market Signals — Not Standalone Product Ideas', '');
  lines.push(mdTable(
    ['Signal', 'Observations', 'Apps', 'Dates', 'Triage'],
    marketSignals.map((c) => [c.inferred.underlying_job, c.computed.demand_observations, c.computed.cross_apps, c.computed.persistence_days, c.verdict])
  ), '');

  lines.push('## Persistent China Paid Signals', '');
  lines.push(mdTable(
    ['Latest', 'App', 'Observed days', 'Best', 'Ratings', 'Rating Δ'],
    (e.persistent_cn_paid ?? []).slice(0, 12).map((x) => [x.latest_position, x.app_name, x.days, x.best_position, x.rating_count ?? '—', x.rating_delta ?? '—'])
  ), '');

  lines.push('## Review Gap Clusters', '');
  lines.push(mdTable(
    ['Intent', 'Job', 'Signals', 'Apps', 'Dates'],
    reviewGaps.map((x) => [x.intent, x.job, x.count, x.apps, x.dates])
  ), '');

  lines.push('## Rejected Noise', '');
  if (!rejected.length) lines.push('_None._', '');
  else lines.push(mdTable(
    ['Signal', 'Reason', 'Noise flags'],
    rejected.map((c) => [c.inferred.underlying_job, c.candidate_type, c.noise_flags.join(', ') || 'not a standalone opportunity'])
  ), '');

  lines.push(
    '## Evidence Chain',
    '',
    `- Window: ${e.date_range ? `${e.date_range.from} → ${e.date_range.to}` : 'no data'}`,
    '- Raw evidence: `data/YYYY/MM/DD/`',
    '- Weekly machine evidence: `evidence/weekly/<week>.json`',
    '- Final externally validated research: `research/weekly/<week>.md`',
    ''
  );

  return lines.join('\n') + '\n';
}

export async function writeWeekly({ root='.', date=new Date(), config }) {
  const evidence = await buildWeeklyEvidence({ root, date, config });
  await mkdir(path.join(root, 'evidence', 'weekly'), { recursive: true });
  await mkdir(path.join(root, 'reports', 'weekly'), { recursive: true });
  await writeFile(path.join(root, 'evidence', 'weekly', `${evidence.week}.json`), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(path.join(root, 'reports', 'weekly', `${evidence.week}.md`), renderWeeklyMarkdown(evidence));
  return evidence;
}

export { isoWeek };
