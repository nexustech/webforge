import { describe, expect, it } from "vitest";
import { createMemoryImageCache } from "./memory-image-cache.js";

const bytes = (size: number) => new Uint8Array(size);

describe("createMemoryImageCache (R15)", () => {
  it("gives back what it was given, by key", async () => {
    const cache = createMemoryImageCache(100);
    await cache.set("a", bytes(10));

    expect(await cache.get("a")).toEqual(bytes(10));
    expect(await cache.get("b")).toBeUndefined();
    expect(cache.bytes).toBe(10);
  });

  it("keeps at most its size, dropping what was used longest ago", async () => {
    const cache = createMemoryImageCache(30);
    await cache.set("a", bytes(10));
    await cache.set("b", bytes(10));
    await cache.set("c", bytes(10));
    // Using "a" makes "b" the one used longest ago.
    await cache.get("a");

    await cache.set("d", bytes(10));

    expect(await cache.get("b")).toBeUndefined();
    expect(await cache.get("a")).toBeDefined();
    expect(await cache.get("c")).toBeDefined();
    expect(await cache.get("d")).toBeDefined();
    expect(cache.bytes).toBe(30);
  });

  it("counts a replaced entry once, and keeps nothing larger than itself", async () => {
    const cache = createMemoryImageCache(30);
    await cache.set("a", bytes(10));
    await cache.set("a", bytes(20));
    expect(cache.bytes).toBe(20);

    await cache.set("huge", bytes(31));

    expect(await cache.get("huge")).toBeUndefined();
    expect(await cache.get("a")).toBeDefined();
  });
});
