export type StepType = "llm" | "tool" | "error";

export interface Step {
  type: StepType;
  input: unknown;
  output: unknown;
  name?: string;
  latency: number;
  timestamp: number;
}

export interface TraceRecord {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  steps: Step[];
}

export interface TraceContext {
  llm<T>(fn: () => Promise<T>): Promise<T>;
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
