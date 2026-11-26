// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { PhonePreviewCue } from "./PhonePreviewCue.js";

afterEach(cleanup);

/** The cue, and a function that registers the phone preview's commands as the preview does. */
function renderCue() {
  const registry = createCommandRegistry();
  render(
    <CommandRegistryProvider registry={registry}>
      <PhonePreviewCue />
    </CommandRegistryProvider>,
  );
  const stop = vi.fn();
  const show = vi.fn();
  const turnOn = () => {
    let removers: (() => void)[] = [];
    act(() => {
      removers = [
        registry.register({
          id: COMMAND_IDS.stopPhonePreview,
          label: "Stop Phone Preview",
          run: stop,
        }),
        registry.register({
          id: COMMAND_IDS.showPhonePreview,
          label: "Show Phone Preview…",
          run: show,
        }),
      ];
    });
    return () =>
      act(() => {
        for (const remove of removers) remove();
      });
  };
  return { stop, show, turnOn };
}

/** The element `button`'s `aria-describedby` names, if any. */
const describing = (button: HTMLElement) =>
  document.getElementById(button.getAttribute("aria-describedby") ?? "");

describe("PhonePreviewCue (3.2)", () => {
  it("says a phone can open the preview while Stop Phone Preview is there, and runs it", async () => {
    const { stop, turnOn } = renderCue();
    expect(screen.queryByRole("status")).toBeNull();

    const turnOff = turnOn();
    // Both forms are drawn; the title bar's width shows one (#1438), which happy-dom doesn't.
    const [wide] = screen.getAllByRole("status");
    expect(wide?.textContent).toContain("Phone preview on");
    // Stop says "Stop" and is named for what it stops, described by who can see the preview, for
    // a screen reader on it (#1011).
    const button = screen.getByRole("button", { name: "Stop Phone Preview" });
    expect(button.textContent).toBe("Stop");
    expect(describing(button)?.textContent).toContain("Anyone on this Wi-Fi");
    // It never wraps (#1438).
    expect(wide?.className).toContain("whitespace-nowrap");
    await userEvent.click(button);
    expect(stop).toHaveBeenCalledOnce();

    turnOff();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("folds to the phone's icon, named as on, which shows the preview as it is (#1438)", async () => {
    const { show, stop, turnOn } = renderCue();
    turnOn();
    const icon = screen.getByRole("button", { name: "Phone preview on" });
    expect(icon.getAttribute("aria-haspopup")).toBe("dialog");
    expect(describing(icon)?.textContent).toContain("Anyone on this Wi-Fi");
    // An icon button's size, the least a target may be (L4).
    expect(icon.className).toContain("size-7");
    await userEvent.click(icon);
    expect(show).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });
});
