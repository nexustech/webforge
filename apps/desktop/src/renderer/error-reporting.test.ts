import { describe, expect, it, vi } from "vitest";
import type { ErrorDetails, RendererErrorKind } from "../shared/error-details.js";
import { createErrorReporter, installErrorReporting, rootErrorOptions } from "./error-reporting.js";

/** An error whose message quotes the site, as a render bug's might. */
const siteError = () => new TypeError("Can't read \"Rosa's Bakery\" from C:Users\rosaSites");

function reporter() {
  const sent: [RendererErrorKind, ErrorDetails][] = [];
  const report = createErrorReporter(async (kind, error) => {
    sent.push([kind, error]);
    return null;
  });
  return { sent, report };
}

describe("renderer error reporting (R3)", () => {
  it("reports an uncaught error and an unhandled rejection, without their messages", () => {
    const { sent, report } = reporter();
    const target = new EventTarget();
    const stop = installErrorReporting(target as unknown as Window, report);

    target.dispatchEvent(Object.assign(new Event("error"), { error: siteError() }));
    target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: siteError() }));
    stop();
    target.dispatchEvent(Object.assign(new Event("error"), { error: siteError() }));

    expect(sent.map(([kind, error]) => [kind, error.name])).toEqual([
      ["uncaught-error", "TypeError"],
      ["unhandled-rejection", "TypeError"],
    ]);
    // The main process removes the frames' paths before it writes a report (crash-reports.ts).
    expect(JSON.stringify(sent)).not.toMatch(/Rosa|Sites/);
  });

  it("reports what React's error boundaries caught, and what they didn't", () => {
    const { sent, report } = reporter();
    const log = vi.fn();
    const options = rootErrorOptions(report, log);

    options.onCaughtError?.(siteError(), { componentStack: "" });
    options.onUncaughtError?.("Rosa", { componentStack: "" });

    expect(sent.map(([kind, error]) => [kind, error.name])).toEqual([
      ["render-error", "TypeError"],
      ["uncaught-error", "string"],
    ]);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("drops a report that can't be sent instead of failing again", async () => {
    const report = createErrorReporter(async () => {
      throw new Error("no main process");
    });
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    report("uncaught-error", siteError());
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
