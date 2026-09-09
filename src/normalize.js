function val(x) { return x?.label ?? x ?? null; }

export function normalizeSearch(json, { query, storefront }) {
  return (json.results ?? []).map((r, i) => ({
    storefront,
    query,
    app_id: String(r.trackId),
    bundle_id: r.bundleId ?? null,
    app_name: r.trackName ?? null,
    seller: r.sellerName ?? null,
    discovery_position: i + 1
  }));
}

export function normalizeApps(json, storefront) {
  return (json.results ?? []).map((r) => ({
    storefront,
    app_id: String(r.trackId),
    bundle_id: r.bundleId ?? null,
    app_name: r.trackName ?? null,
    seller: r.sellerName ?? null,
    primary_genre: r.primaryGenreName ?? null,
    genres: r.genres ?? [],
    price: r.price ?? null,
    currency: r.currency ?? null,
    average_rating: r.averageUserRating ?? null,
    rating_count: r.userRatingCount ?? null,
    current_version_rating: r.averageUserRatingForCurrentVersion ?? null,
    current_version_rating_count: r.userRatingCountForCurrentVersion ?? null,
    version: r.version ?? null,
    release_date: r.currentVersionReleaseDate ?? null,
    release_notes: r.releaseNotes ?? null,
    url: r.trackViewUrl ?? null
  }));
}

export function normalizeReviews(json, { appId, storefront }) {
  return (json.feed?.entry ?? []).filter((e) => e?.id).map((e) => ({
    review_id: String(val(e.id)),
    app_id: String(appId),
    storefront,
    rating: Number(val(e['im:rating']) ?? 0),
    title: val(e.title) ?? '',
    body: val(e.content) ?? '',
    version: val(e['im:version']) ?? null,
    author: val(e.author?.name) ?? null,
    created_at: val(e.updated) ?? null
  }));
}

export function normalizeChart(json, { storefront, chartType }) {
  return (json.feed?.results ?? []).map((r, i) => ({
    storefront,
    chart_type: chartType,
    app_id: String(r.id),
    app_name: r.name ?? null,
    chart_position: i + 1
  }));
}
