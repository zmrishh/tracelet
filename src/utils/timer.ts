export interface Timer {
  /** Unix ms timestamp captured at the moment startTimer() was called. */
  readonly timestamp: number;
  /** Returns elapsed milliseconds since startTimer() was called. */
  getLatency(): number;
}

export function startTimer(): Timer {
  const timestamp = Date.now();
  const start = performance.now();
  return {
    timestamp,
    getLatency: () => Math.round(performance.now() - start),
  };
}
