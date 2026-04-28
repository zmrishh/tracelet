import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { TraceRecord, StepType } from "../types/index.js";

const TRACES_FILE = join(".tracelet", "traces.ndjson");

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
}

function isTraceRecord(value: unknown): value is TraceRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "string" &&
    Array.isArray((value as Record<string, unknown>).steps)
  );
}

async function findTrace(traceId: string): Promise<TraceRecord | null> {
  const stream = createReadStream(TRACES_FILE, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed === "") continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue; // skip malformed lines, do not abort the search
      }

      if (isTraceRecord(parsed) && parsed.id === traceId) {
        return parsed;
      }
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  } finally {
    // rl.close() alone does not close the underlying ReadStream — destroy it
    // explicitly to avoid leaking the file handle on early exit.
    stream.destroy();
  }

  return null;
}

export async function replay(
  traceId: string,
  options: ReplayOptions = {}
): Promise<ReplayResult> {
  const mode = options.mode ?? "mock";

  const record = await findTrace(traceId);
  if (record === null) {
    throw new Error(`[tracelet] Trace not found: "${traceId}"`);
  }

  const results: StepReplayResult[] = [];

  for (let i = 0; i < record.steps.length; i++) {
    const step = record.steps[i];

    // V1: both "mock" and "full" return stored output deterministically.
    // "full" mode is intentionally scaffolded here for real execution in a
    // future phase without requiring a signature change.
    void mode;

    results.push({
      stepIndex: i,
      type: step.type,
      ...(step.name !== undefined && { name: step.name }),
      output: step.output,
    });
  }

  return { traceId, results };
}
