// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpApi, McpStatus } from "../../shared/ipc/mcp.js";
import { AiAppsDialog, STATUS_EVERY_MS } from "./AiAppsDialog.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CLAUDE = {
  id: "0b0c8f4e-2a6d-4c1e-9e10-3f6b1b2c4d5e",
  name: "Claude",
  claimed: true,
  connected: false,
};
const KEY = "k".repeat(43);
const ADDRESS = "http://127.0.0.1:51234/mcp";

/** Main's side of AI apps, changing as asked; each call a spy. */
function fakeMcp(start: Partial<McpStatus> = {}) {
  let status: McpStatus = {
    enabled: true,
    address: ADDRESS,
    moved: false,
    apps: [CLAUDE],
    ...start,
  };
  const mcp = {
    status: vi.fn(async () => status),
    setEnabled: vi.fn(async (enabled: boolean) => {
      status = { ...status, enabled, address: enabled ? ADDRESS : null };
      return status;
    }),
    add: vi.fn<McpApi["add"]>(async (name) => {
      const app = {
        id: "1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5",
        name,
        claimed: false,
        connected: false,
      };
      status = { ...status, apps: [...status.apps, app] };
      return { status: "paired", app, key: KEY, address: ADDRESS };
    }),
    installClaude: vi.fn<McpApi["installClaude"]>(async () => ({ status: "opened" })),
    remove: vi.fn(async (id: string) => {
      status = { ...status, apps: status.apps.filter((app) => app.id !== id) };
      return status;
    }),
  } satisfies McpApi;
  return {
    mcp,
    connect: (id: string) => {
      status = {
        ...status,
        apps: status.apps.map((app) => (app.id === id ? { ...app, connected: true } : app)),
      };
    },
  };
}

function setUp(start: Partial<McpStatus> = {}) {
  const fake = fakeMcp(start);
  const copyText = vi.fn(async () => null);
  const copySecret = vi.fn(async () => null);
  const notify = vi.fn();
  render(
    <AiAppsDialog
      open
      mcp={fake.mcp}
      copyText={copyText}
      copySecret={copySecret}
      notify={notify}
      onClose={() => undefined}
    />,
  );
  const dialog = () => within(screen.getByRole("dialog", { name: "AI apps" }));
  return { ...fake, copyText, copySecret, notify, dialog, user: userEvent.setup({ delay: null }) };
}

describe("AI apps (4.9)", () => {
  it("lists each paired app with whether it's connected, and shows it connecting live", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { dialog, connect } = setUp();
    await waitFor(() => expect(dialog().getByText("Claude")).toBeTruthy());
    expect(dialog().getByText("Not connected")).toBeTruthy();

    connect(CLAUDE.id);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STATUS_EVERY_MS);
    });

    expect(dialog().getByText("Connected")).toBeTruthy();
  });

  it("adds Claude Desktop, with its key once to copy and its extension to install", async () => {
    const { dialog, mcp, copySecret, user } = setUp();
    await user.click(await dialog().findByRole("button", { name: "Add AI app" }));
    // Claude Desktop first, named so already.
    expect(
      dialog().getByRole("radio", { name: "Claude Desktop" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(dialog().getByRole("textbox", { name: "Name" })).toHaveProperty(
      "value",
      "Claude Desktop",
    );
    await user.click(dialog().getByRole("button", { name: "Add" }));

    expect(mcp.add).toHaveBeenCalledWith("Claude Desktop");
    expect(await dialog().findByText(KEY)).toBeTruthy();
    // The extension holds the address: none to copy.
    expect(dialog().queryByText(ADDRESS)).toBeNull();
    expect(dialog().getByText(/paste the key into Key/)).toBeTruthy();
    await user.click(dialog().getByRole("button", { name: "Copy the key" }));
    expect(copySecret).toHaveBeenCalledWith(KEY);
    await user.click(dialog().getByRole("button", { name: "Install in Claude Desktop" }));
    expect(mcp.installClaude).toHaveBeenCalledWith("1c2d3e4f-5a6b-4c7d-8e9f-a0b1c2d3e4f5");
    await waitFor(() =>
      expect(
        dialog()
          .getAllByRole("status")
          .some((status) =>
            /Claude Desktop is opening the extension/.test(status.textContent ?? ""),
          ),
      ).toBe(true),
    );

    mcp.installClaude.mockResolvedValueOnce({ status: "shown" });
    await user.click(dialog().getByRole("button", { name: "Install in Claude Desktop" }));
    expect(await dialog().findByText(/Nothing opened the extension/)).toBeTruthy();

    // Its key waited too long, and it went: adding it again is what helps, not trying again.
    mcp.installClaude.mockResolvedValueOnce({ status: "unknown" });
    await user.click(dialog().getByRole("button", { name: "Install in Claude Desktop" }));
    expect(
      await dialog().findByText(
        "Claude Desktop's key wasn't used within 5 minutes, so Claude Desktop was removed. Add it again, then install its new extension.",
      ),
    ).toBeTruthy();
  });

  it("adds another app, showing its key once to copy, with the address to give it", async () => {
    const { dialog, mcp, copyText, copySecret, user } = setUp();
    await user.click(await dialog().findByRole("button", { name: "Add AI app" }));
    expect(
      dialog().getByText("The app will read and change the sites you open in Webforge."),
    ).toBeTruthy();
    await user.click(dialog().getByRole("radio", { name: "Another app" }));
    expect(dialog().getByRole("textbox", { name: "Name" })).toHaveProperty("value", "");
    await user.type(dialog().getByRole("textbox", { name: "Name" }), "Cursor");
    await user.click(dialog().getByRole("button", { name: "Add" }));

    expect(mcp.add).toHaveBeenCalledWith("Cursor");
    expect(await dialog().findByText(KEY)).toBeTruthy();
    expect(dialog().getByText(ADDRESS)).toBeTruthy();
    expect(dialog().getByText(/You won't see it again/)).toBeTruthy();
    // It can't check who answers at the address: the dialog says so.
    expect(dialog().getByText(/another program on this computer could answer/)).toBeTruthy();
    expect(dialog().queryByRole("button", { name: "Install in Claude Desktop" })).toBeNull();
    await user.click(dialog().getByRole("button", { name: "Copy the key" }));
    // The key as a secret, out of clipboard history and cleared in a minute; never as plain text.
    expect(copySecret).toHaveBeenCalledWith(KEY);
    expect(copyText).not.toHaveBeenCalled();
    expect(dialog().getByRole("button", { name: "Copied" })).toBeTruthy();
    expect(dialog().getByRole("status").textContent).toMatch(/cleared from the clipboard/);
    await user.click(dialog().getByRole("button", { name: "Copy the address" }));
    expect(copyText).toHaveBeenCalledWith(ADDRESS);

    // Done: the key is gone, for good.
    await user.click(dialog().getByRole("button", { name: "Done" }));
    expect(dialog().queryByText(KEY)).toBeNull();
    expect(dialog().getByText("Waiting for its key")).toBeTruthy();
  });

  it("says why an app wasn't added, and adds nothing while AI apps is off", async () => {
    const { dialog, mcp, user } = setUp();
    mcp.add.mockResolvedValueOnce({ status: "name-taken" });
    await user.click(await dialog().findByRole("button", { name: "Add AI app" }));
    await user.clear(dialog().getByRole("textbox", { name: "Name" }));
    await user.type(dialog().getByRole("textbox", { name: "Name" }), "Claude");
    await user.click(dialog().getByRole("button", { name: "Add" }));
    expect(
      await dialog().findByText("Another AI app has that name. Give this one another."),
    ).toBeTruthy();

    cleanup();
    const off = setUp({ enabled: false, address: null });
    const add = await off.dialog().findByRole("button", { name: "Add AI app" });
    expect((add as HTMLButtonElement).disabled).toBe(true);
  });

  it("turns AI apps on and off at once", async () => {
    const { dialog, mcp, user } = setUp({ enabled: false, address: null });
    await user.click(await dialog().findByRole("checkbox", { name: "Let AI apps connect" }));

    expect(mcp.setEnabled).toHaveBeenCalledWith(true);
    await waitFor(() =>
      expect(
        (dialog().getByRole("button", { name: "Add AI app" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it("removes an app after asking, cutting it off", async () => {
    const { dialog, mcp, user } = setUp();
    await user.click(await dialog().findByRole("button", { name: "Remove Claude" }));
    const question = within(await screen.findByRole("alertdialog", { name: "Remove Claude?" }));
    await user.click(question.getByRole("button", { name: "Remove" }));

    expect(mcp.remove).toHaveBeenCalledWith(CLAUDE.id);
    expect(await dialog().findByText("No AI apps yet.")).toBeTruthy();
  });

  it("says when the address has moved and the apps must be added again", async () => {
    const { dialog } = setUp({ moved: true });
    expect(await dialog().findByText(/address for AI apps has changed/)).toBeTruthy();
  });
});
