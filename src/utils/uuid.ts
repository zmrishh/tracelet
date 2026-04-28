/**
 * Generates a RFC 4122 v4 UUID using Node's built-in crypto module.
 * Available without imports in Node 18+ (globalThis.crypto).
 */
export function generateId(): string {
  return crypto.randomUUID();
}
