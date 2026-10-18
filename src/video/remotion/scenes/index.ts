// Scene kind -> component. Closed: the kinds come from src/video/kinds.ts, so an unsupported scene never reaches here.
import type { FC } from 'react';
import type { SceneKind } from '../../kinds';
import type { TimelineScene } from '../../types';
import { Phone } from './Phone';
import { Quote } from './Quote';
import { StackedBar } from './StackedBar';
import { Tree } from './Tree';

export const SCENES: Record<SceneKind, FC<{ scene: TimelineScene }>> = {
  phone: Phone,
  tree: Tree,
  quote: Quote,
  'stacked-bar': StackedBar,
};
