/**
 * Whether `examples`, an element's marks, marks any of its texts as holding an example (#1228,
 * WN-3): the canvas outlines it, and its bar has an *Example* chip.
 */
export const hasExamples = (examples: unknown): boolean =>
  typeof examples === "object" && examples !== null && Object.keys(examples).length > 0;
