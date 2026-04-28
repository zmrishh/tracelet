import type { TraceLogger } from "../types/index.js";
import { startTimer } from "../utils/timer.js";

export async function wrapLlm<T>(
  tracer: TraceLogger,
  fn: () => Promise<T>
): Promise<T> {
  const timer = startTimer();

  try {
    const output = await fn();
    tracer.log({
      type: "llm",
      input: null,
      output,
      latency: timer.getLatency(),
      timestamp: timer.timestamp,
    });
    return output;
  } catch (err) {
    tracer.log({
      type: "error",
      name: "llm",
      input: null,
      output: err instanceof Error ? err.message : String(err),
      latency: timer.getLatency(),
      timestamp: timer.timestamp,
    });
    throw err;
  }
}
