// Evidence datasets: tables of cited chart points (topics/<topic>/data/*.json), checked like the storyboard's.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PassageReader } from './evidence';
import { ROOT, readJson, topicDir } from './io';
import { type ChartPoint, pointProblems } from './storyboard';

export interface DataTable {
  id: string;
  title: string;
  asOf: string; // the period the source reports, e.g. "2024 annual"
  note?: string;
  columns: { key: string; label: string }[];
  rows: { label: string; cells: ChartPoint[] }[]; // one cell per column, in order
}

export const dataRef = (topic: string, id: string) => `data:${topic}/${id}`;

/** Every topics/<topic>/data/*.json, sorted by id; [] when the topic has no data folder. */
export function loadDatasets(topic: string, root = ROOT): DataTable[] {
  const dir = join(topicDir(topic, root), 'data');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<DataTable>(join(dir, f))!)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The problems with a dataset: a row's cell count, each cell's passage, and its figures against that passage. */
export function datasetProblems(d: DataTable, read: PassageReader): string[] {
  const out: string[] = [];
  for (const row of d.rows) {
    if (row.cells.length !== d.columns.length)
      out.push(`row "${row.label}": ${row.cells.length} cells for ${d.columns.length} columns`);
    row.cells.forEach((cell, i) => {
      const name = `cell "${row.label}/${d.columns[i]?.key ?? i}"`;
      if (read(cell.cite) === null) out.push(`cell "${row.label}": no passage at ${cell.cite}`);
      else for (const p of pointProblems(cell, new Set([cell.cite]), read)) out.push(`${name}: ${p}`);
    });
  }
  return out;
}
