// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { SiteSettingsHost } from "./SiteSettingsHost.js";

afterEach(cleanup);

// Drives the dialog through user-event, which is slow in happy-dom under coverage.
const SLOW = 15_000;

describe("SiteSettingsHost", () => {
  it(
    "opens Site Settings from the File menu command and saves them as one undo step",
    async () => {
      const registry = createCommandRegistry();
      const session = createEditorSession(siteLibrary, starterSite());
      render(
        <CommandRegistryProvider registry={registry}>
          <SiteSettingsHost session={session} />
        </CommandRegistryProvider>,
      );
      const user = userEvent.setup({ delay: null });

      expect(registry.get(COMMAND_IDS.siteSettings)).toMatchObject({
        label: "Site Settings…",
        menu: "file",
      });
      act(() => {
        registry.run(COMMAND_IDS.siteSettings);
      });
      const name = await screen.findByLabelText("Site name");
      await user.clear(name);
      await user.type(name, "Rosa's");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(session.history.document.getState().settings.general.name).toBe("Rosa's");
      expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
        "Changed Site Settings: General",
      ]);
      expect(screen.queryByRole("dialog")).toBeNull();
    },
    SLOW,
  );
});
