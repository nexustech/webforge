import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStoreGate, type GateKind } from "./store-gate.js";

/** A promise and what settles it, to hold work open as long as a test wants. */
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Lets every queued promise reaction run. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("the store gate", () => {
  it("runs shared work together, and exclusive work alone, once the shared work is done", async () => {
    const gate = createStoreGate();
    const backup = deferred();
    const order: string[] = [];

    const slow = gate.run("shared", async () => {
      order.push("backup starts");
      await backup.promise;
      order.push("backup ends");
    });
    const read = gate.run("shared", () => order.push("read"));
    const write = gate.run("exclusive", () => order.push("write"));
    await settled();

    expect(order).toEqual(["backup starts", "read"]);
    backup.resolve();
    await Promise.all([slow, read, write]);
    expect(order).toEqual(["backup starts", "read", "backup ends", "write"]);
  });

  it("lands commits asked for during an import after it, in the order they were asked", async () => {
    const gate = createStoreGate();
    const importing = deferred();
    const saved: string[] = [];

    const write = gate.run("exclusive", async () => {
      await importing.promise;
      saved.push("import");
    });
    const commits = ["first", "second", "third"].map((name) =>
      gate.run("shared", () => saved.push(name)),
    );
    await settled();

    expect(saved).toEqual([]);
    importing.resolve();
    await Promise.all([write, ...commits]);
    expect(saved).toEqual(["import", "first", "second", "third"]);
  });

  it("keeps shared work asked for after a waiting writer behind it, so the writer isn't starved", async () => {
    const gate = createStoreGate();
    const reading = deferred();
    const order: string[] = [];

    const read = gate.run("shared", () => reading.promise.then(() => order.push("read")));
    const write = gate.run("exclusive", () => order.push("write"));
    const later = gate.run("shared", () => order.push("later read"));
    reading.resolve();
    await Promise.all([read, write, later]);

    expect(order).toEqual(["read", "write", "later read"]);
  });

  it("gives work's result, and lets the next in when work fails", async () => {
    const gate = createStoreGate();

    await expect(gate.run("shared", () => 42)).resolves.toBe(42);
    await expect(
      gate.run("exclusive", () => {
        throw new Error("disk full");
      }),
    ).rejects.toThrow("disk full");
    await expect(gate.run("exclusive", () => "next")).resolves.toBe("next");
    expect(gate.held()).toBe(false);
  });

  it("is held while work runs, and only then", async () => {
    const gate = createStoreGate();
    let during = false;

    await gate.run("shared", () => {
      during = gate.held();
    });

    expect(during).toBe(true);
    expect(gate.held()).toBe(false);
  });

  it("runs work that can wait no longer once its time is up, and what waits behind it after it", async () => {
    vi.useFakeTimers();
    const gate = createStoreGate();
    const stuck = deferred();
    const order: string[] = [];

    void gate.run("exclusive", () => stuck.promise);
    const close = gate.run("exclusive", () => order.push("close"), { waitMs: 2_000 });
    const after = gate.run("shared", () => order.push("after"));
    await vi.advanceTimersByTimeAsync(1_999);
    expect(order).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    await close;
    expect(order).toEqual(["close"]);
    stuck.resolve();
    await after;
    expect(order).toEqual(["close", "after"]);
  });

  it("starts work in the order it asked and never runs exclusive work beside other work", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            kind: fc.constantFrom<GateKind>("shared", "exclusive"),
            turns: fc.integer({ min: 0, max: 3 }),
          }),
          { minLength: 1, maxLength: 12 },
        ),
        async (works) => {
          const gate = createStoreGate();
          const started: number[] = [];
          let running = 0;
          let exclusiveRunning = false;
          let clash = false;

          await Promise.all(
            works.map(({ kind, turns }, index) =>
              gate.run(kind, async () => {
                started.push(index);
                if (exclusiveRunning || (kind === "exclusive" && running > 0)) clash = true;
                running += 1;
                if (kind === "exclusive") exclusiveRunning = true;
                // Held for a few turns of the microtask queue: work of varied lengths, with no
                // clock in it, so a busy machine can't slow the test (ADR 0014, #446).
                for (let turn = 0; turn < turns; turn += 1) await Promise.resolve();
                running -= 1;
                if (kind === "exclusive") exclusiveRunning = false;
              }),
            ),
          );

          expect(clash).toBe(false);
          expect(started).toEqual(works.map((_, index) => index));
        },
      ),
      { numRuns: 60 },
    );
  });
});
