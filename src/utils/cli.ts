import type { TraceRecord, Step } from "../types/index.js";

const ANSI = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  cyan:  "\x1b[36m",
};

function stepLabel(step: Step): string {
  if (step.type === "tool") return `Tool: ${step.name ?? "unknown"}`;
  if (step.type === "llm")  return "LLM";
  return "ERROR";
}

/** Left-pads a string to achieve right-alignment within a fixed column. */
function padLeft(str: string, width: number): string {
  return str.length >= width ? str : " ".repeat(width - str.length) + str;
}

/** Right-pads a string to left-align within a fixed column. */
function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + " ".repeat(width - str.length);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function totalDuration(trace: TraceRecord): number {
  if (trace.endTime > trace.startTime) {
    return trace.endTime - trace.startTime;
  }
  // Fallback: sum step latencies when timestamps are unreliable
  return trace.steps.reduce((sum, s) => sum + (s.latency ?? 0), 0);
}

export function printTraceSummary(trace: TraceRecord): void {
  try {
    const duration   = totalDuration(trace);
    const name       = trace.name || "trace";
    const stepCount  = trace.steps.length;
    const hasFailed  = trace.steps.some((s) => s.type === "error");
    const stepWord   = stepCount === 1 ? "step" : "steps";

    const labels      = trace.steps.map(stepLabel);
    const maxLabelLen = labels.reduce((max, l) => Math.max(max, l.length), 3);
    const labelCol    = maxLabelLen + 3; // 3-space gap after longest label

    const latencyStrs  = trace.steps.map((s) => `${s.latency ?? 0}ms`);
    const maxLatencyLen = latencyStrs.reduce((max, s) => Math.max(max, s.length), 2);

    console.log(
      `\n${ANSI.bold}TRACE: ${name}${ANSI.reset} ` +
      `${ANSI.dim}(${formatDuration(duration)}, ${stepCount} ${stepWord})${ANSI.reset}`
    );

    if (stepCount > 0) {
      console.log("");
      for (let i = 0; i < stepCount; i++) {
        const step    = trace.steps[i];
        const label   = labels[i];
        const latency = latencyStrs[i];
        const color   = step.type === "error" ? ANSI.red : ANSI.cyan;

        console.log(
          `${color}→${ANSI.reset} ` +
          `${padRight(label, labelCol)}` +
          `${ANSI.dim}${padLeft(latency, maxLatencyLen)}${ANSI.reset}`
        );
      }
    }

    console.log("");
    if (hasFailed) {
      console.log(`${ANSI.red}✖ Failed${ANSI.reset}\n`);
    } else {
      console.log(`${ANSI.green}✔ Completed${ANSI.reset}\n`);
    }
  } catch {
    // CLI layer must never interrupt execution
  }
}
