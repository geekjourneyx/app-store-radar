#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createAppleClient } from './apple.js';
import { collectDay } from './collect.js';
import { writeWeekly } from './report.js';

const args = process.argv.slice(2);
const cmd = args.shift();
function flag(name, fallback) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; }
const root = path.resolve(flag('--root', '.'));
const dateStr = flag('--date', new Date().toISOString().slice(0, 10));
const date = new Date(`${dateStr}T00:00:00Z`);
const config = JSON.parse(await readFile(new URL('../config/radar.json', import.meta.url)));

try {
  if (cmd === 'collect') await collectDay({ date: dateStr, config, client: createAppleClient(), root });
  else if (cmd === 'weekly') await writeWeekly({ root, date, config });
  else throw new Error('Usage: node src/cli.js <collect|weekly> [--date YYYY-MM-DD] [--root PATH]');
} catch (e) {
  console.error(e.code ?? e.message);
  process.exitCode = 1;
}
