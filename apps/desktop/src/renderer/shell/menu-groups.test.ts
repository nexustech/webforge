import { describe, expect, it } from "vitest";
import type { MenuEntry } from "./commands.js";
import { inGroups, MENU_GROUPS } from "./menu-groups.js";

/** Entries for commands `ids`, in that (registration) order. */
const entries = (...ids: string[]): MenuEntry[] =>
  ids.map((id) => ({ command: { id, label: id, run: () => undefined }, submenu: [] }));

/** The menu as text: its items' ids, "|" where a separator goes, a submenu's in brackets. */
const drawn = (grouped: ReturnType<typeof inGroups>) =>
  grouped.flatMap(({ command, submenu, separated }) => {
    const item =
      submenu.length === 0
        ? command.id
        : `${command.label} [${submenu.map((each) => each.label).join(", ")}]`;
    return separated ? ["|", item] : [item];
  });

describe("inGroups (#1016)", () => {
  it("puts Edit's items in its groups' order, a separator between groups", () => {
    const grouped = inGroups(
      "edit",
      entries(
        "edit.findReplace",
        "edit.copy",
        "edit.undo",
        "edit.cut",
        "edit.redo",
        "edit.moveUp",
        "edit.note",
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
      "edit.note",
      "|",
      "edit.findReplace",
    ]);
  });

  it("gathers Style's, Select's and Shared Section's commands in submenus, named without their word", () => {
    const grouped = inGroups(
      "edit",
      entries(
        "edit.renameSharedSection",
        "edit.selectSimilar",
        "edit.pasteStyle",
        "edit.undo",
        "edit.copyStyle",
        "edit.selectParent",
        "edit.saveSharedSection",
        "edit.pasteLinked",
      ),
    );

    expect(drawn(grouped)).toEqual([
      "edit.undo",
      "|",
      "Style [edit.copyStyle, edit.pasteStyle]",
      "Select [edit.selectParent, edit.selectSimilar]",
      "Shared Section [edit.saveSharedSection, Rename…, edit.pasteLinked]",
    ]);
    // A submenu's item runs nothing itself, and is always open to read its items' reasons.
    const style = grouped[1]?.command;
    expect(style).toMatchObject({ id: "menu.edit.style" });
    expect(style?.enabled).toBeUndefined();
    // The command keeps its own name, for the command box.
    expect(grouped[3]?.submenu[1]).toMatchObject({ id: "edit.renameSharedSection" });
  });

  it("leaves out a submenu none of whose commands are registered", () => {
    expect(drawn(inGroups("edit", entries("edit.undo", "edit.selectChild")))).toEqual([
      "edit.undo",
      "|",
      "Select [edit.selectChild]",
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

describe("MENU_GROUPS (#1016)", () => {
  /** The renderer's own code, tests and stories left out, and the files that only refer to ids. */
  const sources = Object.entries(
    import.meta.glob<string>(
      ["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../**/*.stories.tsx"],
      {
        query: "?raw",
        import: "default",
        eager: true,
      },
    ),
  ).filter(([path]) => !/\/(menu-groups|shortcut-standard)\.ts$|\/ElementMenu\.tsx$/.test(path));

  it("lists only commands the editor registers, so a renamed one can't drop out of its group", () => {
    const ids = Object.values(MENU_GROUPS).flatMap((groups) =>
      groups
        .flat()
        .flatMap((item) =>
          typeof item === "string"
            ? [item]
            : item.items.map((each) => (typeof each === "string" ? each : each.id)),
        ),
    );
    expect(ids.length).toBeGreaterThan(20);
    const unregistered = ids.filter((id) => !sources.some(([, text]) => text.includes(`"${id}"`)));
    expect(unregistered).toEqual([]);
  });
});
