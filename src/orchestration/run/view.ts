// The admin Automation tab's model (read-only, from .automation/ and the journals): the last tick and work job, this
// week's picks, what is due, the unsent mail, the preflight halt, the week's spend; phase 3: the open release
// requests and their age, the launches, the optional Studio steps still to record.
import { join } from 'node:path';
import { ROOT, readJson } from '../../shared/io';
import { weekSpend } from './runner';
import type { Halt } from './journal';
import { type OutboxEntry, automationDir, unsentOutbox } from './notify';
import { type DueResume, type PickRecord, isoWeek, readSchedule } from './schedule';
import { statusOf } from './status';
import { PREFLIGHT_HALT } from './tick';
import { loadLedger, openRequest, storyOutputs } from '../../modules/publishing';
import { type LaunchRecord, launches } from './launch';
import { storiesWithLedgers } from './publish-due';
import { loadMaintenance, publicTopicNames } from '../../modules/evidence';
import { loadArticleRequest } from '../../modules/article';
import { loadStories } from '../../modules/stories';
import { isFixtureTopic } from '../../config/site';

export interface AutomationView {
  lastTick: string | null;
  lastWork: { kind: string; outcome: string; at: string } | null;
  week: string;
  picks: PickRecord[];
  due: DueResume[];
  unsent: OutboxEntry[];
  preflight: Halt | null;
  spendUsd: number;
  /** Open release requests (undecided, unexpired), oldest first. */
  requests: { topic: string; storyId: string; request: string; at: string; expiresAt: string; ageHours: number }[];
  launches: LaunchRecord[];
  /** The optional Studio steps YouTube keeps manual, not yet recorded done (`publish -- updated --fields <name>`). */
  studio: { topic: string; storyId: string; step: string; record: string }[];
  /** Phase 6: each public topic's last maintenance scan, and the article corrections awaiting the person's reply. */
  scans: { topic: string; lastScan: string | null; found: number; recorded: number }[];
  corrections: { topic: string; storyId: string; request: string; at: string; expiresAt: string }[];
}

/** The Studio steps still to record for a launched story: a live Short's related video, the video's end screen and cards. */
export function studioSteps(topic: string, storyId: string, root = ROOT) {
  const ledger = loadLedger(topic, storyId, root);
  if (!ledger) return [];
  const outs = storyOutputs(topic, storyId, root);
  const recorded = (output: string, field: string) =>
    ledger.outputs[output]?.events.some((e) => e.type === 'updated' && e.fields?.includes(field));
  const out: AutomationView['studio'][number][] = [];
  if (outs.video)
    for (const field of ['endScreen', 'cards'])
      if (!recorded('youtube', field))
        out.push({
          topic,
          storyId,
          step: field === 'endScreen' ? 'end screen elements on the video' : 'cards on the video',
          record: `npm run publish -- updated ${topic} ${storyId} --fields ${field}`,
        });
  for (const sh of outs.shorts)
    if (!recorded(sh.output, 'relatedVideo'))
      out.push({
        topic,
        storyId,
        step: `related video on ${sh.output}`,
        record: `npm run publish -- updated ${topic} ${storyId}/shorts/${sh.output.slice('short:'.length)} --fields relatedVideo`,
      });
  return out;
}

export function automationView(root = ROOT, now = Date.now()): AutomationView {
  const s = readSchedule(root);
  const week = isoWeek(now);
  const stories = storiesWithLedgers(root);
  const requests = stories
    .flatMap(([topic, storyId]) => {
      const l = loadLedger(topic, storyId, root);
      const r = l && openRequest(l, undefined, new Date(now));
      return r
        ? [
            {
              topic,
              storyId,
              request: r.request,
              at: r.at,
              expiresAt: r.expiresAt,
              ageHours: (now - Date.parse(r.at)) / 3_600_000,
            },
          ]
        : [];
    })
    .sort((x, y) => x.at.localeCompare(y.at));
  const launched = launches(root);
  const studio = launched.filter((r) => r.liveAt).flatMap((r) => studioSteps(r.topic, r.storyId, root));
  const scans = publicTopicNames()
    .filter((t) => !isFixtureTopic(t))
    .map((t) => {
      const m = loadMaintenance(t, root);
      const last = m?.scans.at(-1);
      return { topic: t, lastScan: m?.lastScan ?? null, found: last?.found ?? 0, recorded: last?.recorded ?? 0 };
    });
  const corrections = publicTopicNames().flatMap((t) =>
    (loadStories(t, root)?.stories ?? []).flatMap((s) => {
      const r = loadArticleRequest(t, s.id, root);
      return r && !r.decided && Date.parse(r.expiresAt) > now
        ? [{ topic: t, storyId: s.id, request: r.request, at: r.at, expiresAt: r.expiresAt }]
        : [];
    }),
  );
  return {
    requests,
    launches: launched,
    studio,
    scans,
    corrections,
    lastTick: s.lastTick ?? null,
    lastWork: s.lastWork ?? null,
    week,
    picks: s.week === week ? (s.picks ?? []) : [],
    due: s.due ?? [],
    unsent: unsentOutbox(root),
    preflight: readJson<Halt>(join(automationDir(root), PREFLIGHT_HALT)),
    spendUsd: weekSpend(root, week) || statusOf(root).reduce((n, r) => n + r.costUsd, 0),
  };
}
