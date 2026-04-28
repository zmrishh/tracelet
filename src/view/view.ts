import type { Step } from "../types/index.js";
import { findTrace } from "../trace/reader.js";

const ANSI = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  cyan:  "\x1b[36m",
  red:   "\x1b[31m",
};

const TRUNCATE_MAX = 80;

function truncate(str: string): string {
  return str.length <= TRUNCATE_MAX ? str : str.slice(0, TRUNCATE_MAX - 1) + "…";
}

function stepLabel(step: Step, index: number): string {
  const num = String(index + 1).padStart(2, " ");

  if (step.type === "tool") {
    return `${num}. Tool: ${step.name ?? "unknown"}`;
  }
  if (step.type === "llm") {
    return `${num}. LLM`;
  }
  return `${num}. ERROR`;
}

function stepColor(step: Step): string {
  return step.type === "error" ? ANSI.red : ANSI.cyan;
}

function printStep(step: Step, index: number): void {
  const color   = stepColor(step);
  const label   = stepLabel(step, index);
  const latency = `${step.latency ?? 0}ms`;

  console.log(`${color}${label}${ANSI.reset}    ${ANSI.dim}${latency}${ANSI.reset}`);

  if (step.type === "llm") {
    if (step.prompt) {
      console.log(`   ${ANSI.dim}prompt:  "${truncate(step.prompt)}"${ANSI.reset}`);
    }
    if (step.response) {
      console.log(`   ${ANSI.dim}result:  "${truncate(step.response)}"${ANSI.reset}`);
    }
  }

  if (step.type === "error" && typeof step.output === "string" && step.output.length > 0) {
    console.log(`   ${ANSI.dim}message: "${truncate(step.output)}"${ANSI.reset}`);
  }
}

/**
 * Prints a human-readable trace summary to the terminal.
 * Throws if the trace cannot be found.
 */
export async function view(traceId: string): Promise<void> {
  const record = await findTrace(traceId);
  if (record === null) {
    throw new Error(`[tracelet] Trace not found: "${traceId}"`);
  }

  const stepWord = record.steps.length === 1 ? "step" : "steps";

  console.log(
    `\n${ANSI.bold}TRACE: ${record.name}${ANSI.reset} ` +
    `${ANSI.dim}(${record.steps.length} ${stepWord})${ANSI.reset}\n`
  );

  if (record.steps.length === 0) {
    console.log(`  ${ANSI.dim}(no steps recorded)${ANSI.reset}`);
  } else {
    for (let i = 0; i < record.steps.length; i++) {
      printStep(record.steps[i], i);
    }
  }

  console.log("");
}
