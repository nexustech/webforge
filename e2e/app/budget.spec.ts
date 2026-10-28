import { expect, test } from "@playwright/test";
import { expectMedianWithin } from "./budget.js";

// The median of a spec's openings (#569): Windows' backstop catches a hang only (#561), so the
// median catches a wait added to every opening, while one stalled opening doesn't move it.

/** Six openings as a Windows runner's usual job made them (#561). */
const USUAL = [1237, 1351, 1288, 1460, 1108, 1575];

test("fails when every opening waits a few seconds more (#569)", () => {
  const waited = USUAL.map((wallMs) => wallMs + 5_000);
  expect(() => expectMedianWithin(waited, 6_000, "Opening")).toThrow(/median took \d+ ms/);
});

test("passes one opening that stalled, as Windows' runners do (#561)", () => {
  const stalled = [21_547, ...USUAL.slice(1)];
  expect(() => expectMedianWithin(stalled, 6_000, "Opening")).not.toThrow();
});
