// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { toast } from "@webforge/editor-ui";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { HelpCommands } from "./HelpCommands.js";
import { helpLibraryOf } from "./help-library.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LIBRARY = helpLibraryOf(
  {
    "/help/publish.md":
      "---\nid: publish\ntitle: Publish\nsummary: Put your site on your web host.\nrelated: []\nupdated: 2026-11-07\n---\n\n# Publish\n",
  },
  "## Contents\n\n**Going live**\n- [Publish](publish.md)\n",
);

function setUp(open = vi.fn(async () => true)) {
  const registry = createCommandRegistry({ mac: false });
  const view = render(
    <CommandRegistryProvider registry={registry}>
      <HelpCommands help={{ open }} library={LIBRARY} />
    </CommandRegistryProvider>,
  );
  return { registry, open, view };
}

describe("HelpCommands (5.4b)", () => {
  it("puts Help in the Help menu with F1, and each page in Search Commands' Help group", async () => {
    const { registry, open, view } = setUp();
    expect(registry.get(COMMAND_IDS.help)).toMatchObject({
      label: "Webforge Help",
      menu: "help",
      shortcut: "F1",
    });
    expect(registry.get("help.page.publish")).toMatchObject({
      label: "Publish",
      palette: "help",
      paletteLabel: "Help: Publish",
      keywords: ["Put your site on your web host."],
    });
    expect(registry.get("help.page.publish")?.menu).toBeUndefined();

    await registry.run(COMMAND_IDS.help);
    await registry.run("help.page.publish");
    expect(open.mock.calls).toEqual([[{}], [{ page: "publish" }]]);

    view.unmount();
    expect(registry.get(COMMAND_IDS.help)).toBeUndefined();
    expect(registry.get("help.page.publish")).toBeUndefined();
  });

  it("says when the Help window didn't open", async () => {
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const { registry } = setUp(vi.fn(async () => false));
    await registry.run(COMMAND_IDS.help);
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringMatching(/didn't open/)),
    );

    const failing = setUp(vi.fn(async () => Promise.reject(new Error("ipc-failed"))));
    await failing.registry.run(COMMAND_IDS.help);
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(2));
  });
});
