import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectDay, selectReviewWatchlist } from '../src/collect.js';

test('review watchlist is bounded per storefront while preserving diverse search seeds and charts', () => {
  const search = [];
  for (const query of ['voice notes', 'journal', 'habit tracker']) {
    for (let i = 1; i <= 10; i++) search.push({ storefront:'us', query, app_id:`${query}-${i}`, discovery_position:i });
  }
  const charts = Array.from({ length: 20 }, (_, i) => ({ storefront:'us', chart_type:'top-free', app_id:`chart-${i+1}`, chart_position:i+1 }));
  const rows = selectReviewWatchlist({ search, charts, storefront:'us', searchPerSeed:2, chartPerType:3, maxApps:8 });
  assert.equal(rows.length, 8);
  assert.ok(rows.some((x) => x.app_id === 'voice notes-1'));
  assert.ok(rows.some((x) => x.app_id === 'journal-1'));
  assert.ok(rows.some((x) => x.app_id === 'habit tracker-1'));
  assert.ok(rows.some((x) => x.app_id === 'chart-1'));
});

test('collector never exceeds configured review concurrency', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'radar-'));
  let active = 0;
  let maxActive = 0;
  let reviewCalls = 0;
  const client = {
    async searchApps(query, storefront) { return { results:[{ trackId:`${storefront}-${query}`, trackName:query }] }; },
    async fetchChart(storefront, chartType) { return { feed:{ results:[{ id:`${storefront}-${chartType}`, name:chartType }] } }; },
    async lookupApps() { return { results:[] }; },
    async fetchReviews() {
      reviewCalls++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return { feed:{ entry:[] } };
    }
  };
  const config = {
    storefronts:['us'],
    seeds:[{query:'voice notes'},{query:'journal'},{query:'habit tracker'}],
    chart_types:['top-free'],
    search_limit:50,
    reviews_per_app:50,
    review_search_apps_per_seed:1,
    review_chart_apps_per_type:1,
    max_review_apps_per_storefront:4,
    review_concurrency:2,
    min_discovery_success_ratio:0.8
  };
  await collectDay({ date:'2026-09-08', config, client, root });
  assert.ok(reviewCalls <= 4);
  assert.ok(maxActive <= 2);
});

test('collector rejects unhealthy discovery and does not write a partition', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'radar-'));
  let calls = 0;
  const client = {
    async searchApps() { calls++; if (calls > 1) throw new Error('search down'); return { results:[{ trackId:'1', trackName:'A' }] }; },
    async fetchChart() { throw new Error('chart down'); },
    async lookupApps() { return { results:[] }; },
    async fetchReviews() { return { feed:{ entry:[] } }; }
  };
  const config = {
    storefronts:['us'],
    seeds:[{query:'a'},{query:'b'},{query:'c'}],
    chart_types:['top-free'],
    search_limit:10,
    min_discovery_success_ratio:0.8
  };
  await assert.rejects(
    () => collectDay({ date:'2026-09-08', config, client, root }),
    /INSUFFICIENT_DISCOVERY_HEALTH/
  );
  await assert.rejects(() => access(path.join(root, 'data/2026/09/08')));
});
