import { findTrace } from "../trace/reader.js";

/**
 * Reads the trace with the given ID and returns it as a pretty-printed JSON
 * string. Throws if the trace does not exist.
 *
 * Intentionally prints nothing — callers decide what to do with the string
 * (write to file, send over a network, display in a UI, etc.).
 */
export async function exportTrace(traceId: string): Promise<string> {
  const record = await findTrace(traceId);
  if (record === null) {
    throw new Error(`[tracelet] Trace not found: "${traceId}"`);
  }
  return JSON.stringify(record, null, 2);
}
