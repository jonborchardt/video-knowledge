// The miniature fixture topic (spec §5.8): real content, claimed by the existing commission as a fixture topic, kept
// out of the production site and of every automatic selection, present only in a FIXTURE_SITE=1 build.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commissionOf, commissions, isFixtureTopic } from '../src/config/site';
import { fixtureTopicNames, publicTopicNames, topicNames } from '../src/modules/evidence';
import { contentGraph, storyNode } from '../src/modules/website';
import { loadStories } from '../src/modules/stories';
import { ROOT, topicDir } from '../src/shared/io';

const T = 'test-fixture';

describe('the fixture topic', () => {
  it('is claimed by the existing commission as a fixture topic, never as a public one', () => {
    expect(isFixtureTopic(T)).toBe(true);
    expect(isFixtureTopic('heat-pumps')).toBe(false);
    expect(commissionOf(T)).toBe(commissions.spending);
    expect(commissions.spending.topics).not.toContain(T);
    expect(topicNames()).toContain(T);
    expect(publicTopicNames()).not.toContain(T);
    expect(fixtureTopicNames()).toEqual([T]);
  });
  it('has one ready story with the 15 s target, built from a real store with a direct study verdict', () => {
    const stories = loadStories(T)!.stories;
    const ready = stories.filter((s) => s.readiness === 'ready');
    expect(ready).toHaveLength(1);
    expect(ready[0].targetDurationSeconds).toBe(15);
    expect(ready[0].claims).toEqual([`${T}/every-leap-second-since-utc-began`]);
    expect(ready[0].audit.central.status).toBe('supported');
    expect(existsSync(join(topicDir(T), 'sources', 'iers-leap-second-dat.txt'))).toBe(true);
    expect(existsSync(join(topicDir(T), 'history'))).toBe(false); // gitignored and never committed
  });
  it('is absent from the live and preview graphs of the public topics, and present only in the fixture view', () => {
    expect(contentGraph(ROOT, publicTopicNames(), 'live').nodes.has(T)).toBe(false);
    const fixture = contentGraph(ROOT, [...publicTopicNames(), T], 'fixture');
    expect(fixture.nodes.get(T)?.kind).toBe('inquiry');
    const story = loadStories(T)!.stories[0];
    const node = fixture.nodes.get(storyNode(T, story.id));
    expect(node?.kind).toBe('story');
    // public in the fixture view exactly when its video is live or its build is packaged
    const packaged = existsSync(
      join(topicDir(T), 'scripts', 'decision-most-discussed-claims', 'video', 'review', 'review.json'),
    );
    expect(node?.public).toBe(packaged);
    const live = contentGraph(ROOT, [...publicTopicNames(), T], 'live');
    expect(live.nodes.get(storyNode(T, story.id))?.public).toBe(false);
  });
});
