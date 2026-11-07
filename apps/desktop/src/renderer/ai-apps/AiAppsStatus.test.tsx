// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpStatus } from "../../shared/ipc/mcp.js";
import { AiAppsStatus, INDICATOR_EVERY_MS } from "./AiAppsStatus.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const app = (name: string, connected: boolean) => ({
  id: crypto.randomUUID(),
  name,
  claimed: true,
  connected,
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
});
