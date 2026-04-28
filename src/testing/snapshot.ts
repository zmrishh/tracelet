import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { findLatestByName } from "../trace/reader.js";

const SNAPSHOTS_DIR = join(".tracelet", "__snapshots__");

function snapshotPath(name: string): string {
  // Sanitise name so it is safe to use as a filename on all platforms.
  const safe = name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return join(SNAPSHOTS_DIR, `${safe}.json`);
}

/**
 * Serialises a trace deterministically for snapshot comparison.
 * Sorts step array by index to guard against hypothetical re-ordering bugs.
 */
function serialise(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function loadSnapshot(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function saveSnapshot(filePath: string, content: string): Promise<void> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

/**
 * Snapshot testing helper for traces.
 *
 * @example
 * await expectTrace("my-agent").toMatchSnapshot();
 */
export function expectTrace(name: string): { toMatchSnapshot(): Promise<void> } {
  return {
    async toMatchSnapshot(): Promise<void> {
      const record = await findLatestByName(name);
      if (record === null) {
        throw new Error(
          `[tracelet] Snapshot: no trace found with name "${name}". ` +
          `Run the trace at least once before calling toMatchSnapshot().`
        );
      }

      const filePath = snapshotPath(name);
      const current  = serialise(record);
      const existing = await loadSnapshot(filePath);

      if (existing === null) {
        await saveSnapshot(filePath, current);
        // Message is intentionally brief — the CLI wrapper adds ✔ / colour.
        console.log(`[tracelet] Snapshot created: ${name}.json`);
        return;
      }

      if (existing === current) {
        // Emit a machine-readable marker so the CLI can print ✔ Snapshot matched.
        console.log("[tracelet] Snapshot matched");
        return;
      }

      // Build a minimal mismatch report without a diff library.
      const existingLines = existing.split("\n");
      const currentLines  = current.split("\n");
      const firstDiff     = existingLines.findIndex((l, i) => l !== currentLines[i]);

      throw new Error(
        `[tracelet] Snapshot mismatch at line ${firstDiff + 1}\n` +
        `  snapshot: ${existingLines[firstDiff] ?? "(missing)"}\n` +
        `  received: ${currentLines[firstDiff] ?? "(missing)"}\n` +
        `Delete ${filePath} to update the snapshot.`
      );
    },
  };
}
