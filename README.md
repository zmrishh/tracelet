# tracelet

**Lightweight tracing for AI agents.** Wrap your LLM calls and tools, get a structured record of every run — then replay, inspect, evaluate, and snapshot it.

[![npm](https://img.shields.io/npm/v/tracelet?color=crimson)](https://www.npmjs.com/package/tracelet)
[![license](https://img.shields.io/npm/l/tracelet)](./LICENSE)
[![node](https://img.shields.io/node/v/tracelet?color=brightgreen)](https://nodejs.org)
[![zero deps](https://img.shields.io/badge/dependencies-0-blue)](./package.json)

---

## What it does

| | |
|---|---|
| **Record** | Every LLM call and tool execution is captured with inputs, outputs, latency, and timestamps |
| **Inspect** | Print a human-readable trace, or export it as JSON |
| **Replay** | Re-run any recorded trace deterministically — no live API calls |
| **Evaluate** | Score your agent's output against expected keywords |
| **Snapshot** | Freeze a trace and fail fast when your agent's behaviour changes |
| **CLI** | `tracelet view / export / snapshot` — inspect traces from the terminal |

Zero dependencies. ESM-native. Node.js 18+.

---

## Install

```bash
# As a library
npm install tracelet

# As a global CLI tool
npm install -g tracelet
```

---

## Quick start

```typescript
import { trace } from "tracelet";

await trace("answer-question", async (ctx) => {
  const answer = await ctx.llm(
    async () => callYourLLM("What is the capital of France?"),
    "What is the capital of France?"   // ← optional prompt, captured in the trace
  );

  const formatted = await ctx.tool(
    "format-response",
    (input) => `Answer: ${input}`,
    answer
  );

  return formatted;
});
```

After every run, your terminal prints a live summary:

```
TRACE: answer-question  (142ms, 2 steps)

→ LLM                      140ms
  "What is the capital of France?"
  → "Paris"
→ Tool: format-response      2ms

✔ Completed
```

The full trace is appended to `.tracelet/traces.ndjson`.

---

## API reference

### `trace(name, fn)`

The main entry point. Wraps your agent logic and records everything inside it.

```typescript
import { trace } from "tracelet";

const result = await trace("my-agent", async (ctx) => {
  // use ctx.llm() and ctx.tool() here
  return "done";
});
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Label for this run |
| `fn` | `async (ctx) => T` | Your agent logic |

Returns the value your function returns. If your function throws, the error step is recorded and the error is re-thrown.

---

### `ctx.llm(fn, prompt?)`

Wraps an async LLM call. Captures latency, output, and optionally the prompt text.

```typescript
const reply = await ctx.llm(
  async () => openai.chat.completions.create({ ... }),
  "Summarise this document in 3 sentences"   // prompt shown in CLI + stored in trace
);
```

| Parameter | Type | Description |
|---|---|---|
| `fn` | `() => Promise<T>` | Your LLM call |
| `prompt` | `string` *(optional)* | The prompt text — stored as `prompt` on the step |

---

### `ctx.tool(name, fn, input)`

Wraps a named tool execution. Captures the tool name, input, output, and latency.

```typescript
const data = await ctx.tool(
  "fetch-weather",
  async (city) => getWeather(city),
  "London"
);
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `string` | Tool identifier shown in the trace |
| `fn` | `(input) => T \| Promise<T>` | Tool implementation |
| `input` | `TInput` | The value passed to `fn` |

---

### `replay(traceId, options?)`

Re-runs a recorded trace deterministically. Returns stored step outputs without making live API calls.

```typescript
import { replay } from "tracelet";

const result = await replay("a3f2c1d4-...", {
  mode: "mock",      // return stored outputs (default)
  verbose: true      // print each step as it replays, including prompt/response
});

console.log(result.results);
// [
//   { stepIndex: 0, type: "llm", output: "Paris" },
//   { stepIndex: 1, type: "tool", name: "format-response", output: "Answer: Paris" }
// ]
```

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `"mock" \| "full"` | `"mock"` | `mock` returns stored outputs |
| `verbose` | `boolean` | `false` | Print step-by-step output with prompt/response |

---

### `evaluate({ input, expected, actual })`

A pure, dependency-free keyword scorer. No embeddings, no LLM calls.

```typescript
import { evaluate } from "tracelet";

const result = evaluate({
  input: "What is the capital of France?",
  expected: ["paris", "france", "capital"],
  actual: "The capital of France is Paris.",
});

// { score: 1, passed: true, matched: ["paris", "france", "capital"], missing: [] }
```

Scoring rules:
- `score = matched / total expected` (0.0 – 1.0)
- `passed = score >= 0.6`
- Matching is **case-insensitive**

---

### `view(traceId)`

Prints a numbered, human-readable trace to the terminal.

```typescript
import { view } from "tracelet";

await view("a3f2c1d4-...");
```

```
TRACE: answer-question  (2 steps)

 1. LLM       0ms
    prompt:  "What is the capital of France?"
    result:  "Paris"
 2. Tool: format-response   1ms
```

---

### `exportTrace(traceId)`

Returns the full trace as a pretty-printed JSON string. Does not print anything — pipe it wherever you need.

```typescript
import { exportTrace } from "tracelet";

const json = await exportTrace("a3f2c1d4-...");
await fs.writeFile("trace.json", json);
```

---

### `expectTrace(name).toMatchSnapshot()`

Snapshot testing for agent behaviour. Finds the most recent trace with the given name and compares it to a saved snapshot.

```typescript
import { expectTrace } from "tracelet";

// In your test suite — after running your agent:
await expectTrace("answer-question").toMatchSnapshot();
```

**First run** — creates `.tracelet/__snapshots__/answer-question.json`

**Subsequent runs** — compares against the saved snapshot. Throws on mismatch:
```
[tracelet] Snapshot mismatch at line 14
  snapshot: "output": "Paris"
  received: "output": "Lyon"
Delete .tracelet/__snapshots__/answer-question.json to update the snapshot.
```

Delete the snapshot file to accept new behaviour as the baseline.

---

## CLI

```bash
npm install -g tracelet
```

### Commands

```bash
# Print a human-readable trace
tracelet view <traceId>

# Output full trace JSON (pipe-friendly)
tracelet export <traceId>
tracelet export <traceId> > trace.json

# Create or verify a snapshot
tracelet snapshot <traceName>

# Help
tracelet --help
```

### Example output

```
$ tracelet view a3f2c1d4-...

TRACE: answer-question  (2 steps)

 1. LLM       140ms
    prompt:  "What is the capital of France?"
    result:  "Paris"
 2. Tool: format-response   2ms
```

### If `tracelet` is not recognised on Windows

npm installs global bin shims into a folder that may not be on your `PATH`.

1. Find your npm global prefix:
   ```powershell
   npm config get prefix
   ```
2. Add the returned path to your user `PATH` (System Properties → Environment Variables → Path → New).
3. Restart your terminal.

> On macOS / Linux the global bin is usually `/usr/local/bin`. If not, add `$(npm config get prefix)/bin` to your shell's `$PATH`.

---

## Storage format

Every trace is appended as one JSON line to:

```
.tracelet/traces.ndjson
```

The directory is created automatically. Each line is a self-contained JSON object — safe to append concurrently and trivial to stream.

```json
{
  "id": "a3f2c1d4-51aa-4908-9c0d-abc123",
  "name": "answer-question",
  "startTime": 1714286400000,
  "endTime": 1714286400142,
  "steps": [
    {
      "type": "llm",
      "input": "What is the capital of France?",
      "output": "Paris",
      "latency": 140,
      "timestamp": 1714286400001,
      "prompt": "What is the capital of France?",
      "response": "Paris"
    },
    {
      "type": "tool",
      "name": "format-response",
      "input": "Paris",
      "output": "Answer: Paris",
      "latency": 2,
      "timestamp": 1714286400141
    }
  ]
}
```

Add `.tracelet/` to your `.gitignore`.

---

## Error handling

When a step throws, tracelet records an `"error"` step — with the tool name and input preserved — then re-throws the original error so your code still handles it.

```typescript
try {
  await trace("risky-pipeline", async (ctx) => {
    await ctx.tool("parse-json", JSON.parse, "{ bad json");
  });
} catch (err) {
  // err is the original SyntaxError
  // trace was saved with type: "error" step intact
}
```

Terminal output:

```
TRACE: risky-pipeline  (1ms, 1 step)

→ ERROR   0ms
  step:    tool parse-json
  input:   "{ bad json"
  message: "Unexpected token 'b', "{ bad json" is not valid JSON"

✖ Failed
```

---

## TypeScript types

```typescript
import type {
  TraceRecord,    // complete recorded trace
  Step,           // single step: llm | tool | error
  StepType,       // "llm" | "tool" | "error"
  TraceContext,   // ctx passed to your trace function
  ReplayOptions,  // options for replay()
  ReplayResult,   // return value of replay()
  EvaluateResult  // return value of evaluate()
} from "tracelet";
```

---

## Requirements

- **Node.js** 18 or later
- **ESM** — add `"type": "module"` to your `package.json`, or use `.mjs` files

---

## License

MIT © [zmrishh](https://github.com/zmrishh)
