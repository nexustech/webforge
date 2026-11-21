// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "../../shared/ipc/prefs.js";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { createPreferencesStore } from "./preferences-store.js";
import { ReportProblem, type ReportProblemProps } from "./ReportProblem.js";

afterEach(cleanup);

const INFO = { version: "0.3.0", system: "Windows 10.0.26300 (x64)", mail: false };

function setUp(draft = "", info = INFO) {
  const api: ReportProblemProps["api"] = {
    getReportInfo: vi.fn(async () => info),
    openReport: vi.fn(async () => "opened" as const),
    captureWindow: vi.fn(async () => ({
      status: "captured" as const,
      preview: "data:image/jpeg;base64,AAAA",
    })),
    saveWindowCapture: vi.fn(async () => "saved" as const),
    discardWindowCapture: vi.fn(async () => null),
  };
  const copyText = vi.fn(async () => null);
  const saved = vi.fn(async () => null);
  const preferences = createPreferencesStore(
    { preferences: { ...DEFAULT_PREFERENCES, reportDraft: draft } },
    { preferences: saved },
  );
  const registry = createCommandRegistry({ mac: false });
  render(
    <CommandRegistryProvider registry={registry}>
      <ReportProblem api={api} copyText={copyText} preferences={preferences} />
    </CommandRegistryProvider>,
  );
  const open = async () => {
    act(() => registry.run(COMMAND_IDS.reportProblem));
    return within(await screen.findByRole("dialog", { name: "Report a Problem" }));
  };
  return { api, copyText, saved, preferences, registry, open, user: userEvent.setup() };
}

describe("Help › Report a Problem (5.23, OL-10)", () => {
  it("is in the Help menu, and shows what's sent with the message before anything leaves", async () => {
    const { registry, open } = setUp();
    expect(registry.get(COMMAND_IDS.reportProblem)).toMatchObject({
      label: "Report a Problem…",
      menu: "help",
    });
    const dialog = await open();
    expect(
      await dialog.findByText(/Sent with it: .* 0\.3\.0 on Windows 10\.0\.26300 \(x64\)/),
    ).toBeDefined();
    // A GitHub issue is public: said before anything is sent.
    expect(dialog.getByText(/A GitHub issue is public/)).toBeDefined();
    // Nothing to send yet; no email until the beta has an address.
    expect(dialog.getByRole("button", { name: "Open a GitHub Issue" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(dialog.queryByRole("button", { name: "Write an Email" })).toBeNull();
  });

  it("keeps the message until it's cleared, opens it as an issue, and copies it", async () => {
    const { api, copyText, preferences, open, user } = setUp("Left from last time");
    const dialog = await open();
    const message = dialog.getByRole("textbox", { name: "What happened?" });
    expect((message as HTMLTextAreaElement).value).toBe("Left from last time");

    await user.clear(message);
    await user.type(message, "The menu froze");
    await user.click(dialog.getByRole("button", { name: "Open a GitHub Issue" }));
    expect(api.openReport).toHaveBeenCalledWith("issue", "The menu froze");
    expect(await dialog.findByText(/The form opened in your browser/)).toBeDefined();
    // Kept as soon as it's sent: it survives a restart until cleared.
    expect(preferences.getState().preferences.reportDraft).toBe("The menu froze");

    await user.click(dialog.getByRole("button", { name: "Copy My Message" }));
    expect(copyText).toHaveBeenCalledWith(expect.stringMatching(/^The menu froze\n\n.*0\.3\.0/));

    await user.click(dialog.getByRole("button", { name: "Clear Message" }));
    expect(preferences.getState().preferences.reportDraft).toBe("");
  });

  it("takes a screenshot only when asked, shows it, saves it, and forgets it on close", async () => {
    const { api, open, user } = setUp("It froze");
    const dialog = await open();
    expect(api.captureWindow).not.toHaveBeenCalled();

    await user.click(dialog.getByRole("button", { name: "Take a Screenshot of This Window" }));
    const shown = await screen.findByRole("img", { name: /screenshot of the/i });
    expect(shown.getAttribute("src")).toBe("data:image/jpeg;base64,AAAA");
    const reopened = within(screen.getByRole("dialog", { name: "Report a Problem" }));
    await user.click(reopened.getByRole("button", { name: "Save Screenshot…" }));
    expect(api.saveWindowCapture).toHaveBeenCalledOnce();
    expect(await reopened.findByText("Screenshot saved.")).toBeDefined();

    await user.keyboard("{Escape}");
    expect(api.discardWindowCapture).toHaveBeenCalled();
  });

  it("says when the message was cut short to fit, and to paste the rest", async () => {
    const { api, open, user } = setUp("A very long message");
    vi.mocked(api.openReport).mockResolvedValueOnce("cut");
    const dialog = await open();
    await user.click(dialog.getByRole("button", { name: "Open a GitHub Issue" }));
    expect(await dialog.findByText(/was cut short\. Click Copy My Message/)).toBeDefined();
  });

  it("offers email once the beta has an address", async () => {
    const { api, open, user } = setUp("Hello", { ...INFO, mail: true });
    const dialog = await open();
    await user.click(await dialog.findByRole("button", { name: "Write an Email" }));
    expect(api.openReport).toHaveBeenCalledWith("mail", "Hello");
  });
});
