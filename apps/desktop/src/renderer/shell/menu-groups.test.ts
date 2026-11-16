import { describe, expect, it } from "vitest";
import type { MenuEntry } from "./commands.js";
import { inGroups } from "./menu-groups.js";

/** Entries for commands `ids`, in that (registration) order. */
const entries = (...ids: string[]): MenuEntry[] =>
  ids.map((id) => ({ command: { id, label: id, run: () => undefined }, submenu: [] }));

/** The menu as text: its items' ids, "|" where a separator goes. */
const drawn = (grouped: ReturnType<typeof inGroups>) =>
  grouped.flatMap(({ command, separated }) => (separated ? ["|", command.id] : [command.id]));

describe("inGroups (#1016)", () => {
  it("puts Edit's items in its groups' order, a separator between groups", () => {
    const grouped = inGroups(
      "edit",
      entries(
        "edit.findReplace",
        "edit.selectParent",
        "edit.copy",
        "edit.undo",
        "edit.cut",
        "edit.redo",
        "edit.moveUp",
      ),
    );

    expect(drawn(grouped)).toEqual([
      "edit.undo",
      "edit.redo",
      "|",
      "edit.cut",
      "edit.copy",
      "|",
      "edit.moveUp",
      "|",
      "edit.selectParent",
      "|",
      "edit.findReplace",
    ]);
  });

  it("puts what its groups leave out last, in a group of its own, in registration order", () => {
    const grouped = inGroups("edit", entries("edit.later", "edit.undo", "edit.another"));
    expect(drawn(grouped)).toEqual(["edit.undo", "|", "edit.later", "edit.another"]);
  });

  it("starts with no separator, whichever group comes first", () => {
    expect(drawn(inGroups("edit", entries("edit.note", "edit.resolveNote")))).toEqual([
      "edit.note",
      "edit.resolveNote",
    ]);
  });

  it("leaves a menu without groups as it was registered, with no separators", () => {
    const grouped = inGroups("view", entries("view.zoomOut", "view.zoomIn"));
    expect(drawn(grouped)).toEqual(["view.zoomOut", "view.zoomIn"]);
    expect(drawn(inGroups("app", entries("app.settings")))).toEqual(["app.settings"]);
  });
});
