import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function partitionPath(date) {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date;
  return path.join('data', String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, '0'), String(d.getUTCDate()).padStart(2, '0'));
}

function lineKey(x) {
  return [x.storefront, x.query, x.chart_type, x.app_id, x.review_id, x.discovery_position, x.chart_position]
    .filter((v) => v !== undefined && v !== null)
    .join('|');
}

function ndjson(rows) {
  return [...rows]
    .sort((a, b) => lineKey(a).localeCompare(lineKey(b)))
    .map((r) => JSON.stringify(r))
    .join('\n') + (rows.length ? '\n' : '');
}

export async function writePartition(root, date, payload) {
  const dir = path.join(root, partitionPath(date));
  try {
    await stat(dir);
    const e = new Error('PARTITION_EXISTS');
    e.code = 'PARTITION_EXISTS';
    throw e;
  } catch (e) {
    if (e.code && e.code !== 'ENOENT') throw e;
  }

  await mkdir(dir, { recursive: true });
  for (const [name, rows] of [
    ['apps', payload.apps ?? []],
    ['search', payload.search ?? []],
    ['reviews', payload.reviews ?? []],
    ['charts', payload.charts ?? []]
  ]) {
    await writeFile(path.join(dir, `${name}.ndjson`), ndjson(rows));
  }
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(payload.manifest ?? {}, null, 2) + '\n');
  return dir;
}

export async function listPartitions(root) {
  const base = path.join(root, 'data');
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (!entry.isDirectory()) continue;
      if (/^\d{2}$/.test(entry.name) && /\/\d{4}\/\d{2}\/\d{2}$/.test(p)) out.push(p);
      else await walk(p);
    }
  }
  await walk(base);
  return out.sort();
}

export async function readHistory(root) {
  const partitions = await listPartitions(root);
  const days = [];
  for (const dir of partitions) {
    const rel = path.relative(path.join(root, 'data'), dir).split(path.sep);
    const day = { date: `${rel[0]}-${rel[1]}-${rel[2]}` };
    for (const name of ['apps', 'search', 'reviews', 'charts']) {
      const text = await readFile(path.join(dir, `${name}.ndjson`), 'utf8');
      day[name] = text.trim() ? text.trim().split('\n').map(JSON.parse) : [];
    }
    day.manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
    days.push(day);
  }
  return days;
}
