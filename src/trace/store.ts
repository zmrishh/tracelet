import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { TraceRecord } from "../types/index.js";

const TRACES_DIR = ".tracelet";
const TRACES_FILE = join(TRACES_DIR, "traces.ndjson");

export async function saveTrace(trace: TraceRecord): Promise<void> {
  await mkdir(TRACES_DIR, { recursive: true });
  await appendFile(TRACES_FILE, JSON.stringify(trace) + "\n", "utf-8");
}
