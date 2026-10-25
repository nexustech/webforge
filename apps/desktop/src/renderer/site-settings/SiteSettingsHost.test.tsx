// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createCommandRegistry } from "../shell/commands.js";
import { sessionWith } from "../testing/fixtures.js";
import { SiteSettingsHost } from "./SiteSettingsHost.js";

afterEach(cleanup);

// Drives the dialog through user-event, which is slow in happy-dom under coverage.
const SLOW = 15_000;

describe("SiteSettingsHost", () => {
  it(
    "opens Site Settings from the File menu command and saves them as one undo step",
    async () => {
      const registry = createCommandRegistry();
      const session = sessionWith();
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

  it(
    "saves adding, moving and removing opening hours as one undo step (PH2-13)",
    async () => {
      const registry = createCommandRegistry();
      const session = sessionWith();
      render(
        <CommandRegistryProvider registry={registry}>
          <SiteSettingsHost session={session} />
        </CommandRegistryProvider>,
      );
      const user = userEvent.setup({ delay: null });
      act(() => {
        registry.run(COMMAND_IDS.siteSettings);
      });

      await user.click(await screen.findByRole("tab", { name: "Contact & hours" }));
      // Each added item opens: a day for each, as hours need one.
      const add = screen.getByRole("button", { name: "Add opening hours" });
      for (const day of ["Mon", "Tue", "Wed"]) {
        await user.click(add);
        await user.click(screen.getByRole("checkbox", { name: day }));
      }
      await user.click(
        screen.getAllByRole("button", { name: "Move Opening hours down" })[0] as HTMLElement,
      );
      await user.click(
        screen.getAllByRole("button", { name: "Remove these hours" })[2] as HTMLElement,
      );
      // Nothing is a step until Save.
      expect(session.history.state.getState().entries).toEqual([]);
      await user.click(screen.getByRole("button", { name: "Save" }));

      // Monday moved below Tuesday, and Wednesday removed.
      expect(
        session.history.document.getState().settings.contact.openingHours.map(({ days }) => days),
      ).toEqual([["tue"], ["mon"]]);
      expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
        "Changed Site Settings: Contact & hours",
      ]);
    },
    SLOW,
  );
});
