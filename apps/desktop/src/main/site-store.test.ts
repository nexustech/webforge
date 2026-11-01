import { ReadOnlyProjectError } from "@webforge/storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { storeFailure } from "./site-store.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("storeFailure (A13)", () => {
  it("says a site from a newer Webforge is read-only, without logging it", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(storeFailure(new ReadOnlyProjectError(), "Webforge could not save the site")).toEqual({
      status: "failed",
      reason: "read-only",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("logs anything else by its code only", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const full = Object.assign(new Error("SQLITE_FULL: C:\\Sites\\Bakery.wforge"), {
      code: "SQLITE_FULL",
    });

    expect(storeFailure(full, "Webforge could not save the site")).toEqual({
      status: "failed",
      reason: "unknown",
    });
    expect(error).toHaveBeenCalledWith("Webforge could not save the site (code=Error SQLITE_FULL)");
  });
});
