const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export function createAppleClient({ fetchImpl = fetch, timeoutMs = 15000, retries = 2 } = {}) {
  async function getJson(url) {
    let last;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchImpl(url, {
          headers: { 'user-agent': 'app-store-radar/0.1' },
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (!res.ok) {
          const err = new Error(`HTTP ${res.status} for ${url}`);
          err.status = res.status;
          if (!RETRYABLE.has(res.status)) throw err;
          last = err;
        } else {
          return await res.json();
        }
      } catch (err) {
        last = err;
        if (attempt === retries) throw err;
      }
    }
    throw last;
  }

  return {
    async searchApps(query, storefront, limit = 50) {
      const u = new URL('https://itunes.apple.com/search');
      u.searchParams.set('term', query);
      u.searchParams.set('entity', 'software');
      u.searchParams.set('country', storefront);
      u.searchParams.set('limit', String(limit));
      return getJson(u);
    },
    async lookupApps(ids, storefront) {
      const u = new URL('https://itunes.apple.com/lookup');
      u.searchParams.set('id', ids.join(','));
      u.searchParams.set('country', storefront);
      u.searchParams.set('entity', 'software');
      return getJson(u);
    },
    async fetchReviews(appId, storefront, maxPages = 2) {
      const entries = [];
      for (let page = 1; page <= maxPages; page++) {
        const url = `https://itunes.apple.com/${storefront}/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`;
        const json = await getJson(url);
        entries.push(...(json.feed?.entry ?? []).slice(1));
      }
      return { feed: { entry: entries } };
    },
    async fetchChart(storefront, chartType, limit = 100) {
      return getJson(`https://rss.applemarketingtools.com/api/v2/${storefront}/apps/${chartType}/${limit}/apps.json`);
    }
  };
}
