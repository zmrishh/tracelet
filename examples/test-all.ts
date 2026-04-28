/**
 * Full end-to-end test suite for tracelet.
 * Run with: npx tsx examples/test-all.ts
 */
import { trace, replay, evaluate } from "../src/index.js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Test runner ───────────────────────────────────────────────────────────────

const TRACES_FILE = join(".tracelet", "traces.ndjson");

type TestResult = { name: string; status: "PASS" | "FAIL"; reason?: string };
const results: TestResult[] = [];
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  ${name.padEnd(58, ".")} `);
  try {
    await fn();
    process.stdout.write("PASS\n");
    passed++;
    results.push({ name, status: "PASS" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    process.stdout.write("FAIL\n");
    process.stderr.write(`     └─ ${reason}\n`);
    failed++;
    results.push({ name, status: "FAIL", reason });
  }
}

function readNdjsonTraces(): Array<Record<string, unknown>> {
  if (!existsSync(TRACES_FILE)) return [];
  return readFileSync(TRACES_FILE, "utf-8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

// ── Setup: fresh NDJSON for clean, deterministic results ─────────────────────

mkdirSync(".tracelet", { recursive: true });
writeFileSync(TRACES_FILE, "", "utf-8");

console.log("\n══════════════════════════════════════════════════════════");
console.log("  tracelet — full end-to-end test suite");
console.log("══════════════════════════════════════════════════════════\n");

// ── Section 1: Functional tests ───────────────────────────────────────────────

console.log("── 1. Functional Tests ─────────────────────────────────\n");

await test("T01  Basic trace: LLM + tool steps written correctly", async () => {
  await trace("basic-trace", async (ctx) => {
    const llmOut = await ctx.llm(async () => "hello world");
    assert(llmOut === "hello world", `LLM output: expected "hello world", got "${llmOut}"`);

    const toolOut = await ctx.tool(
      "add",
      (x: { a: number; b: number }) => x.a + x.b,
      { a: 2, b: 3 }
    );
    assert(toolOut === 5, `Tool output: expected 5, got ${toolOut}`);
  });

  const traces = readNdjsonTraces();
  assert(traces.length === 1, `Expected 1 trace, found ${traces.length}`);
  const steps = traces[0].steps as Array<{ type: string }>;
  assert(steps.length === 2, `Expected 2 steps, got ${steps.length}`);
  assert(steps[0].type === "llm", `Step 0 type: expected "llm", got "${steps[0].type}"`);
  assert(steps[1].type === "tool", `Step 1 type: expected "tool", got "${steps[1].type}"`);
});

await test("T02  Empty trace: no steps, no crash", async () => {
  await trace("empty-trace", async (_ctx) => { /* intentionally empty */ });

  const traces = readNdjsonTraces();
  const last = traces[traces.length - 1];
  const steps = last.steps as unknown[];
  assert(steps.length === 0, `Expected 0 steps, got ${steps.length}`);
});

await test("T03  LLM error: error step logged, original error re-thrown", async () => {
  let caughtMessage = "";
  try {
    await trace("llm-error-trace", async (ctx) => {
      await ctx.llm(async () => { throw new Error("llm-failure"); });
    });
  } catch (err) {
    caughtMessage = (err as Error).message;
  }
  assert(caughtMessage === "llm-failure", `Error not re-thrown correctly: "${caughtMessage}"`);

  const traces = readNdjsonTraces();
  const last = traces[traces.length - 1];
  const steps = last.steps as Array<{ type: string }>;
  assert(steps.some((s) => s.type === "error"), "Expected an error step in trace");
});

await test("T04  Tool error: error step logged, original error re-thrown", async () => {
  let caughtMessage = "";
  try {
    await trace("tool-error-trace", async (ctx) => {
      await ctx.tool("bad-tool", (_: unknown) => { throw new Error("tool-failure"); }, {});
    });
  } catch (err) {
    caughtMessage = (err as Error).message;
  }
  assert(caughtMessage === "tool-failure", `Error not re-thrown correctly: "${caughtMessage}"`);

  const traces = readNdjsonTraces();
  const last = traces[traces.length - 1];
  const steps = last.steps as Array<{ type: string; name?: string; input: unknown }>;
  const errStep = steps.find((s) => s.type === "error");
  assert(errStep !== undefined, "Expected an error step in trace");
  assert(errStep!.name === "bad-tool", `Error step should carry tool name, got "${errStep!.name}"`);
});

// ── Section 2: Storage validation ────────────────────────────────────────────

console.log("\n── 2. Storage Validation ───────────────────────────────\n");

await test("T05  NDJSON: 4 traces, each line is valid JSON with id+steps", async () => {
  const traces = readNdjsonTraces();
  assert(traces.length === 4, `Expected 4 traces, found ${traces.length}`);

  for (const [i, t] of traces.entries()) {
    assert(typeof t.id === "string" && (t.id as string).length > 0, `Trace[${i}]: missing id`);
    assert(Array.isArray(t.steps), `Trace[${i}]: steps is not an array`);
    assert(typeof t.startTime === "number", `Trace[${i}]: missing startTime`);
    assert(typeof t.endTime === "number", `Trace[${i}]: missing endTime`);
    assert(typeof t.name === "string", `Trace[${i}]: missing name`);
  }
});

await test("T05b NDJSON: step fields (type, latency, timestamp) are present", async () => {
  const traces = readNdjsonTraces();
  const stepsWithSteps = traces.filter((t) => (t.steps as unknown[]).length > 0);
  assert(stepsWithSteps.length > 0, "Expected at least one trace with steps");

  for (const t of stepsWithSteps) {
    for (const [j, s] of (t.steps as Array<Record<string, unknown>>).entries()) {
      assert(typeof s.type === "string", `Trace step[${j}]: missing type`);
      assert(typeof s.latency === "number", `Trace step[${j}]: latency must be a number`);
      assert(typeof s.timestamp === "number", `Trace step[${j}]: timestamp must be a number`);
    }
  }
});

// ── Section 3: Replay tests ───────────────────────────────────────────────────

console.log("\n── 3. Replay Tests ─────────────────────────────────────\n");

const firstTraceId = (readNdjsonTraces()[0] as { id: string }).id;

await test("T06  Replay (mock): returns correct step count and outputs", async () => {
  const result = await replay(firstTraceId, { mode: "mock" });
  assert(result.traceId === firstTraceId, `traceId mismatch: "${result.traceId}"`);
  assert(result.results.length === 2, `Expected 2 results, got ${result.results.length}`);
  assert(result.results[0].type === "llm", "Step 0 should be llm");
  assert(result.results[0].output === "hello world", `LLM output: "${result.results[0].output}"`);
  assert(result.results[1].type === "tool", "Step 1 should be tool");
  assert(result.results[1].output === 5, `Tool output: expected 5, got ${result.results[1].output}`);
  assert(result.results[1].name === "add", `Tool name: expected "add", got "${result.results[1].name}"`);
});

await test("T07  Replay (default mode = mock): works without options arg", async () => {
  const result = await replay(firstTraceId);
  assert(result.results.length === 2, `Expected 2 results with no options, got ${result.results.length}`);
});

await test("T08  Replay (invalid ID): throws 'Trace not found'", async () => {
  let caughtMessage = "";
  try {
    await replay("nonexistent-id-abc-123");
  } catch (err) {
    caughtMessage = (err as Error).message;
  }
  assert(caughtMessage.includes("Trace not found"), `Expected "Trace not found", got: "${caughtMessage}"`);
});

await test("T09  Replay (corrupted line): bad JSON skipped, valid trace found", async () => {
  const original = readFileSync(TRACES_FILE, "utf-8");

  // Inject a malformed line at the very start to force the skip-logic
  writeFileSync(TRACES_FILE, `{this is: not valid JSON!!!\n${original}`, "utf-8");

  let result;
  try {
    result = await replay(firstTraceId, { mode: "mock" });
  } finally {
    writeFileSync(TRACES_FILE, original, "utf-8"); // always restore
  }

  assert(result!.traceId === firstTraceId, "Should still find trace after corrupted line");
  assert(result!.results.length === 2, "Step count must be intact after skip");
});

await test("T10  Replay (missing NDJSON file): throws 'Trace not found'", async () => {
  // Temporarily rename file to simulate missing store
  const original = readFileSync(TRACES_FILE, "utf-8");
  writeFileSync(TRACES_FILE + ".bak", original, "utf-8");
  // Overwrite with empty to simulate ENOENT-like behaviour via missing trace
  writeFileSync(TRACES_FILE, "", "utf-8");

  let caughtMessage = "";
  try {
    await replay(firstTraceId);
  } catch (err) {
    caughtMessage = (err as Error).message;
  } finally {
    writeFileSync(TRACES_FILE, original, "utf-8");
  }

  assert(caughtMessage.includes("Trace not found"), `Expected "Trace not found", got: "${caughtMessage}"`);
});

// ── Section 4: Evaluation tests ──────────────────────────────────────────────

console.log("\n── 4. Evaluation Tests ─────────────────────────────────\n");

await test("T11  Evaluate: full match — score=1, passed=true", async () => {
  const r = evaluate({ input: "q", expected: ["a", "b"], actual: "a b" });
  assert(r.score === 1, `Expected score 1, got ${r.score}`);
  assert(r.passed === true, "Expected passed=true");
  assert(r.matched.length === 2, `Expected 2 matched, got ${r.matched.length}`);
  assert(r.missing.length === 0, `Expected 0 missing, got ${r.missing.length}`);
});

await test("T12  Evaluate: partial match — score≈0.33, passed=false", async () => {
  const r = evaluate({ input: "q", expected: ["a", "b", "c"], actual: "a" });
  assert(Math.abs(r.score - 1 / 3) < 0.001, `Expected score≈0.33, got ${r.score}`);
  assert(r.passed === false, "Expected passed=false (score < 0.6)");
  assert(r.matched.includes("a"), `"a" should be in matched`);
  assert(r.missing.includes("b") && r.missing.includes("c"), `"b" and "c" should be in missing`);
});

await test("T13  Evaluate: no match — score=0, passed=false", async () => {
  const r = evaluate({ input: "q", expected: ["x", "y", "z"], actual: "abc def" });
  assert(r.score === 0, `Expected score 0, got ${r.score}`);
  assert(r.passed === false, "Expected passed=false");
  assert(r.missing.length === 3, `Expected 3 missing, got ${r.missing.length}`);
});

await test("T14  Evaluate: empty expected — score=1, passed=true", async () => {
  const r = evaluate({ input: "q", expected: [], actual: "anything" });
  assert(r.score === 1, `Expected score 1, got ${r.score}`);
  assert(r.passed === true, "Expected passed=true");
});

await test("T15  Evaluate: case-insensitive matching", async () => {
  const r = evaluate({ input: "q", expected: ["Paris", "FRANCE"], actual: "paris is in france" });
  assert(r.score === 1, `Case-insensitive match failed, score=${r.score}`);
  assert(r.passed === true, "Expected passed=true");
});

await test("T16  Evaluate: partial score at exactly 0.6 — passed=true (boundary)", async () => {
  // 3 of 5 = 0.6 exactly — should pass
  const r = evaluate({
    input: "q",
    expected: ["a", "b", "c", "d", "e"],
    actual: "a b c",
  });
  assert(Math.abs(r.score - 0.6) < 0.001, `Expected score=0.6, got ${r.score}`);
  assert(r.passed === true, "Score exactly at threshold (0.6) should pass");
});

await test("T17  Evaluate: score just below 0.6 — passed=false (boundary)", async () => {
  // 2 of 4 = 0.5 — should fail
  const r = evaluate({
    input: "q",
    expected: ["a", "b", "c", "d"],
    actual: "a b",
  });
  assert(Math.abs(r.score - 0.5) < 0.001, `Expected score=0.5, got ${r.score}`);
  assert(r.passed === false, "Score 0.5 is below threshold and should fail");
});

// ── Final report ──────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════");
console.log("  Results");
console.log("══════════════════════════════════════════════════════════\n");

for (const r of results) {
  const icon = r.status === "PASS" ? "✔" : "✖";
  console.log(`  ${icon}  ${r.name}`);
  if (r.reason) console.log(`      └─ ${r.reason}`);
}

const verdict = failed === 0
  ? "✔  ALL TESTS PASSED — safe to proceed"
  : `✖  ${failed} TEST(S) FAILED — do not publish`;

console.log(`\n  Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);
console.log(`\n  ${verdict}\n`);

if (failed > 0) process.exit(1);
