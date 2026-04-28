import type { TraceRecord, Step } from "../types/index.js";

const ANSI = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  green: "\x1b[32m",
  red:   "\x1b[31m",
  cyan:  "\x1b[36m",
};

const PREVIEW_MAX = 80;

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

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + "…";
}

/**
 * Returns zero or more preview lines to print below a step's main row.
 * LLM steps: show prompt → response.
 * Error steps: show step context + message.
 */
function stepPreviewLines(step: Step): string[] {
  const lines: string[] = [];

  if (step.type === "llm") {
    if (step.prompt) {
      lines.push(`  ${ANSI.dim}"${truncate(step.prompt, PREVIEW_MAX)}"${ANSI.reset}`);
    }
    if (step.response) {
      lines.push(`  ${ANSI.dim}→ "${truncate(step.response, PREVIEW_MAX)}"${ANSI.reset}`);
    }
  }

  if (step.type === "error") {
    if (step.name) {
      const kind = step.name === "llm" ? "LLM" : `Tool ${step.name}`;
      lines.push(`  ${ANSI.dim}step: ${kind}${ANSI.reset}`);
    }
    if (step.input !== null && step.input !== undefined) {
      const raw = typeof step.input === "string"
        ? step.input
        : JSON.stringify(step.input);
      lines.push(`  ${ANSI.dim}input: ${truncate(raw, PREVIEW_MAX)}${ANSI.reset}`);
    }
    if (typeof step.output === "string" && step.output.length > 0) {
      lines.push(`  ${ANSI.dim}message: "${truncate(step.output, PREVIEW_MAX)}"${ANSI.reset}`);
    }
  }

  return lines;
}

export function printTraceSummary(trace: TraceRecord): void {
  try {
    const duration   = totalDuration(trace);
    const name       = trace.name || "trace";
    const stepCount  = trace.steps.length;
    const hasFailed  = trace.steps.some((s) => s.type === "error");
    const stepWord   = stepCount === 1 ? "step" : "steps";

    const labels        = trace.steps.map(stepLabel);
    const maxLabelLen   = labels.reduce((max, l) => Math.max(max, l.length), 3);
    const labelCol      = maxLabelLen + 3;

    const latencyStrs   = trace.steps.map((s) => `${s.latency ?? 0}ms`);
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

        for (const line of stepPreviewLines(step)) {
          console.log(line);
        }
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
