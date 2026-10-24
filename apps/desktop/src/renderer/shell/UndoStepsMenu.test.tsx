// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@webforge/editor-ui";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { createEditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { undoEntry } from "../editor/undo-entry.js";
import { CommandRegistryProvider } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import { createCommandRegistry } from "./commands.js";
import { UndoStepsMenu } from "./UndoStepsMenu.js";

afterEach(cleanup);

/** A site with `count` steps ("Step 1" first), Undo registered as the editor registers it. */
function setUp(count: number) {
  const session = createEditorSession(siteLibrary, starterSite());
  for (let step = 1; step <= count; step++) {
    session.edit("props", `Step ${step}`, (draft) => {
      draft.settings.general.name = `Name ${step}`;
    });
  }
  const registry = createCommandRegistry();
  registry.register({
    id: COMMAND_IDS.undo,
    label: "Undo",
    enabled: session.history.state.getState().canUndo,
    run: () => {
      session.history.undo();
    },
  });
  session.history.state.subscribe((state) =>
    registry.update(COMMAND_IDS.undo, { enabled: state.canUndo }),
  );
  render(
    <CommandRegistryProvider registry={registry}>
      <TooltipProvider>
        <UndoStepsMenu
          state={session.history.state}
          undoTo={(entryId) => undoEntry(session.history, entryId)}
        />
      </TooltipProvider>
    </CommandRegistryProvider>,
  );
  const arrow = () => screen.getByRole("button", { name: "Undo several steps" });
  const items = () => screen.getAllByRole("menuitem").map((item) => item.textContent);
  return { session, arrow, items };
}

describe("UndoStepsMenu (UX-16)", () => {
  it("lists the latest steps that can be undone, newest first, ten at most", async () => {
    const { session, arrow, items } = setUp(12);
    act(() => {
      session.history.undo();
    });

    await userEvent.click(arrow());

    expect(items()).toHaveLength(10);
    // Step 12 was undone: it can be redone, not undone again.
    expect(items()[0]).toBe("Step 11, Undoes this step");
    expect(items()[2]).toBe("Step 9, Undoes 3 steps");
    expect(items().at(-1)).toBe("Step 2, Undoes 10 steps");
  });

  it("undoes the step chosen and every later one, so Redo brings them back", async () => {
    const { session, arrow } = setUp(4);
    const name = () => session.history.document.getState().settings.general.name;

    await userEvent.click(arrow());
    await userEvent.click(screen.getByRole("menuitem", { name: /^Step 2/ }));

    expect(name()).toBe("Name 1");
    expect(session.history.state.getState().cursor).toBe(1);
    // Nothing recorded: the steps undone are there to redo.
    expect(session.history.entries()).toHaveLength(4);
    act(() => {
      session.history.redo();
    });
    expect(name()).toBe("Name 2");
  });

  it("says how many steps go together", async () => {
    const { arrow } = setUp(3);

    await userEvent.click(arrow());
    expect(screen.getByText("Undoes the step you choose and every later one.")).toBeTruthy();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    expect(screen.getByText("Undoes 3 steps", { selector: "p" })).toBeTruthy();
  });

  it("is off with nothing to undo", () => {
    const { arrow } = setUp(0);

    expect(arrow()).toHaveProperty("disabled", true);
  });
});
