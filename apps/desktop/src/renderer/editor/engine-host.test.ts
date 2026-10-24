import { createFakeEngine } from "@webforge/test-utils/renderer";
import { describe, expect, it, vi } from "vitest";
import type { EngineConnection } from "./editor-session.js";
import { createEngineHost } from "./engine-host.js";

const mounted = () => {
  const connection: EngineConnection = { flush: vi.fn(), disconnect: vi.fn() };
  return { engine: createFakeEngine(), connection };
};

describe("createEngineHost (2.20, B1)", () => {
  it("connects what waits to each engine as it mounts, and undoes it as it unmounts", () => {
    const host = createEngineHost();
    const order: string[] = [];
    host.whileMounted(() => {
      order.push("connect a");
      return () => order.push("disconnect a");
    });
    host.whileMounted(() => {
      order.push("connect b");
      return () => order.push("disconnect b");
    });

    const detach = host.attach(mounted());
    detach();

    expect(order).toEqual(["connect a", "connect b", "disconnect b", "disconnect a"]);
  });

  it("connects at once while an engine is mounted, and stops when asked", () => {
    const host = createEngineHost();
    const first = mounted();
    host.attach(first);
    const disconnect = vi.fn();
    const connect = vi.fn(() => disconnect);

    const stop = host.whileMounted(connect);
    stop();

    expect(connect).toHaveBeenCalledWith(first);
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("has no engine once it unmounts, while what was connected stops", () => {
    const host = createEngineHost();
    const seen: unknown[] = [];
    host.whileMounted(() => () => seen.push(host.current()));
    const engine = mounted();

    const detach = host.attach(engine);
    expect(host.current()).toBe(engine);
    detach();

    expect(seen).toEqual([null]);
    expect(host.current()).toBeNull();
  });

  it("flushes the mounted engine's connection, and nothing without one", () => {
    const host = createEngineHost();
    host.flush();
    const engine = mounted();
    host.attach(engine);

    host.flush();

    expect(engine.connection.flush).toHaveBeenCalledOnce();
  });

  it("detaches an engine still attached when another attaches, and ignores its late detach", () => {
    const host = createEngineHost();
    const disconnect = vi.fn();
    host.whileMounted(() => disconnect);
    const detachFirst = host.attach(mounted());
    const second = mounted();

    host.attach(second);
    expect(disconnect).toHaveBeenCalledOnce();
    detachFirst();

    expect(disconnect).toHaveBeenCalledOnce();
    expect(host.current()).toBe(second);
  });
});
