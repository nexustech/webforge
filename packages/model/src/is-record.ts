/** Whether `value` is a plain object to read fields from: not `null`, and not an array (#988). */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
