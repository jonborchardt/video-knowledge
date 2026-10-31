/** A person's name for an approval or a lock: refuses blanks and `<...>` placeholders; shared because publishing,
 *  article, script, video and the review page all ask it. */
export function approverProblem(name: string | undefined): string | null {
  const n = name?.trim() ?? '';
  return !n || n === 'automated:' || /<[^>]*>/.test(n)
    ? '--approved-by needs a real name (a person, or "automated: ...")'
    : null;
}
