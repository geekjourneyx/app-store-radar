import { normalizeApps, normalizeChart, normalizeReviews, normalizeSearch } from './normalize.js';
import { writePartition } from './storage.js';

function uniq(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(key(row), row);
  return [...map.values()];
}

async function mapLimit(items, limit, worker) {
  const concurrency = Math.max(1, Number(limit) || 1);
  let index = 0;
  async function run() {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

export function selectReviewWatchlist({
  search,
  charts,
  storefront,
  searchPerSeed = 2,
  chartPerType = 10,
  maxApps = 50
}) {
  const selected = new Map();
  const add = (row) => {
    if (!row?.app_id || selected.size >= maxApps) return;
    selected.set(`${storefront}:${row.app_id}`, { storefront, app_id: row.app_id });
  };

  const queries = [...new Set(search.filter((r) => r.storefront === storefront).map((r) => r.query))];
  for (const query of queries) {
    search
      .filter((r) => r.storefront === storefront && r.query === query)
      .sort((a, b) => a.discovery_position - b.discovery_position)
      .slice(0, searchPerSeed)
      .forEach(add);
  }

  const chartTypes = [...new Set(charts.filter((r) => r.storefront === storefront).map((r) => r.chart_type))];
  for (const chartType of chartTypes) {
    charts
      .filter((r) => r.storefront === storefront && r.chart_type === chartType)
      .sort((a, b) => a.chart_position - b.chart_position)
      .slice(0, chartPerType)
      .forEach(add);
  }

  return [...selected.values()].slice(0, maxApps);
}

export async function collectDay({ date, config, client, root = '.' }) {
  const search = [], charts = [], apps = [], reviews = [], failures = [];
  const sourceSuccess = { search: 0, chart: 0, lookup: 0, reviews: 0 };
  let successes = 0;
  const tracked = new Map();

  for (const storefront of config.storefronts) {
    for (const seed of config.seeds) {
      try {
        const rows = normalizeSearch(await client.searchApps(seed.query, storefront, config.search_limit), { query: seed.query, storefront });
        search.push(...rows);
        rows.forEach((r) => tracked.set(`${storefront}:${r.app_id}`, { storefront, app_id: r.app_id }));
        sourceSuccess.search++;
        successes++;
      } catch (e) {
        failures.push({ source: 'search', storefront, query: seed.query, error: String(e.message ?? e) });
      }
    }
    for (const chartType of config.chart_types) {
      try {
        const rows = normalizeChart(await client.fetchChart(storefront, chartType, 100), { storefront, chartType });
        charts.push(...rows);
        rows.forEach((r) => tracked.set(`${storefront}:${r.app_id}`, { storefront, app_id: r.app_id }));
        sourceSuccess.chart++;
        successes++;
      } catch (e) {
        failures.push({ source: 'chart', storefront, chart_type: chartType, error: String(e.message ?? e) });
      }
    }
  }

  const discoveryAttempts = config.storefronts.length * (config.seeds.length + config.chart_types.length);
  const discoverySuccesses = sourceSuccess.search + sourceSuccess.chart;
  const discoverySuccessRatio = discoveryAttempts ? discoverySuccesses / discoveryAttempts : 0;
  const minimumDiscoverySuccessRatio = config.min_discovery_success_ratio ?? 0.8;
  if (discoverySuccessRatio < minimumDiscoverySuccessRatio) {
    const error = new Error(`INSUFFICIENT_DISCOVERY_HEALTH ${discoverySuccesses}/${discoveryAttempts}`);
    error.code = 'INSUFFICIENT_DISCOVERY_HEALTH';
    throw error;
  }

  for (const storefront of config.storefronts) {
    const ids = [...tracked.values()].filter((x) => x.storefront === storefront).map((x) => x.app_id);
    for (let i = 0; i < ids.length; i += 100) {
      try {
        apps.push(...normalizeApps(await client.lookupApps(ids.slice(i, i + 100), storefront), storefront));
        sourceSuccess.lookup++;
        successes++;
      } catch (e) {
        failures.push({ source: 'lookup', storefront, error: String(e.message ?? e) });
      }
    }
  }

  const reviewWatchlist = config.storefronts.flatMap((storefront) => selectReviewWatchlist({
    search,
    charts,
    storefront,
    searchPerSeed: config.review_search_apps_per_seed ?? 2,
    chartPerType: config.review_chart_apps_per_type ?? 10,
    maxApps: config.max_review_apps_per_storefront ?? 50
  }));
  const pages = Math.max(1, Math.ceil((config.reviews_per_app ?? 50) / 50));

  await mapLimit(reviewWatchlist, config.review_concurrency ?? 4, async (item) => {
    try {
      const rows = normalizeReviews(await client.fetchReviews(item.app_id, item.storefront, pages), { appId: item.app_id, storefront: item.storefront });
      reviews.push(...rows.slice(0, config.reviews_per_app ?? 50));
      sourceSuccess.reviews++;
      successes++;
    } catch (e) {
      failures.push({ source: 'reviews', storefront: item.storefront, app_id: item.app_id, error: String(e.message ?? e) });
    }
  });

  if (!successes) throw new Error('NO_SUCCESSFUL_SOURCES');

  const payload = {
    apps: uniq(apps, (r) => `${r.storefront}:${r.app_id}`),
    search: uniq(search, (r) => `${r.storefront}:${r.query}:${r.app_id}`),
    reviews: uniq(reviews, (r) => `${r.storefront}:${r.review_id}`),
    charts: uniq(charts, (r) => `${r.storefront}:${r.chart_type}:${r.app_id}`),
    manifest: {
      date,
      successes,
      source_success: sourceSuccess,
      failures,
      health: {
        discovery_successes: discoverySuccesses,
        discovery_attempts: discoveryAttempts,
        discovery_success_ratio: Number(discoverySuccessRatio.toFixed(4)),
        minimum_discovery_success_ratio: minimumDiscoverySuccessRatio
      },
      counts: {
        tracked_apps: tracked.size,
        review_watchlist_apps: reviewWatchlist.length,
        apps: apps.length,
        search: search.length,
        reviews: reviews.length,
        charts: charts.length
      }
    }
  };

  await writePartition(root, date, payload);
  return payload.manifest;
}
