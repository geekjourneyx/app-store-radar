import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { collectDay } from '../src/collect.js';
import { normalizeApps } from '../src/normalize.js';
import { writePartition } from '../src/storage.js';

test('daily app snapshots omit long descriptions', () => {
  const [app] = normalizeApps({ results:[{
    trackId:1,
    trackName:'Example',
    description:'x'.repeat(10000),
    releaseNotes:'Added export',
    userRatingCount:42,
    version:'2.0'
  }] }, 'us');
  assert.equal('description' in app, false);
  assert.equal(app.release_notes, 'Added export');
  assert.equal(app.rating_count, 42);
});

test('collector stores only review ids not already present in history', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'radar-storage-'));
  await writePartition(root, '2026-09-07', {
    apps:[], search:[], charts:[],
    reviews:[{
      review_id:'old-review', app_id:'1', storefront:'us', rating:5,
      title:'Old', body:'Already captured', version:'1.0', author:'A', created_at:'2026-09-07T00:00:00Z'
    }],
    manifest:{ date:'2026-09-07' }
  });

  const client = {
    async searchApps() { return { results:[{ trackId:1, trackName:'Example' }] }; },
    async fetchChart() { return { feed:{ results:[] } }; },
    async lookupApps() { return { results:[{ trackId:1, trackName:'Example', userRatingCount:10, version:'1.0' }] }; },
    async fetchReviews() {
      const entry = (id, body) => ({
        id:{label:id}, 'im:rating':{label:'5'}, title:{label:id}, content:{label:body},
        'im:version':{label:'1.0'}, author:{name:{label:'A'}}, updated:{label:'2026-09-08T00:00:00Z'}
      });
      return { feed:{ entry:[entry('old-review','Already captured'), entry('new-review','New demand')] } };
    }
  };
  const config = {
    storefronts:['us'], seeds:[{query:'journal'}], chart_types:[], search_limit:10,
    reviews_per_app:50, review_search_apps_per_seed:1, review_chart_apps_per_type:0,
    max_review_apps_per_storefront:10, review_concurrency:1, min_discovery_success_ratio:0.8
  };

  await collectDay({ date:'2026-09-08', config, client, root });
  const text = await readFile(path.join(root, 'data/2026/09/08/reviews.ndjson'), 'utf8');
  const rows = text.trim().split('\n').filter(Boolean).map(JSON.parse);
  assert.deepEqual(rows.map((row) => row.review_id), ['new-review']);
});
