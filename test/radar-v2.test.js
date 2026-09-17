import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { selectReviewWatchlist, inspectChartIntegrity } from '../src/collect.js';
import { normalizeApps } from '../src/normalize.js';
import { extractReviewSignals } from '../src/review-signals.js';
import { buildSignals } from '../src/signals.js';
import { writePartition } from '../src/storage.js';
import { buildDailyEvidence, renderDailyMarkdown, writeDaily } from '../src/daily-report.js';
import { writeWeekly } from '../src/report.js';

test('CN policy can prioritize all top-paid 100 apps before search sampling', () => {
  const charts = [
    ...Array.from({ length: 100 }, (_, i) => ({ storefront:'cn', chart_type:'top-paid', app_id:`paid-${i+1}`, chart_position:i+1 })),
    ...Array.from({ length: 100 }, (_, i) => ({ storefront:'cn', chart_type:'top-free', app_id:`free-${i+1}`, chart_position:i+1 }))
  ];
  const search = Array.from({ length: 20 }, (_, i) => ({ storefront:'cn', query:'pdf scanner', app_id:`search-${i+1}`, discovery_position:i+1 }));
  const rows = selectReviewWatchlist({
    search, charts, storefront:'cn', searchPerSeed:1,
    chartLimits:{ 'top-paid':100, 'top-free':10 },
    chartPriority:['top-paid', 'top-free'], maxApps:120
  });
  assert.equal(rows.filter((x) => x.source === 'chart:top-paid').length, 100);
  assert.ok(rows.some((x) => x.app_id === 'paid-100'));
});

test('chart integrity reports missing positions instead of silently accepting 99 rows', () => {
  const charts = Array.from({ length: 99 }, (_, i) => ({ storefront:'cn', chart_type:'top-paid', app_id:String(i+1), chart_position:i+1 }));
  const [health] = inspectChartIntegrity(charts, { storefronts:['cn'], chartTypes:['top-paid'], expectedCount:100 });
  assert.equal(health.complete, false);
  assert.equal(health.observed_count, 99);
  assert.deepEqual(health.missing_positions, [100]);
});

test('app metadata preserves commercial and age signals needed for opportunity analysis', () => {
  const [app] = normalizeApps({ results:[{
    trackId:1, trackName:'Tiny Tool', price:6, formattedPrice:'¥6.00', currency:'CNY',
    releaseDate:'2026-08-01T00:00:00Z', currentVersionReleaseDate:'2026-09-10T00:00:00Z',
    minimumOsVersion:'18.0', userRatingCount:42
  }] }, 'cn');
  assert.equal(app.formatted_price, '¥6.00');
  assert.equal(app.initial_release_date, '2026-08-01T00:00:00Z');
  assert.equal(app.minimum_os_version, '18.0');
  assert.equal(app.price_model, 'paid');
});

test('Chinese reviews become explicit pain request and value signals with evidence excerpts', () => {
  const rows = extractReviewSignals([
    { storefront:'cn', app_id:'1', review_id:'r1', rating:5, title:'很推荐', body:'要是每天背完单词后能跟一篇阅读短文就好了，页面也很简洁。' },
    { storefront:'cn', app_id:'2', review_id:'r2', rating:1, title:'白花钱', body:'付费后悬浮视频不能用了，怎么解决？' },
    { storefront:'cn', app_id:'3', review_id:'r3', rating:5, title:'干净', body:'无需登录，不联网，没有广告，功能很纯粹。' }
  ]);
  assert.ok(rows.some((x) => x.review_id === 'r1' && x.job === 'learning transfer' && x.intent === 'request'));
  assert.ok(rows.some((x) => x.review_id === 'r2' && x.job === 'reliability' && x.intent === 'pain'));
  assert.ok(rows.some((x) => x.review_id === 'r3' && x.job === 'local/private workflow' && x.intent === 'value'));
  assert.ok(rows.every((x) => x.evidence_excerpt.length <= 160));
});

test('signals expose paid-chart persistence for small-developer proxy detection', () => {
  const history = [1,2,3].map((d) => ({
    date:`2026-09-0${d}`,
    apps:[{ storefront:'cn', app_id:'1', app_name:'Tiny Tool', rating_count:42, price:6, version:'1.0' }],
    reviews:[], search:[], manifest:{},
    charts:[{ storefront:'cn', chart_type:'top-paid', app_id:'1', chart_position:30+d }]
  }));
  const [signal] = buildSignals(history);
  assert.equal(signal.chart_presence['top-paid'].days, 3);
  assert.equal(signal.chart_presence['top-paid'].latest_position, 33);
});

test('daily evidence renders a readable decision-oriented markdown report', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'radar-daily-'));
  const makeDay = async (date, rank, ratingCount, review) => writePartition(root, date, {
    apps:[{ storefront:'cn', app_id:'1', app_name:'Tiny Tool', price:6, formatted_price:'¥6', rating_count:ratingCount, initial_release_date:'2026-08-01T00:00:00Z', version:'1.0' }],
    search:[],
    charts:[{ storefront:'cn', chart_type:'top-paid', app_id:'1', app_name:'Tiny Tool', chart_position:rank }],
    reviews: review ? [review] : [],
    manifest:{ date, failures:[], health:{ chart_integrity:[{ storefront:'cn', chart_type:'top-paid', expected_count:100, observed_count:100, missing_positions:[], complete:true }] } }
  });
  await makeDay('2026-09-16', 50, 20, null);
  await makeDay('2026-09-17', 20, 42, { storefront:'cn', app_id:'1', review_id:'r1', rating:5, title:'建议', body:'希望增加导出 Markdown 功能' });
  const evidence = await buildDailyEvidence({ root, date:new Date('2026-09-17T00:00:00Z'), config:{ small_developer_rating_count_max:500 } });
  assert.equal(evidence.cn_paid.movers[0].delta, 30);
  assert.equal(evidence.small_developer_signals[0].app_id, '1');
  const md = renderDailyMarkdown(evidence);
  assert.match(md, /China Paid Chart/);
  assert.match(md, /Review Signals/);
  assert.match(md, /Evidence Chain/);
  await writeDaily({ root, date:new Date('2026-09-17T00:00:00Z'), config:{ small_developer_rating_count_max:500 } });
  const stored = await readFile(path.join(root, 'reports/daily/2026-09-17.md'), 'utf8');
  assert.match(stored, /Tiny Tool/);
});

test('daily report derives chart integrity when legacy manifest lacks integrity data', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'radar-legacy-health-'));
  await writePartition(root, '2026-09-17', {
    apps:[], search:[], reviews:[],
    charts:Array.from({ length:99 }, (_, i) => ({ storefront:'cn', chart_type:'top-paid', app_id:String(i+1), app_name:`App ${i+1}`, chart_position:i+1 })),
    manifest:{ date:'2026-09-17', failures:[], health:{} }
  });
  const evidence = await buildDailyEvidence({ root, date:new Date('2026-09-17T00:00:00Z'), config:{} });
  assert.equal(evidence.collection_health.chart_integrity_status, 'derived');
  assert.equal(evidence.collection_health.chart_integrity[0].complete, false);
  assert.deepEqual(evidence.collection_health.chart_integrity[0].missing_positions, [100]);
  const md = renderDailyMarkdown(evidence);
  assert.match(md, /Incomplete charts: \*\*1\*\*/);
  assert.match(md, /derived from raw chart rows/);
});

test('weekly output is stored under explicit weekly evidence and report directories', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'radar-weekly-'));
  await writePartition(root, '2026-09-17', { apps:[], search:[], charts:[], reviews:[], manifest:{ date:'2026-09-17', failures:[] } });
  await writeWeekly({ root, date:new Date('2026-09-17T00:00:00Z'), config:{ thresholds:{} } });
  const md = await readFile(path.join(root, 'reports/weekly/2026-W38.md'), 'utf8');
  const json = await readFile(path.join(root, 'evidence/weekly/2026-W38.json'), 'utf8');
  assert.match(md, /App Store Opportunity Radar/);
  assert.match(json, /"week": "2026-W38"/);
});
