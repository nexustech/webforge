// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { PhonePreviewCue } from "./PhonePreviewCue.js";

afterEach(cleanup);

describe("PhonePreviewCue (3.2)", () => {
  it("says a phone can open the preview while Stop Phone Preview is there, and runs it", async () => {
    const registry = createCommandRegistry();
    render(
      <CommandRegistryProvider registry={registry}>
        <PhonePreviewCue />
      </CommandRegistryProvider>,
    );
    expect(screen.queryByRole("status")).toBeNull();

    const stop = vi.fn();
    let remove: () => void = () => undefined;
    act(() => {
      remove = registry.register({
        id: COMMAND_IDS.stopPhonePreview,
        label: "Stop Phone Preview",
        run: stop,
      });
    });
    expect(screen.getByRole("status").textContent).toContain("Phone preview on");
    await userEvent.click(screen.getByRole("button", { name: "Stop Phone Preview" }));
    expect(stop).toHaveBeenCalledOnce();

    act(() => remove());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
