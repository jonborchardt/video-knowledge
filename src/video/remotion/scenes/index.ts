// Scene kind -> component. Closed: the kinds come from src/video/kinds.ts (which also names each kind's file for the
// render cache), so an unsupported scene never reaches here.
import type { FC } from 'react';
import type { SceneKind } from '../../kinds';
import type { TimelineScene } from '../../types';
import { Bar } from './Bar';
import { CommissionIcons } from './CommissionIcons';
import { Composite } from './Composite';
import { DotPlot } from './DotPlot';
import { EvidenceCards } from './EvidenceCards';
import { Excerpt } from './Excerpt';
import { FinePrint } from './FinePrint';
import { PersonGrid } from './PersonGrid';
import { Phone } from './Phone';
import { Pyramid } from './Pyramid';
import { Quote } from './Quote';
import { RankTable } from './RankTable';
import { StackedBar } from './StackedBar';
import { StatTiles } from './StatTiles';
import { Text } from './Text';
import { Transition } from './Transition';
import { Tree } from './Tree';
import { Waffle } from './Waffle';
import { Waterfall } from './Waterfall';

export const SCENES: Record<SceneKind, FC<{ scene: TimelineScene }>> = {
  phone: Phone,
  'phone-reply': Phone,
  'phone-end': Phone,
  tree: Tree,
  'tree-coins': Tree,
  'tree-customer': Tree,
  'tree-base': Tree,
  quote: Quote,
  title: Text,
  question: Text,
  list: Text,
  pair: Text,
  'evidence-cards': EvidenceCards,
  transition: Transition,
  disclosures: Excerpt,
  excerpt: Excerpt,
  'stat-tiles': StatTiles,
  'fine-print': FinePrint,
  'person-grid': PersonGrid,
  waterfall: Waterfall,
  'rank-table': RankTable,
  'dot-plot': DotPlot,
  bar: Bar,
  'commission-icons': CommissionIcons,
  waffle: Waffle,
  pyramid: Pyramid,
  'three-measures': Composite,
  'base-rate': StackedBar,
  closing: Composite,
  'stacked-bar': StackedBar,
};
