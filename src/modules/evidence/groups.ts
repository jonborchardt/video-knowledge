// Extraction groups (spec §5.2 `extract`): the fetched, unextracted sources split into groups of at most `maxChars`
// of transcript, one extraction agent per group. Pure split; the CLI reads the watcher's `next --json`.
export interface GroupEntry {
  id: string;
  chars: number;
}
/** Greedy, in order: a new group when the next entry would pass the cap; an oversized entry gets its own group. */
export function splitGroups<T extends GroupEntry>(entries: T[], maxChars = 400_000): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const e of entries) {
    if (current.length && size + e.chars > maxChars) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(e);
    size += e.chars;
  }
  if (current.length) groups.push(current);
  return groups;
}
