import type { TraceLogger } from "../types/index.js";
import { startTimer } from "../utils/timer.js";

/**
 * Produces a concise string representation of an LLM output value for the
 * `response` debug field. Kept short — this is for display, not serialisation.
 */
function toResponseString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function wrapLlm<T>(
  tracer: TraceLogger,
  fn: () => Promise<T>,
  prompt?: string
): Promise<T> {
  const timer = startTimer();

  try {
    const output = await fn();
    const response = toResponseString(output);

    tracer.log({
      type: "llm",
      input: prompt ?? null,
      output,
      latency: timer.getLatency(),
      timestamp: timer.timestamp,
      ...(prompt !== undefined && { prompt }),
      ...(response !== undefined && { response }),
    });

    return output;
  } catch (err) {
    tracer.log({
      type: "error",
      name: "llm",
      input: prompt ?? null,
      output: err instanceof Error ? err.message : String(err),
      latency: timer.getLatency(),
      timestamp: timer.timestamp,
      ...(prompt !== undefined && { prompt }),
    });
    throw err;
  }
}
