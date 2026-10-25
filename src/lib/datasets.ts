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

const fields = (line: string) => line.split('|').map((f) => f.replace(/\s+/g, ' ').trim());

/** The problems with a dataset: a row's cell count, each cell's passage, and its figures against that passage. A cell
 *  citing one table line (fields separated by '|') must sit on its row's line (the first field is the row label) and
 *  in its own column: column i is field i + 1. */
export function datasetProblems(d: DataTable, read: PassageReader): string[] {
  const out: string[] = [];
  for (const row of d.rows) {
    if (row.cells.length !== d.columns.length)
      out.push(`row "${row.label}": ${row.cells.length} cells for ${d.columns.length} columns`);
    const label = fields(row.label)[0];
    row.cells.forEach((cell, i) => {
      const name = `cell "${row.label}/${d.columns[i]?.key ?? i}"`;
      const passage = read(cell.cite);
      if (passage === null) return out.push(`cell "${row.label}": no passage at ${cell.cite}`);
      for (const p of pointProblems(cell, new Set([cell.cite]), read)) out.push(`${name}: ${p}`);
      const lines = passage.split('\n').filter((l) => l.includes('|'));
      if (lines.length !== 1) return; // prose, or a range: the figure check above is all there is
      const f = fields(lines[0]);
      if (f[0] !== label) out.push(`${name}: row "${row.label}" is not the first field of its line ("${f[0]}")`);
      if (f[i + 1] !== cell.display.replace(/\s+/g, ' ').trim())
        out.push(`${name}: display "${cell.display}" is not field ${i + 2} of its line ("${f[i + 1] ?? ''}")`);
    });
  }
  return out;
}

/** A dataset as CSV (RFC 4180): `label` then the column labels, one row per row, each cell as its display text. */
export function datasetCsv(d: DataTable): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
  const lines = [
    ['label', ...d.columns.map((c) => c.label)],
    ...d.rows.map((r) => [r.label, ...r.cells.map((c) => c.display)]),
  ];
  return lines.map((l) => l.map(cell).join(',')).join('\n') + '\n';
}
