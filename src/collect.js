import { normalizeApps, normalizeChart, normalizeReviews, normalizeSearch } from './normalize.js';
import { writePartition } from './storage.js';

function uniq(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(key(row), row);
  return [...map.values()];
}

export async function collectDay({ date, config, client, root = '.' }) {
  const search = [], charts = [], apps = [], reviews = [], failures = [];
  let successes = 0;
  const tracked = new Map();

  for (const storefront of config.storefronts) {
    for (const seed of config.seeds) {
      try {
        const rows = normalizeSearch(await client.searchApps(seed.query, storefront, config.search_limit), { query: seed.query, storefront });
        search.push(...rows);
        rows.forEach((r) => tracked.set(`${storefront}:${r.app_id}`, { storefront, app_id: r.app_id }));
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
        successes++;
      } catch (e) {
        failures.push({ source: 'chart', storefront, chart_type: chartType, error: String(e.message ?? e) });
      }
    }
  }

  for (const storefront of config.storefronts) {
    const ids = [...tracked.values()].filter((x) => x.storefront === storefront).map((x) => x.app_id);
    for (let i = 0; i < ids.length; i += 100) {
      try {
        apps.push(...normalizeApps(await client.lookupApps(ids.slice(i, i + 100), storefront), storefront));
        successes++;
      } catch (e) {
        failures.push({ source: 'lookup', storefront, error: String(e.message ?? e) });
      }
    }
  }

  const pages = Math.max(1, Math.ceil((config.reviews_per_app ?? 100) / 50));
  for (const item of tracked.values()) {
    try {
      const rows = normalizeReviews(await client.fetchReviews(item.app_id, item.storefront, pages), { appId: item.app_id, storefront: item.storefront });
      reviews.push(...rows.slice(0, config.reviews_per_app ?? 100));
      successes++;
    } catch (e) {
      failures.push({ source: 'reviews', storefront: item.storefront, app_id: item.app_id, error: String(e.message ?? e) });
    }
  }

  if (!successes) throw new Error('NO_SUCCESSFUL_SOURCES');

  const payload = {
    apps: uniq(apps, (r) => `${r.storefront}:${r.app_id}`),
    search: uniq(search, (r) => `${r.storefront}:${r.query}:${r.app_id}`),
    reviews: uniq(reviews, (r) => `${r.storefront}:${r.review_id}`),
    charts: uniq(charts, (r) => `${r.storefront}:${r.chart_type}:${r.app_id}`),
    manifest: {
      date,
      successes,
      failures,
      counts: { tracked_apps: tracked.size, apps: apps.length, search: search.length, reviews: reviews.length, charts: charts.length }
    }
  };

  await writePartition(root, date, payload);
  return payload.manifest;
}
