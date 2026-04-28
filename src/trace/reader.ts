/**
 * Shared NDJSON reader for trace files.
 *
 * This is the single source of truth for parsing .tracelet/traces.ndjson.
 * All modules that need to read traces (replay, view, export, snapshot) import
 * from here so parsing logic is never duplicated.
 */

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { TraceRecord } from "../types/index.js";

export const TRACES_FILE = join(".tracelet", "traces.ndjson");

export function isTraceRecord(value: unknown): value is TraceRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "string" &&
    Array.isArray((value as Record<string, unknown>).steps)
  );
}

/**
 * Streams the NDJSON file line-by-line and returns the first trace whose `id`
 * matches. Returns `null` when the file does not exist or no match is found.
 * Malformed lines are silently skipped.
 */
export async function findTrace(traceId: string): Promise<TraceRecord | null> {
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
        continue;
      }

      if (isTraceRecord(parsed) && parsed.id === traceId) {
        return parsed;
      }
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  } finally {
    stream.destroy();
  }

  return null;
}

/**
 * Returns the most recently appended trace whose `name` matches the given
 * string. "Most recent" means last in the file, so we must read the whole
 * file and keep updating the candidate as we go.
 */
export async function findLatestByName(name: string): Promise<TraceRecord | null> {
  const stream = createReadStream(TRACES_FILE, { encoding: "utf-8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let latest: TraceRecord | null = null;

  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed === "") continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (isTraceRecord(parsed) && parsed.name === name) {
        latest = parsed;
      }
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  } finally {
    stream.destroy();
  }

  return latest;
}
