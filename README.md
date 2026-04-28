# tracelet

> Minimal tracing library for AI agent execution — record, replay, and evaluate every step your agent takes.

[![npm version](https://img.shields.io/npm/v/tracelet)](https://www.npmjs.com/package/tracelet)
[![license](https://img.shields.io/npm/l/tracelet)](./LICENSE)
[![node](https://img.shields.io/node/v/tracelet)](https://nodejs.org)

---

## Why tracelet?

When you build AI agents, things go wrong in non-obvious ways. An LLM returns an unexpected format. A tool silently produces the wrong value. A pipeline regresses after a prompt change.

**tracelet** gives you three things:

| | |
|---|---|
| 🔍 **Trace** | Wrap your LLM calls and tool executions. Every run is recorded with inputs, outputs, and latency. |
| 🔁 **Replay** | Re-run any recorded trace deterministically. No live API calls needed. |
| 🧪 **Evaluate** | Score your agent's output against expected keywords. Know immediately if quality regressed. |

Zero dependencies. ESM-native. Runs on Node.js 18+.

---

## Installation

```bash
npm install tracelet
```

---

## Quick start

```typescript
import { trace } from "tracelet";

await trace("answer-question", async (ctx) => {
  // Wrap your LLM call
  const answer = await ctx.llm(async () => {
    return callYourLLM("What is the capital of France?");
  });

  // Wrap any tool your agent uses
  const formatted = await ctx.tool(
    "format-response",
    (input) => `Answer: ${input.text}`,
    { text: answer }
  );
});
```

After this runs, your terminal shows:

```
TRACE: answer-question  (142ms, 2 steps)

→ LLM                    140ms
→ Tool: format-response    2ms

✔ Completed
```

And the full trace is saved to `.tracelet/traces.ndjson`.

---

## Core concepts

### Trace

A **trace** wraps a named agent run. It captures every LLM call and tool invocation inside it, with timing and output.

```typescript
import { trace } from "tracelet";

const result = await trace("my-pipeline", async (ctx) => {
  // use ctx.llm() and ctx.tool() inside here
  return "final result";
});
```

| Argument | Type | Description |
|---|---|---|
| `name` | `string` | A human-readable label for this run |
| `fn` | `async (ctx) => T` | Your agent logic. Receives a trace context. |

Returns the value your function returns. If your function throws, the error step is recorded and the error is re-thrown.

---

### ctx.llm()

Wraps an async LLM call. Captures latency and output.

```typescript
const reply = await ctx.llm(async () => {
  return openai.chat.completions.create({ ... });
});
```

---

### ctx.tool()

Wraps a named tool execution. Captures the tool name, input, output, and latency.

```typescript
const result = await ctx.tool(
  "search-web",           // tool name
  async (q) => fetchResults(q),  // tool function
  "latest AI news"        // input passed to the function
);
```

---

### Replay

Replay a previously recorded trace by its ID. Returns the stored output for every step — no live API calls are made.

```typescript
import { replay } from "tracelet";

const result = await replay("a3f2c1d4-...", { mode: "mock" });

console.log(result.results);
// [
//   { stepIndex: 0, type: "llm", output: "Paris" },
//   { stepIndex: 1, type: "tool", name: "format-response", output: "Answer: Paris" }
// ]
```

| Option | Values | Default | Description |
|---|---|---|---|
| `mode` | `"mock"` \| `"full"` | `"mock"` | `mock` returns stored outputs. `full` is scaffolded for real re-execution in a future release. |

---

### Evaluate

A pure, dependency-free keyword scorer. Give it what you expected the agent to say, and what it actually said.

```typescript
import { evaluate } from "tracelet";

const result = evaluate({
  input: "What is the capital of France?",  // context (metadata only)
  expected: ["paris", "france", "capital"], // keywords that should appear
  actual: "The capital of France is Paris.", // agent's actual output
});

// {
//   score: 1,
//   passed: true,
//   matched: ["paris", "france", "capital"],
//   missing: []
// }
```

Scoring rules:

- `score = matched keywords / total expected keywords`
- `passed = score >= 0.6`
- Matching is **case-insensitive**

| Field | Type | Description |
|---|---|---|
| `score` | `number` | `0.0` – `1.0` |
| `passed` | `boolean` | `true` if score ≥ 0.6 |
| `matched` | `string[]` | Keywords found in output |
| `missing` | `string[]` | Keywords not found in output |

---

## Trace storage

Every trace is appended as a single JSON line to:

```
.tracelet/traces.ndjson
```

The directory is created automatically. Each line is an independent, self-contained JSON object — safe to append concurrently, easy to stream, and trivial to parse.

**Example line (formatted for readability):**

```json
{
  "id": "a3f2c1d4-51aa-4908-9c0d-abc123",
  "name": "answer-question",
  "startTime": 1714286400000,
  "endTime": 1714286400142,
  "steps": [
    {
      "type": "llm",
      "input": null,
      "output": "Paris",
      "latency": 140,
      "timestamp": 1714286400001
    },
    {
      "type": "tool",
      "name": "format-response",
      "input": { "text": "Paris" },
      "output": "Answer: Paris",
      "latency": 2,
      "timestamp": 1714286400141
    }
  ]
}
```

Add `.tracelet/` to your `.gitignore` to keep trace data out of version control.

---

## Error handling

If a step throws, tracelet records the failure as an `"error"` step — with the tool name and input preserved — then re-throws the original error so your code still sees it.

```typescript
try {
  await trace("risky-pipeline", async (ctx) => {
    await ctx.tool("parse-json", JSON.parse, "{ bad json");
  });
} catch (err) {
  // err is the original SyntaxError
  // the trace was still saved with an error step
}
```

CLI output for a failed run:

```
TRACE: risky-pipeline  (1ms, 1 step)

→ ERROR   0ms

✖ Failed
```

---

## TypeScript types

All types are exported for use in your own code:

```typescript
import type {
  TraceRecord,   // a complete recorded trace
  Step,          // a single step (llm | tool | error)
  StepType,      // "llm" | "tool" | "error"
  TraceContext,  // the ctx object passed to your trace function
  ReplayResult,  // return value of replay()
  EvaluateResult // return value of evaluate()
} from "tracelet";
```

---

## Requirements

- **Node.js** 18 or later
- **ESM** — add `"type": "module"` to your `package.json`, or use `.mjs` files

---

## License

MIT
