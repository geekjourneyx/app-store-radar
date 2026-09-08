function appKey(x) { return `${x.storefront}:${x.app_id}`; }

export function buildSignals(history) {
  const perApp = new Map();
  for (const day of history) {
    for (const app of day.apps) {
      const key = appKey(app);
      if (!perApp.has(key)) perApp.set(key, []);
      perApp.get(key).push({ date: day.date, ...app });
    }
  }

  const reviewsByApp = new Map();
  const chartsByApp = new Map();
  const searchByApp = new Map();

  for (const day of history) {
    const seenReviews = new Set();
    for (const review of day.reviews) {
      const key = appKey(review);
      if (!reviewsByApp.has(key)) reviewsByApp.set(key, []);
      const stable = `${key}:${review.review_id}`;
      if (!seenReviews.has(stable)) {
        reviewsByApp.get(key).push({ date: day.date, id: review.review_id });
        seenReviews.add(stable);
      }
    }
    for (const chart of day.charts) {
      const key = appKey(chart);
      if (!chartsByApp.has(key)) chartsByApp.set(key, []);
      chartsByApp.get(key).push({ date: day.date, position: chart.chart_position });
    }
    for (const search of day.search) {
      const key = appKey(search);
      if (!searchByApp.has(key)) searchByApp.set(key, []);
      searchByApp.get(key).push({ date: day.date, query: search.query, discovery_position: search.discovery_position });
    }
  }

  const output = [];
  for (const [key, rows] of perApp) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const first = rows[0], last = rows.at(-1);
    const ratingDelta = (last.rating_count ?? 0) - (first.rating_count ?? 0);
    const recent = rows.length >= 3 ? (rows.at(-1).rating_count ?? 0) - (rows.at(-2).rating_count ?? 0) : null;
    const previous = rows.length >= 3 ? (rows.at(-2).rating_count ?? 0) - (rows.at(-3).rating_count ?? 0) : null;
    const charts = chartsByApp.get(key) ?? [];
    const searches = searchByApp.get(key) ?? [];
    const reviews = reviewsByApp.get(key) ?? [];

    output.push({
      key,
      storefront: last.storefront,
      app_id: last.app_id,
      app_name: last.app_name,
      rating_velocity: { delta: ratingDelta, from: first.date, to: last.date, confidence: rows.length > 1 ? 'normal' : 'low' },
      rating_acceleration: recent !== null && previous !== null ? recent - previous : null,
      review_velocity: { new_reviews: new Set(reviews.map((x) => x.id)).size, observed_days: new Set(reviews.map((x) => x.date)).size },
      chart_momentum: charts.length > 1 ? charts[0].position - charts.at(-1).position : null,
      release_velocity: { versions: new Set(rows.map((x) => x.version).filter(Boolean)).size },
      search_presence: {
        queries: [...new Set(searches.map((x) => x.query))],
        observations: searches.length,
        positions: searches.map(({ date, query, discovery_position }) => ({ date, query, discovery_position }))
      }
    });
  }
  return output;
}
