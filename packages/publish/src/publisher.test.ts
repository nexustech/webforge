import { describe, expect, it } from "vitest";
import { PublishError, throwIfCancelled } from "./publisher.js";

describe("PublishError", () => {
  it("carries a code and its cause", () => {
    const cause = new Error("socket hang up");
    const error = new PublishError("network", "Netlify could not be reached", { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("PublishError");
    expect(error.code).toBe("network");
    expect(error.cause).toBe(cause);
  });
});

describe("throwIfCancelled", () => {
  it("throws a cancelled error once the signal is aborted", () => {
    const controller = new AbortController();
    expect(() => throwIfCancelled(controller.signal)).not.toThrow();
    expect(() => throwIfCancelled(undefined)).not.toThrow();

    controller.abort();

    expect(() => throwIfCancelled(controller.signal)).toThrow(
      expect.objectContaining({ code: "cancelled" }),
    );
  });
});
