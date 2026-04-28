import type { StepType } from "../types/index.js";
import { findTrace } from "../trace/reader.js";

export interface StepReplayResult {
  stepIndex: number;
  type: StepType;
  name?: string;
  output: unknown;
}

export interface ReplayResult {
  traceId: string;
  results: StepReplayResult[];
}

export interface ReplayOptions {
  mode?: "mock" | "full";
  /**
   * When true, prints each replayed step to stdout — useful for inspecting
   * prompt/response debug fields captured with v0.2+.
   */
  verbose?: boolean;
}

export async function replay(
  traceId: string,
  options: ReplayOptions = {}
): Promise<ReplayResult> {
  const mode    = options.mode    ?? "mock";
  const verbose = options.verbose ?? false;

  const record = await findTrace(traceId);
  if (record === null) {
    throw new Error(`[tracelet] Trace not found: "${traceId}"`);
  }

  if (verbose) {
    console.log(`\n[tracelet replay] "${record.name}" — ${record.steps.length} step(s)`);
  }

  const results: StepReplayResult[] = [];

  for (let i = 0; i < record.steps.length; i++) {
    const step = record.steps[i];

    // V1: both "mock" and "full" return stored output deterministically.
    // "full" mode is intentionally scaffolded here for real execution in a
    // future phase without requiring a signature change.
    void mode;

    const result: StepReplayResult = {
      stepIndex: i,
      type: step.type,
      ...(step.name !== undefined && { name: step.name }),
      output: step.output,
    };

    if (verbose) {
      const label = step.type === "tool" ? `tool:${step.name ?? "?"}` : step.type;
      console.log(`  [${i}] ${label}  ${step.latency ?? 0}ms`);
      if (step.prompt)   console.log(`        prompt   → ${truncateVerbose(step.prompt)}`);
      if (step.response) console.log(`        response → ${truncateVerbose(step.response)}`);
    }

    results.push(result);
  }

  if (verbose) console.log("");

  return { traceId, results };
}

const VERBOSE_MAX = 120;
function truncateVerbose(str: string): string {
  return str.length <= VERBOSE_MAX ? str : str.slice(0, VERBOSE_MAX - 1) + "…";
}
