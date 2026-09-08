import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeSearch } from '../src/normalize.js';
import { partitionPath, writePartition } from '../src/storage.js';
import { buildSignals } from '../src/signals.js';
import { evaluateCandidates } from '../src/opportunities.js';
import { renderWeeklyMarkdown } from '../src/report.js';

test('search ordering is discovery-only', () => {
  const [row] = normalizeSearch({ results: [{ trackId: 1, trackName: 'A' }] }, { query: 'voice', storefront: 'us' });
  assert.equal(row.discovery_position, 1);
  assert.equal('rank' in row, false);
});

test('daily partitions are immutable and deterministic', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'radar-'));
  assert.equal(partitionPath('2026-09-08'), path.join('data', '2026', '09', '08'));
  await writePartition(root, '2026-09-08', { apps: [{ storefront: 'us', app_id: '2' }, { storefront: 'us', app_id: '1' }] });
  const text = await readFile(path.join(root, 'data/2026/09/08/apps.ndjson'), 'utf8');
  assert.match(text.split('\n')[0], /"app_id":"1"/);
  await assert.rejects(() => writePartition(root, '2026-09-08', {}), (e) => e.code === 'PARTITION_EXISTS');
});

test('signals use deltas and chart momentum', () => {
  const history = [1, 2, 3].map((d, i) => ({
    date: `2026-09-0${d}`,
    apps: [{ storefront: 'us', app_id: '1', app_name: 'A', rating_count: [10, 15, 30][i], version: ['1', '1', '2'][i] }],
    reviews: [],
    charts: [{ storefront: 'us', app_id: '1', chart_position: [80, 50, 20][i] }],
    search: [{ storefront: 'us', app_id: '1', query: 'voice', discovery_position: 3 }],
    manifest: {}
  }));
  const [signal] = buildSignals(history);
  assert.equal(signal.rating_velocity.delta, 20);
  assert.equal(signal.rating_acceleration, 10);
  assert.equal(signal.chart_momentum, 60);
  assert.equal('app_store_rank' in signal.search_presence, false);
});

test('version incident is never promoted', () => {
  const history = [{ date: '2026-09-01', reviews: [1,2,3,4].map((i) => ({ storefront:'us', app_id:'1', review_id:`r${i}`, title:'Crash', body:'crash login broken' })) }];
  const result = evaluateCandidates({ history, signals: [], config: { thresholds: { min_demand:2, min_gap:2, min_cross_apps:2, min_persistence_days:2 } } });
  const candidate = result.find((x) => x.inferred.underlying_job === 'reliability');
  assert.notEqual(candidate.verdict, 'BUILD');
  assert.ok(candidate.noise_flags.includes('VERSION_INCIDENT'));
});

test('persistent cross-app portability gap can be BUILD', () => {
  const history = [
    { date:'2026-09-01', reviews:[
      { storefront:'us', app_id:'1', review_id:'a', title:'Export', body:'please export markdown' },
      { storefront:'us', app_id:'2', review_id:'b', title:'Obsidian', body:'need Obsidian export' }
    ]},
    { date:'2026-09-08', reviews:[
      { storefront:'us', app_id:'3', review_id:'c', title:'Local', body:'need local files and API' }
    ]}
  ];
  const result = evaluateCandidates({ history, signals: [], config: { thresholds: { min_demand:2, min_gap:2, min_cross_apps:2, min_persistence_days:2 } } });
  const candidate = result.find((x) => x.inferred.underlying_job === 'data portability');
  assert.equal(candidate.verdict, 'BUILD');
});

test('zero-opportunity report is honest', () => {
  const markdown = renderWeeklyMarkdown({ week:'2026-W37', history_days:7, collection_health:{ partial_days:0 }, candidates:[] });
  assert.match(markdown, /## BUILD\n\n_None\._/);
  assert.match(markdown, /not real App Store keyword ranks/);
});
