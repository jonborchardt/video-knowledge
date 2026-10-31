// The claim ids of a topic's stories that have a live video: what `npm run report` numbers as exhibits. A follow-up
// is live exactly when its first question is (the chain root), as the content graph marks it; tests pin the two equal.
import { storyOutputs } from '../publishing';
import { join } from 'node:path';
import { readJson, ROOT, topicDir } from '../../shared/io';
import type { StoriesFile } from '../../shared/types';

export function liveClaimIds(topic: string, root = ROOT): Set<string> {
  const claims = new Set<string>();
  const stories = readJson<StoriesFile>(join(topicDir(topic, root), 'stories.json'))?.stories ?? [];
  for (const s of stories) {
    const rootId = s.partOf ? s.id.replace(/[^/]+$/, s.partOf) : s.id;
    // A chain whose root is not itself a story has no video node in the graph: never live.
    if (stories.some((x) => x.id === rootId) && storyOutputs(topic, rootId, root).video)
      for (const c of s.claims) claims.add(c);
  }
  return claims;
}
