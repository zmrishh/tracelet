#!/usr/bin/env node
/**
 * tracelet CLI
 *
 * Usage:
 *   tracelet view     <traceId>
 *   tracelet export   <traceId>
 *   tracelet snapshot <traceName>
 */

import { view } from "./view/view.js";
import { exportTrace } from "./export/export.js";
import { expectTrace } from "./testing/snapshot.js";

const ANSI = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  red:    "\x1b[31m",
  yellow: "\x1b[33m",
  dim:    "\x1b[2m",
};

const COMMANDS = ["view", "export", "snapshot"] as const;
type Command = (typeof COMMANDS)[number];

function isCommand(s: string): s is Command {
  return (COMMANDS as readonly string[]).includes(s);
}

function printUsage(): void {
  console.log(`
${ANSI.bold}tracelet${ANSI.reset} — AI agent trace inspector

${ANSI.bold}Usage:${ANSI.reset}
  tracelet view     <traceId>    Print a human-readable trace summary
  tracelet export   <traceId>    Output trace as formatted JSON
  tracelet snapshot <traceName>  Create or verify a trace snapshot

${ANSI.bold}Examples:${ANSI.reset}
  tracelet view     abc123
  tracelet export   abc123 > trace.json
  tracelet snapshot my-agent
`);
}

function ok(message: string): void {
  console.log(`${ANSI.green}✔${ANSI.reset} ${message}`);
}

function err(message: string): void {
  console.error(`${ANSI.red}✖${ANSI.reset} ${message}`);
}

function extractTraceletMessage(error: unknown): string {
  if (error instanceof Error) {
    // Strip the "[tracelet] " prefix for cleaner CLI output — we add our own
    // ✖ indicator so the prefix is redundant.
    return error.message.replace(/^\[tracelet\]\s*/m, "").trimStart();
  }
  return String(error);
}

async function runView(traceId: string): Promise<void> {
  await view(traceId);
  // view() already prints the formatted trace body; no extra ✔ needed here
  // because the formatted output is the success signal itself.
}

async function runExport(traceId: string): Promise<void> {
  const json = await exportTrace(traceId);
  // Use process.stdout.write so the output is pipe-friendly (no extra newline).
  process.stdout.write(json + "\n");
}

async function runSnapshot(traceName: string): Promise<void> {
  // expectTrace().toMatchSnapshot() prints its own status lines; we intercept
  // errors and re-print them cleanly, but let the success messages through.
  await expectTrace(traceName).toMatchSnapshot();
}

async function main(): Promise<void> {
  const [command, argument] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  if (!isCommand(command)) {
    err(`Unknown command: "${command}"`);
    printUsage();
    process.exit(1);
  }

  if (!argument) {
    err(
      command === "snapshot"
        ? `Missing <traceName>. Usage: tracelet snapshot <traceName>`
        : `Missing <traceId>. Usage: tracelet ${command} <traceId>`
    );
    process.exit(1);
  }

  try {
    switch (command) {
      case "view":
        await runView(argument);
        break;

      case "export":
        await runExport(argument);
        ok(`Exported trace ${ANSI.dim}${argument}${ANSI.reset}`);
        break;

      case "snapshot":
        await runSnapshot(argument);
        break;
    }
  } catch (error) {
    err(extractTraceletMessage(error));
    process.exit(1);
  }
}

main();
