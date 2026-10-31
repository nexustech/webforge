import { describe, expect, it, vi } from "vitest";
import { createSiteSwitch } from "./site-switch.js";

function setUp(
  path: string | undefined,
  capture: () => Promise<Uint8Array | undefined>,
  captureTimeoutMs?: number,
) {
  const order: string[] = [];
  const requestFlush = vi.fn(async () => {
    order.push("flush");
  });
  const saveThumbnail = vi.fn(async () => {
    order.push("thumbnail");
  });
  const siteSwitch = createSiteSwitch({
    currentPath: () => path,
    requestFlush,
    capture,
    recent: { saveThumbnail },
    ...(captureTimeoutMs === undefined ? {} : { captureTimeoutMs }),
  });
  return { siteSwitch, requestFlush, saveThumbnail, order };
}

describe("createSiteSwitch", () => {
  it("saves the open site, then stores its canvas as the Recent thumbnail", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8]);
    const { siteSwitch, saveThumbnail, order } = setUp("/sites/a.wforge", async () => jpeg);

    await siteSwitch.leaveSite();

    expect(order).toEqual(["flush", "thumbnail"]);
    expect(saveThumbnail).toHaveBeenCalledWith("/sites/a.wforge", jpeg);
  });

  it("does nothing without an open site", async () => {
    const capture = vi.fn(async () => new Uint8Array());
    const { siteSwitch, requestFlush } = setUp(undefined, capture);

    await siteSwitch.leaveSite();

    expect(requestFlush).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it("goes on without a thumbnail when there is none or capturing fails", async () => {
    const none = setUp("/sites/a.wforge", async () => undefined);
    await none.siteSwitch.leaveSite();
    expect(none.saveThumbnail).not.toHaveBeenCalled();

    const failing = setUp("/sites/a.wforge", async () => {
      throw new Error("window gone");
    });
    await expect(failing.siteSwitch.leaveSite()).resolves.toBeUndefined();
  });

  it("goes on without a thumbnail when a hung renderer never answers the capture (#121)", async () => {
    const hung = setUp("/sites/a.wforge", () => new Promise(() => undefined), 10);

    await expect(hung.siteSwitch.leaveSite()).resolves.toBeUndefined();
    expect(hung.saveThumbnail).not.toHaveBeenCalled();
  });
});
