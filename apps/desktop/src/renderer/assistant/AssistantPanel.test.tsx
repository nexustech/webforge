// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { createFakeAssistant, FAKE_STATUS, type FakeAssistantOptions } from "./fake-assistant.js";
import { registerAssistantPanel } from "./register-assistant-panel.js";

afterEach(cleanup);

/** The panel on a site, its component drawn as the window would. */
function shown(options: FakeAssistantOptions = {}) {
  const api = createFakeAssistant({ delayMs: 0, ...options });
  const send = vi.spyOn(api, "send");
  const session = sessionWith();
  const openSettings = vi.fn();
  let Panel: () => ReactNode = () => null;
  const remove = registerAssistantPanel({
    panels: {
      register: (panel) => {
        Panel = panel.component as () => ReactNode;
        return () => undefined;
      },
      show: vi.fn(),
    },
    session,
    api,
    sessionId: "site-1",
    openSettings,
  });
  render(<Panel />);
  return { api, send, session, openSettings, remove, user: userEvent.setup({ delay: null }) };
}

describe("the assistant's panel (6.9c)", () => {
  it("sends nothing before the site's yes, and nothing after a no (AIA-6)", async () => {
    const { send, user } = shown({ siteConsent: { asked: false, allowed: false } });
    const ask = await screen.findByRole("region", { name: /Use the assistant on/ });

    expect(screen.queryByRole("textbox", { name: "Message the assistant" })).toBeNull();
    await user.click(within(ask).getByRole("button", { name: "Not Now" }));
    expect(await screen.findByText(/chose not to use the assistant on this site/)).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Message the assistant" })).toBeNull();
    expect(send).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Use on This Site" }));
    expect(await screen.findByRole("textbox", { name: "Message the assistant" })).toBeDefined();
  });

  it("stops using the assistant on this site when asked (AIA-6)", async () => {
    const { api, user } = shown();
    const consent = vi.spyOn(api, "setSiteConsent");
    await user.click(await screen.findByRole("button", { name: "Stop Using on This Site" }));

    expect(consent).toHaveBeenCalledWith("site-1", false);
    expect(await screen.findByText(/chose not to use the assistant on this site/)).toBeDefined();
    expect(screen.queryByRole("textbox", { name: "Message the assistant" })).toBeNull();
  });

  it("opens a reply's link through main, as the reply wrote it", async () => {
    const { api, user } = shown({
      reply: { text: "See [our hours](HTTPS://Bakery.example/hours)." },
    });
    const open = vi.spyOn(api, "openLink");
    await user.type(
      await screen.findByRole("textbox", { name: "Message the assistant" }),
      "Hi{Enter}",
    );
    await user.click(await screen.findByRole("link", { name: /our hours/ }));

    expect(open).toHaveBeenCalledWith("site-1", expect.any(String), "HTTPS://Bakery.example/hours");
    expect(await open.mock.results[0]?.value).toEqual({ status: "opened" });
  });

  it("is off until set up in Settings, and asks again when its provider is new", async () => {
    const off = shown({ status: { ...FAKE_STATUS, enabled: false, consentVersion: null } });
    await off.user.click(await screen.findByRole("button", { name: "Set Up the Assistant…" }));
    expect(off.openSettings).toHaveBeenCalledOnce();
    cleanup();

    const moved = shown({
      status: {
        ...FAKE_STATUS,
        enabled: false,
        provider: { kind: "server", baseUrl: "https://ai.example.org/v1", hasKey: true },
        reach: "server",
      },
    });
    const enable = vi.spyOn(moved.api, "setEnabled");
    const consent = within(await screen.findByRole("dialog", { name: "Turn on the assistant?" }));
    expect(consent.getByText(/server at ai.example.org/)).toBeDefined();
    await moved.user.click(consent.getByRole("button", { name: "Turn On" }));
    expect(enable).toHaveBeenCalledWith(true, FAKE_STATUS.consentVersion);
  });

  it("sends a message with what's selected, and undoes its changes from the review card", async () => {
    const options: FakeAssistantOptions = {
      reply: () => ({
        text: "Done.",
        steps: [{ entryId: entry, label: "AI (Assistant): Edited Hero text" }],
      }),
    };
    let entry = "";
    const { send, session, user } = shown(options);
    session.history.run("AI (Assistant): Edited Hero text", (site) => {
      site.settings.general.name = "Changed";
    });
    entry = session.history.entries()[0]?.id ?? "";

    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    await user.type(box, "Shorten the title{Enter}");
    expect(send).toHaveBeenCalledWith("site-1", "Shorten the title", {
      pageId: session.ui.getState().pageId,
    });
    const card = within(await screen.findByRole("region", { name: "This reply made 1 change" }));

    await user.click(card.getByRole("button", { name: "Undo These Changes" }));
    await waitFor(() => expect(session.history.state.getState().cursor).toBe(0));
    expect(card.getByRole("status").textContent).toMatch(/These changes are undone/);
  });

  it("says why a message wasn't sent, and keeps it to send again (#1000 review)", async () => {
    const { user } = shown({ reply: { refuse: "limit-reached" } });
    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    await user.type(box, "Hi{Enter}");

    expect((await screen.findByRole("alert")).textContent).toMatch(/This month's limit is reached/);
    expect((box as HTMLTextAreaElement).value).toBe("Hi");
  });

  it("sends nothing on the Enter that confirms a composed word (#1000 review)", async () => {
    const { send } = shown();
    const box = await screen.findByRole("textbox", { name: "Message the assistant" });
    fireEvent.change(box, { target: { value: "日本" } });
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });

    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(send).toHaveBeenCalledOnce();
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(""));
  });
});
