import { describe, expect, it, vi } from "vitest";
import { createCall } from "./call.js";
import { helpApi, helpWindowApi } from "./help.js";

describe("the help APIs (5.4b)", () => {
  it("opens Help from the editor, and a web page from the Help window, each on its channel", async () => {
    const invoke = vi.fn(async () => true);
    const call = createCall(invoke);
    expect(await helpApi(call).open({ page: "export", anchor: "options" })).toBe(true);
    expect(await helpWindowApi(call, vi.fn()).openExternal("https://www.example.org/")).toBe(true);
    expect(invoke.mock.calls).toEqual([
      ["help:open", { page: "export", anchor: "options" }],
      ["help:open-external", "https://www.example.org/"],
    ]);
  });

  it("passes on only the pages and looks main sends as they should be", () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const stop = vi.fn();
    const api = helpWindowApi(
      createCall(vi.fn()),
      vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
        listeners.set(channel, listener);
        return stop;
      }),
    );
    const shown = vi.fn();
    const themed = vi.fn();
    expect(api.onShow(shown)).toBe(stop);
    api.onTheme(themed);

    listeners.get("help:show")?.({ page: "site-check", anchor: "tips" });
    listeners.get("help:show")?.({ page: "../../secrets" });
    listeners.get("help:theme")?.("light");
    listeners.get("help:theme")?.("purple");

    expect(shown.mock.calls).toEqual([[{ page: "site-check", anchor: "tips" }]]);
    expect(themed.mock.calls).toEqual([["light"]]);
  });
});
