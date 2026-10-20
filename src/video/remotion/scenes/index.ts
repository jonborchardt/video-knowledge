// Component name -> component; each is drawn by ./<name>.tsx (the render cache hashes that file). A kind's record in
// src/video/kinds.ts or src/video/bespoke/ names its component, so an unsupported scene never reaches here.
import type { FC } from 'react';
import { ALL_KINDS, type SceneKind } from '../../kinds';
import type { TimelineScene } from '../../types';
import { Bar } from './Bar';
import { CourtsEvidence } from './CourtsEvidence';
import { FlagStamps } from './FlagStamps';
import { Choices } from './Choices';
import { Stamp } from './Stamp';
import { Steps } from './Steps';
import { Scorecard } from './Scorecard';
import { Versus } from './Versus';
import { Dumbbell } from './Dumbbell';
import { Gauge } from './Gauge';
import { Funnel } from './Funnel';
import { Columns } from './Columns';
import { Cohort } from './Cohort';
import { Curve } from './Curve';
import { BranchClosing } from './BranchClosing';
import { CommissionIcons } from './CommissionIcons';
import { Composite } from './Composite';
import { Courtroom } from './Courtroom';
import { DistrictTiers } from './DistrictTiers';
import { DotPlot } from './DotPlot';
import { EvidenceCards } from './EvidenceCards';
import { Excerpt } from './Excerpt';
import { FinePrint } from './FinePrint';
import { PersonGrid } from './PersonGrid';
import { ProtestStrip } from './ProtestStrip';
import { Phone } from './Phone';
import { Pyramid } from './Pyramid';
import { Quote } from './Quote';
import { RankTable } from './RankTable';
import { StackedBar } from './StackedBar';
import { StatTiles } from './StatTiles';
import { Text } from './Text';
import { Transition } from './Transition';
import { Tree } from './Tree';
import { TicketSignature } from './TicketSignature';
import { TrickVsDocument } from './TrickVsDocument';
import { Waffle } from './Waffle';
import { Waterfall } from './Waterfall';
import { Toolkit } from './Toolkit';

export const COMPONENTS = {
  CourtsEvidence,
  FlagStamps,
  Choices,
  Stamp,
  Steps,
  Scorecard,
  Versus,
  Dumbbell,
  Gauge,
  Funnel,
  Columns,
  Cohort,
  Curve,
  Bar,
  BranchClosing,
  CommissionIcons,
  Composite,
  Courtroom,
  DistrictTiers,
  DotPlot,
  EvidenceCards,
  Excerpt,
  FinePrint,
  PersonGrid,
  ProtestStrip,
  Phone,
  Pyramid,
  Quote,
  RankTable,
  StackedBar,
  StatTiles,
  Text,
  Transition,
  Tree,
  TicketSignature,
  TrickVsDocument,
  Waffle,
  Waterfall,
  Toolkit,
} satisfies Record<string, FC<{ scene: TimelineScene }>>;

/** Scene kind -> component, derived from the kind records. */
export const SCENES = Object.fromEntries(
  Object.entries(ALL_KINDS).map(([kind, spec]) => [kind, COMPONENTS[spec.component]]),
) as Record<SceneKind, FC<{ scene: TimelineScene }>>;
