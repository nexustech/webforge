// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpStatus } from "../../shared/ipc/mcp.js";
import { AiAppsDialog } from "./AiAppsDialog.js";
import { AiAppsStatus, INDICATOR_EVERY_MS } from "./AiAppsStatus.js";
import { onAiAppsChanged } from "./ai-apps-changed.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const app = (name: string, connected: boolean, unaskedUntil: number | null = null) => ({
  id: crypto.randomUUID(),
  name,
  claimed: true,
  connected,
  unaskedUntil,
});

describe("the title bar's AI apps status (4.9)", () => {
  it("shows nothing until an app connects, then names it, and opens AI apps", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status: McpStatus = {
      enabled: true,
      address: "http://127.0.0.1:51234/mcp",
      moved: false,
      apps: [app("Claude", false)],
    };
    const onOpen = vi.fn();
    render(<AiAppsStatus mcp={{ status: async () => status }} onOpen={onOpen} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole("button")).toBeNull();

    status = { ...status, apps: [app("Claude", true), app("Cursor", true)] };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INDICATOR_EVERY_MS);
    });

    const button = screen.getByRole("button", {
      name: "Connected AI apps: Claude, Cursor. Open AI apps.",
    });
    await userEvent.setup({ delay: null }).click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("names an app connected in AI apps the moment AI apps closes, not at its next look (#1615)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let status: McpStatus = {
      enabled: true,
      address: "http://127.0.0.1:51234/mcp",
      moved: false,
      apps: [app("Test client", false)],
    };
    const mcp = {
      status: async () => status,
      seenMoved: async () => undefined,
    } as unknown as Parameters<typeof AiAppsDialog>[0]["mcp"];
    const draw = (open: boolean) => (
      <>
        <AiAppsStatus mcp={mcp} onOpen={() => undefined} />
        <AiAppsDialog
          open={open}
          mcp={mcp}
          copyText={async () => undefined}
          copySecret={async () => undefined}
          notify={() => undefined}
          onClose={() => undefined}
        />
      </>
    );
    const view = render(draw(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.queryByRole("button", { name: /^Connected AI apps/ })).toBeNull();

    // The app connects while AI apps is open; then AI apps closes, well before the sign's next look.
    status = { ...status, apps: [app("Test client", true)] };
    view.rerender(draw(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByRole("button", { name: "Connected AI apps: Test client. Open AI apps." }),
    ).toBeDefined();
  });

  it("is told once as AI apps closes, not each time AI apps is drawn again while open (#1615)", async () => {
    const told = vi.fn();
    const stop = onAiAppsChanged(told);
    const mcp = {
      status: async () => undefined,
      seenMoved: async () => undefined,
    } as unknown as Parameters<typeof AiAppsDialog>[0]["mcp"];
    // A new `notify` each time, as the start screen's command gives it.
    const draw = (open: boolean) => (
      <AiAppsDialog
        open={open}
        mcp={mcp}
        copyText={async () => undefined}
        copySecret={async () => undefined}
        notify={() => undefined}
        onClose={() => undefined}
      />
    );
    const view = render(draw(true));
    view.rerender(draw(true));
    view.rerender(draw(true));
    expect(told).not.toHaveBeenCalled();
    view.rerender(draw(false));
    expect(told).toHaveBeenCalledOnce();
    stop();
  });

  it("says an app works without asking, by its icon and to a screen reader, until that ends (5.35)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const start = Date.now();
    // Thirty seconds left, between two of the title bar's looks.
    const status: McpStatus = {
      enabled: true,
      address: "http://127.0.0.1:51234/mcp",
      moved: false,
      apps: [app("Claude", true, start + 30_000)],
    };
    render(<AiAppsStatus mcp={{ status: async () => status }} onOpen={() => undefined} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Working without asking: Claude. Open AI apps.",
    );

    // Main says so no more once it ends; the title bar looks again the moment it does.
    status.apps = [app("Claude", true, null)];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Connected AI apps: Claude. Open AI apps.",
    );
  });

  it("stops saying so at its time even before main is asked again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const start = Date.now();
    const status: McpStatus = {
      enabled: true,
      address: "http://127.0.0.1:51234/mcp",
      moved: false,
      // Main still lists the time it ended at: the title bar compares it with the clock.
      apps: [app("Claude", false, start + 1_000)],
    };
    render(<AiAppsStatus mcp={{ status: async () => status }} onOpen={() => undefined} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("button").getAttribute("aria-label")).toMatch(/without asking/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.queryByRole("button")).toBeNull();
  });
});
