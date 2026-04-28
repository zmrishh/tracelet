import { generateId } from "../utils/uuid.js";
import { saveTrace } from "./store.js";
import { wrapLlm } from "../interceptors/llm.js";
import { wrapTool } from "../interceptors/tool.js";
import { printTraceSummary } from "../utils/cli.js";
import type { Step, StepType, TraceRecord, TraceContext, TraceFn, TraceLogger } from "../types/index.js";

const VALID_STEP_TYPES = new Set<StepType>(["llm", "tool", "error"]);

function validateStep(step: Step): void {
  if (!VALID_STEP_TYPES.has(step.type)) {
    throw new Error(`[tracelet] Invalid step type: "${step.type}"`);
  }
  if (!Number.isFinite(step.latency) || step.latency < 0) {
    throw new Error(`[tracelet] Step latency must be a non-negative finite number, got: ${step.latency}`);
  }
  if (!Number.isFinite(step.timestamp) || step.timestamp <= 0) {
    throw new Error(`[tracelet] Step timestamp must be a positive finite number, got: ${step.timestamp}`);
  }
}

class Trace implements TraceLogger {
  readonly id: string;
  readonly name: string;
  readonly startTime: number;
  private endTime: number = 0;
  private readonly steps: Step[] = [];

  constructor(name: string) {
    this.id = generateId();
    this.name = name;
    this.startTime = Date.now();
  }

  log(step: Step): void {
    validateStep(step);
    this.steps.push(step);
  }

  end(): TraceRecord {
    this.endTime = Date.now();
    return {
      id: this.id,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      steps: [...this.steps],
    };
  }
}

export async function trace<T>(name: string, fn: TraceFn<T>): Promise<T> {
  const t = new Trace(name);

  const ctx: TraceContext = {
    llm: (fn) => wrapLlm(t, fn),
    tool: (toolName, fn, input) => wrapTool(t, toolName, fn, input),
  };

  try {
    const result = await fn(ctx);
    const record = t.end();
    await saveTrace(record);
    printTraceSummary(record);
    return result;
  } catch (err) {
    // Interceptors have already logged their own error steps with full context.
    // Here we only ensure the trace is persisted. saveTrace failure must never
    // suppress the original error.
    const record = t.end();
    await saveTrace(record).catch((saveErr: unknown) => {
      console.error("[tracelet] Failed to persist trace:", saveErr);
    });
    printTraceSummary(record); // always runs before re-throw
    throw err;
  }
}
