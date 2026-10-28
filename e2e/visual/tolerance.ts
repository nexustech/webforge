/**
 * How far a screenshot may differ from the committed one (#281), for every visual project.
 * - `threshold`: how different one pixel's colour must be to count, on Playwright's 0–1 scale. The
 *   editor's dark surfaces differ by a few RGB steps (`--panel` #2f3438 against `--background`
 *   #2c3134), so a pane gone or added with its background must count, not only its text.
 * - `maxDiffPixels`: how many such pixels may differ, whatever the story's size: a few, for
 *   anti-aliasing, never a line of text. A share of the pixels let a whole-window story hide a
 *   missing panel's few hundred pixels of text.
 */
export const SCREENSHOT_TOLERANCE = { threshold: 0.05, maxDiffPixels: 25 } as const;
