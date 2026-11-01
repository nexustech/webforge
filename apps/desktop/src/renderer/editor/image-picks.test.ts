import { describe, expect, it, vi } from "vitest";
import { createImagePickRequests } from "./image-picks.js";

describe("createImagePickRequests (F-ED-25)", () => {
  it("hands a request to the selected element's field once, telling the fields as it comes", () => {
    const picks = createImagePickRequests();
    const listener = vi.fn();
    const stop = picks.subscribe(listener);

    picks.request("a");

    expect(listener).toHaveBeenCalledOnce();
    expect(picks.take(null)).toBe(false);
    expect(picks.take("b")).toBe(false);
    expect(picks.take("a")).toBe(true);
    expect(picks.take("a")).toBe(false);
    stop();
    picks.request("a");
    expect(listener).toHaveBeenCalledOnce();
  });

  it("keeps only the latest request", () => {
    const picks = createImagePickRequests();

    picks.request("a");
    picks.request("b");

    expect(picks.take("a")).toBe(false);
    expect(picks.take("b")).toBe(true);
  });
});
