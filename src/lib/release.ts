// Release: the fingerprints a person approved with `npm run script -- lock`, and the check that they still hold.
import { sha, toJson } from '../shared/io';
import { validationFingerprint } from '../shared/sentence-validation';
import type { Issue, Release, ScriptValidation } from '../shared/types';
import type { Storyboard } from './storyboard';

/** The filled storyboard minus its issue list (release warnings are written into it). */
export const storyboardFingerprint = (sb: Storyboard) => {
  const { issues: _i, status: _s, ...rest } = sb;
  void [_i, _s];
  return sha(toJson(rest));
};

/** One warning per locked fingerprint the current script, package, validation or storyboard no longer matches. */
export function releaseCheck(release: Release | null, v: ScriptValidation, sb: Storyboard | null): Issue[] {
  if (!release) return [];
  const stale = (what: string, locked: string, now: string | null) => ({
    sentence: '-',
    category: 'release-stale',
    severity: 'warning' as const,
    explanation: `release.json locked ${what} ${locked}; it is now ${now ?? '(none)'}: the approved package has changed, lock it again after review`,
    by: 'deterministic' as const,
  });
  const out: Issue[] = [];
  if (release.fingerprints.script !== v.scriptFingerprint)
    out.push(stale('script', release.fingerprints.script, v.scriptFingerprint));
  if (release.fingerprints.package !== v.packageFingerprint)
    out.push(stale('package', release.fingerprints.package, v.packageFingerprint));
  if (release.fingerprints.validation !== validationFingerprint(v))
    out.push(stale('validation', release.fingerprints.validation, validationFingerprint(v)));
  if (sb && release.fingerprints.storyboard !== storyboardFingerprint(sb))
    out.push(stale('storyboard', release.fingerprints.storyboard, storyboardFingerprint(sb)));
  return out;
}
