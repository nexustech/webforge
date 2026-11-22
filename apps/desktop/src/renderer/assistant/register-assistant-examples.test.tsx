// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { createWindowDialogs, WindowDialogs } from "../shell/window-dialogs.js";
import { registerAssistantExamples } from "./register-assistant-examples.js";

afterEach(cleanup);

function setUp() {
  const commands = createCommandRegistry({ mac: false });
  const dialogs = createWindowDialogs();
  const tryExample = vi.fn();
  const examples = registerAssistantExamples(commands, dialogs, tryExample);
  render(<WindowDialogs registry={dialogs} />);
  return { commands, dialogs, examples, tryExample };
}

describe("registerAssistantExamples (5.21, OL-8)", () => {
  it("opens from Help, and tries an example in the assistant's box", async () => {
    const { commands, tryExample } = setUp();
    expect(commands.get(COMMAND_IDS.assistantExamples)).toMatchObject({
      label: "Things You Can Ask the Assistant…",
      menu: "help",
    });

    await act(async () => {
      await commands.run(COMMAND_IDS.assistantExamples);
    });
    await userEvent.click(screen.getByRole("button", { name: "Try “Make the corners rounder.”" }));

    expect(tryExample).toHaveBeenCalledWith("Make the corners rounder.");
    expect(screen.queryByRole("dialog", { name: "Things You Can Ask" })).toBeNull();
  });

  it("opens from the panel's link, and removes both", async () => {
    const { commands, dialogs, examples } = setUp();
    act(() => examples.open());
    expect(screen.getByRole("dialog", { name: "Things You Can Ask" })).toBeDefined();

    examples.remove();
    expect(commands.get(COMMAND_IDS.assistantExamples)).toBeUndefined();
    expect(dialogs.list()).toEqual([]);
  });
});
