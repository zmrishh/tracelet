import type { TraceLogger } from "../types/index.js";
import { startTimer } from "../utils/timer.js";

export async function wrapTool<TInput, TOutput>(
  tracer: TraceLogger,
  name: string,
  fn: (input: TInput) => TOutput | Promise<TOutput>,
  input: TInput
): Promise<TOutput> {
  const timer = startTimer();

  try {
    const output = await fn(input);
    tracer.log({
      type: "tool",
      name,
      input,
      output,
      latency: timer.getLatency(),
      timestamp: timer.timestamp,
    });
    return output;
  } catch (err) {
    tracer.log({
      type: "error",
      name,
      input,
      output: err instanceof Error ? err.message : String(err),
      latency: timer.getLatency(),
      timestamp: timer.timestamp,
    });
    throw err;
  }
}
