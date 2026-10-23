import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryCommand } from "../canvas-engine.js";
import { deferredCommands } from "./deferred-commands.js";

describe("deferredCommands (#146)", () => {
  let ran: HistoryCommand[];
  let pending: boolean;
  let settled: boolean;
  const setup = () =>
    deferredCommands(
      (command) => {
        ran.push(command);
        return true;
      },
      () => {
        const had = pending;
        pending = false;
        return had;
      },
      () => settled,
      500,
    );
  const microtasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

  beforeEach(() => {
    vi.useFakeTimers();
    ran = [];
    pending = false;
    settled = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a command at once when no rich text is waiting to be sent", () => {
    const commands = setup();

    expect(commands.run("undo")).toBe(true);

    expect(ran).toEqual(["undo"]);
  });

  it("holds Undo back until the pending keystrokes' edit is recorded", async () => {
    const commands = setup();
    pending = true;

    expect(commands.run("undo")).toBe(true);
    expect(ran).toEqual([]);
    commands.edited();
    await microtasks();

    expect(ran).toEqual(["undo"]);
  });

  it("runs Undo and Redo pressed meanwhile after it, in order", async () => {
    const commands = setup();
    pending = true;

    commands.run("undo");
    commands.run("undo");
    commands.run("redo");
    expect(ran).toEqual([]);
    commands.edited();
    await microtasks();

    expect(ran).toEqual(["undo", "undo", "redo"]);
  });

  it("waits on while an earlier batch of keystrokes arrives before the last one", async () => {
    const commands = setup();
    pending = true;
    commands.run("undo");

    // The batch Puck had already let go arrives first: the last keystrokes are still on their way.
    settled = false;
    commands.edited();
    await microtasks();
    expect(ran).toEqual([]);
    // Then the last keystrokes: the text is all there, and the Undo takes it all back.
    settled = true;
    commands.edited();
    await microtasks();

    expect(ran).toEqual(["undo"]);
  });

  it("runs an action (Alt+Enter's split) after the pending keystrokes too, in order with Undo", async () => {
    const commands = setup();
    const split = vi.fn(() => ran.push("redo"));
    pending = true;

    commands.whenSent(split);
    commands.run("undo");
    expect(split).not.toHaveBeenCalled();
    commands.edited();
    await microtasks();

    expect(ran).toEqual(["redo", "undo"]);
    // With nothing pending, it runs at once.
    commands.whenSent(split);
    expect(split).toHaveBeenCalledTimes(2);
  });

  it("never holds Esc back", () => {
    const commands = setup();
    pending = true;

    commands.run("undo");
    commands.run("cancel");

    expect(ran).toEqual(["cancel"]);
  });

  it("runs what it holds back after the timeout if no edit comes", () => {
    const commands = setup();
    pending = true;
    commands.run("undo");

    vi.advanceTimersByTime(499);
    expect(ran).toEqual([]);
    vi.advanceTimersByTime(1);

    expect(ran).toEqual(["undo"]);
  });

  it("runs after the timeout too when the text never seems to arrive", async () => {
    const commands = setup();
    pending = true;
    settled = false;
    commands.run("undo");
    commands.edited();
    await microtasks();

    vi.advanceTimersByTime(500);

    expect(ran).toEqual(["undo"]);
  });

  it("drops what it holds back when disposed", async () => {
    const commands = setup();
    pending = true;
    commands.run("undo");

    commands.dispose();
    commands.edited();
    await microtasks();
    vi.advanceTimersByTime(1000);

    expect(ran).toEqual([]);
  });
});
