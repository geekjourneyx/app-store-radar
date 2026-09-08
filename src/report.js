import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readHistory } from './storage.js';
import { buildSignals } from './signals.js';
import { evaluateCandidates } from './opportunities.js';

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((d - y) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}

export async function buildWeeklyEvidence({ root='.', date=new Date(), config }) {
  const history = await readHistory(root);
  const signals = buildSignals(history);
  const candidates = evaluateCandidates({ history, signals, config });
  return { week: isoWeek(date), generated_at: date.toISOString(), history_days: history.length, collection_health: { partial_days: history.filter((d) => d.manifest?.failures?.length).length }, candidates };
}

export function renderWeeklyMarkdown(e) {
  const groups = { BUILD: [], WATCH: [], REJECT: [] };
  for (const c of e.candidates) groups[c.verdict].push(c);
  const lines = [`# App Store Opportunity Radar — ${e.week}`, '', `History days: **${e.history_days}** · Partial collection days: **${e.collection_health.partial_days}**`, '', '> Evidence first. Search positions are discovery positions, not real App Store keyword ranks.', ''];
  for (const verdict of ['BUILD', 'WATCH', 'REJECT']) {
    lines.push(`## ${verdict}`, '');
    if (!groups[verdict].length) { lines.push('_None._', ''); continue; }
    for (const c of groups[verdict]) {
      lines.push(`### ${c.inferred.underlying_job}`, '', `Score: **${c.score}**`, '', `- Observed: ${c.observed.review_ids.length} matched reviews across ${c.computed.cross_apps} apps and ${c.computed.persistence_days} dates.`, `- Computed: gap observations ${c.computed.gap_observations}; demand observations ${c.computed.demand_observations}.`, `- Inferred: ${c.inferred.adjacent_jobs.join(', ') || 'No adjacent jobs inferred in deterministic v1.'}`, `- Noise flags: ${c.noise_flags.join(', ') || 'none'}`, `- Gates: ${Object.entries(c.gates).map(([k,v]) => `${k}=${v ? 'pass' : 'fail'}`).join(', ')}`, '', '### Feasibility / counter-evidence', '', '- Deterministic v1 only promotes candidates when feasibility/economics gates are explicitly positive in the rule set.', '- External platform/legal verification is intentionally left for an enrichment layer; absence of that verification should lower confidence in real-world decisions.', '');
    }
  }
  return lines.join('\n') + '\n';
}

export async function writeWeekly({ root='.', date=new Date(), config }) {
  const evidence = await buildWeeklyEvidence({ root, date, config });
  await mkdir(path.join(root, 'evidence'), { recursive: true });
  await mkdir(path.join(root, 'reports'), { recursive: true });
  await writeFile(path.join(root, 'evidence', `${evidence.week}.json`), JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(path.join(root, 'reports', `${evidence.week}.md`), renderWeeklyMarkdown(evidence));
  return evidence;
}

export { isoWeek };
