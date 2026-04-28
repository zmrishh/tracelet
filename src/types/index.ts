export type StepType = "llm" | "tool" | "error";

export interface Step {
  type: StepType;
  input: unknown;
  output: unknown;
  name?: string;
  latency: number;
  timestamp: number;
  // v0.2 — optional debug fields; absent on traces recorded before v0.2
  prompt?: string;    // LLM step: the prompt text passed to the model
  response?: string;  // LLM step: string representation of the model output
}

export interface TraceRecord {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  steps: Step[];
}

export interface TraceContext {
  /** Wrap an async LLM call. Pass `prompt` to capture the input text in the trace. */
  llm<T>(fn: () => Promise<T>, prompt?: string): Promise<T>;
  tool<TInput, TOutput>(
    name: string,
    fn: (input: TInput) => TOutput | Promise<TOutput>,
    input: TInput
  ): Promise<TOutput>;
}

export type TraceFn<T> = (ctx: TraceContext) => Promise<T>;

export interface TraceLogger {
  log(step: Step): void;
}
