// The closed registry of calculators. A tool is for a decision story and cites every default.
import { heatingCost } from './heating-cost/spec';

export interface ToolSpec {
  id: string;
  topic: string;
  story: string;
  justification: { model: string };
  defaults: Record<string, unknown>;
  assumptions: string[];
  limitations: string[];
  whyDefaults: string;
}

export const TOOLS: Record<string, ToolSpec> = { 'heating-cost': heatingCost };

export const toolOf = (topic: string, storyId: string): ToolSpec | null =>
  Object.values(TOOLS).find((t) => t.topic === topic && t.story === storyId) ?? null;
