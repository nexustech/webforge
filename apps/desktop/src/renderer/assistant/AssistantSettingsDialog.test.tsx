// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ASSISTANT_CONSENT_VERSION } from "../../shared/ipc/assistant.js";
import { AssistantSettingsDialog } from "./AssistantSettingsDialog.js";
import { createFakeAssistant, FAKE_STATUS } from "./fake-assistant.js";
import { registerAssistantSettings } from "./register-assistant-settings.js";

afterEach(cleanup);

function shown(status = FAKE_STATUS) {
  const api = createFakeAssistant({ status });
  const enable = vi.spyOn(api, "setEnabled");
  const update = vi.spyOn(api, "update");
  render(<AssistantSettingsDialog open onOpenChange={vi.fn()} api={api} />);
  const dialog = within(screen.getByRole("dialog", { name: "Assistant" }));
  return { api, enable, update, dialog, user: userEvent.setup({ delay: null }) };
}

describe("the assistant's settings (6.9c, AIA-6, AIA-8)", () => {
  it("turns it on only through the consent, naming who receives what", async () => {
    const { dialog, enable, user } = shown({
      ...FAKE_STATUS,
      enabled: false,
      consentVersion: null,
    });

    await user.click(await dialog.findByRole("button", { name: "Turn On…" }));
    const consent = within(screen.getByRole("dialog", { name: "Turn on the assistant?" }));
    expect(consent.getByText("OpenRouter and Example AI receive it.")).toBeDefined();
    expect(enable).not.toHaveBeenCalled();

    await user.click(consent.getByRole("button", { name: "Turn On" }));
    expect(enable).toHaveBeenCalledWith(true, ASSISTANT_CONSENT_VERSION);
    expect(await dialog.findByText("The assistant is on")).toBeDefined();
  });

  it("turns it off at once", async () => {
    const { dialog, enable, user } = shown();

    await user.click(await dialog.findByRole("button", { name: "Turn Off" }));
    expect(enable).toHaveBeenCalledWith(false, ASSISTANT_CONSENT_VERSION);
    expect(await dialog.findByText("The assistant is off")).toBeDefined();
  });

  it("sets the monthly limit between $1 and $1,000", async () => {
    const { dialog, update, user } = shown();
    const field = await dialog.findByRole("spinbutton", { name: "Limit in US dollars" });
    const set = dialog.getByRole("button", { name: "Set Limit" });

    await user.type(field, "0");
    expect((set as HTMLButtonElement).disabled).toBe(true);
    await user.clear(field);
    await user.type(field, "12");
    await user.click(set);
    expect(update).toHaveBeenCalledWith({ monthlyLimitUsd: 12 });
    expect(await dialog.findByText("This month: $0.00 of $12.00")).toBeDefined();
  });

  it("shows the status as it is now when opened again (#1005 review)", async () => {
    const api = createFakeAssistant();
    const { rerender } = render(<AssistantSettingsDialog open onOpenChange={vi.fn()} api={api} />);
    expect(await screen.findByText("The assistant is on")).toBeDefined();

    rerender(<AssistantSettingsDialog open={false} onOpenChange={vi.fn()} api={api} />);
    // Changed elsewhere while it's closed (the panel, another window).
    await api.setEnabled(false, ASSISTANT_CONSENT_VERSION);
    rerender(<AssistantSettingsDialog open onOpenChange={vi.fn()} api={api} />);

    expect(await screen.findByText("The assistant is off")).toBeDefined();
    expect(screen.queryByText("The assistant is on")).toBeNull();
  });

  it("is a line in Settings › Assistant that opens the dialog", async () => {
    const register = vi.fn((_entry: unknown) => () => undefined);
    let Dialog: ComponentType = () => null;
    const settings = registerAssistantSettings(
      { register },
      {
        register: (dialog) => {
          Dialog = dialog.component;
          return () => undefined;
        },
      },
      createFakeAssistant(),
    );
    expect(register.mock.calls[0]?.[0]).toMatchObject({ id: "assistant", heading: "app" });
    render(<Dialog />);
    expect(screen.queryByRole("dialog")).toBeNull();

    settings.open();
    expect(await screen.findByRole("dialog", { name: "Assistant" })).toBeDefined();
    settings.remove();
  });
});
