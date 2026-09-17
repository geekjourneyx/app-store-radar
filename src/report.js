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
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - (days - 1));
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
      evidence: items.slice(0, 5).map((x) => ({ review_id:x.review_id, app_id:x.app_id, storefront:x.storefront, excerpt:x.evidence_excerpt }))
    };
  }).sort((a, b) => b.count - a.count || a.job.localeCompare(b.job));
}

export async function buildWeeklyEvidence({ root='.', date=new Date(), config }) {
  const allHistory = await readHistory(root);
  const history = windowThrough(allHistory, date, 7);
  const signals = buildSignals(history);
  const candidates = evaluateCandidates({ history, signals, config });
  const paidSignals = signals
    .filter((x) => x.storefront === 'cn' && x.chart_presence?.['top-paid'])
    .map((x) => ({ app_id:x.app_id, app_name:x.app_name, rating_count:x.rating_count, price:x.price, ...x.chart_presence['top-paid'], rating_delta:x.rating_velocity.delta }))
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
  const groups = { BUILD: [], WATCH: [], REJECT: [] };
  for (const c of e.candidates) groups[c.verdict].push(c);
  const lines = [
    `# App Store Opportunity Radar — ${e.week}`,
    '',
    `History days: **${e.history_days}** · Partial collection days: **${e.collection_health.partial_days}**`,
    '',
    '> Evidence first. Search positions are discovery positions, not real App Store keyword ranks. Machine BUILD is a research promotion, not an autonomous shipping decision.',
    '',
    '## Persistent China Paid Signals',
    ''
  ];
  if (!e.persistent_cn_paid?.length) lines.push('_None._', '');
  else for (const x of e.persistent_cn_paid.slice(0, 15)) lines.push(`- #${x.latest_position} **${x.app_name}** — ${x.days} observed days, best #${x.best_position}, ratings ${x.rating_count ?? '—'}, rating Δ ${x.rating_delta ?? '—'}`);

  lines.push('', '## Review Signal Clusters', '');
  if (!e.review_signal_summary?.length) lines.push('_None._', '');
  else for (const x of e.review_signal_summary.slice(0, 15)) lines.push(`- **${x.intent} · ${x.job}** — ${x.count} signals / ${x.apps} apps / ${x.dates} dates`);
  lines.push('');

  for (const verdict of ['BUILD', 'WATCH', 'REJECT']) {
    lines.push(`## ${verdict}`, '');
    if (!groups[verdict].length) { lines.push('_None._', ''); continue; }
    for (const c of groups[verdict]) {
      lines.push(`### ${c.inferred.underlying_job}`, '', `Score: **${c.score}**`, '', `- Observed: ${c.observed.review_ids.length} matched reviews across ${c.computed.cross_apps} apps and ${c.computed.persistence_days} dates.`, `- Computed: gap observations ${c.computed.gap_observations}; demand observations ${c.computed.demand_observations}.`, `- Inferred: ${c.inferred.adjacent_jobs.join(', ') || 'No adjacent jobs inferred deterministically.'}`, `- Noise flags: ${c.noise_flags.join(', ') || 'none'}`, `- Gates: ${Object.entries(c.gates).map(([k,v]) => `${k}=${v ? 'pass' : 'fail'}`).join(', ')}`, '', '### Feasibility / counter-evidence', '', '- External Apple/platform/legal/competitive validation is required before final BUILD.', '- When a BUILD is promoted to an iOS product issue, apply the ios-native-design screen contract, native-component-first rule, accessibility/runtime evidence, Device Hub verification, and Design DoD.', '');
    }
  }
  lines.push('## Evidence Chain', '', `- Window: ${e.date_range ? `${e.date_range.from} → ${e.date_range.to}` : 'no data'}`, '- Raw evidence: `data/YYYY/MM/DD/`', '- Weekly machine evidence: `evidence/weekly/<week>.json`', '- Final agent research belongs in `research/weekly/<week>.md`.', '');
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
