import { configure } from "@testing-library/react";
import { vi } from "vitest";
import { WAIT_MS } from "../../vitest.load.js";

// Waits as long as `WAIT_MS` by default (ADR 0014 §4, #1052): Testing Library's, and `vi.waitFor`,
// whose one second Vitest has no setting for. A wait given its own timeout keeps it.
configure({ asyncUtilTimeout: WAIT_MS });
const waitFor = vi.waitFor;
vi.waitFor = ((callback, options) =>
  waitFor(
    callback,
    typeof options === "number" ? options : { timeout: WAIT_MS, ...options },
  )) as typeof vi.waitFor;
