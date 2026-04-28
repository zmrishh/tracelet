const PASS_THRESHOLD = 0.6;

export interface EvaluateInput {
  input: string;
  expected: string[];
  actual: string;
}

export interface EvaluateResult {
  score: number;
  passed: boolean;
  matched: string[];
  missing: string[];
}

export function evaluate({ expected, actual }: EvaluateInput): EvaluateResult {
  if (expected.length === 0) {
    return { score: 1, passed: true, matched: [], missing: [] };
  }

  const normalizedActual = actual.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const keyword of expected) {
    if (normalizedActual.includes(keyword.toLowerCase())) {
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const score = matched.length / expected.length;

  return { score, passed: score >= PASS_THRESHOLD, matched, missing };
}
