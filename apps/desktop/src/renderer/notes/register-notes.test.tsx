// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NodeDoc } from "@webforge/model";
import { afterEach, describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import { createWindowDialogs } from "../shell/window-dialogs.js";
import { registriesForTest, sessionWith } from "../testing/fixtures.js";
import { registerNotes } from "./register-notes.js";

afterEach(cleanup);

/** The starter site's home page with a Heading, a Text and an Image in one Section. */
function setUp() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  const content: NodeDoc[] = [
    {
      type: "Section",
      props: {
        id: "s1",
        content: [
          { type: "Heading", props: { id: "h", text: "Welcome" } },
          { type: "Text", props: { id: "t", text: "<p>Hello</p>" } },
        ],
      },
    },
  ];
  const session = sessionWith({
    ...site,
    pages: { ...site.pages, [home.id]: { ...home, doc: { root: { props: {} }, content } } },
  });
  const { commands } = registriesForTest();
  const dialogs = createWindowDialogs();
  const remove = registerNotes(commands, dialogs, session);
  const Dialog = dialogs.list()[0]?.component;
  if (Dialog === undefined) throw new Error("no dialog");
  render(<Dialog />);
  const note = () => {
    const page = session.history.document.getState().pages[home.id];
    const section = page?.doc.content[0]?.props.content as NodeDoc[] | undefined;
    return section?.[0]?.props.note;
  };
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, commands, remove, note, labels };
}

describe("notes on elements (UX-17, #868)", () => {
  it("adds, changes and resolves a note on the element selected, one undo step each", async () => {
    const { session, commands, note, labels } = setUp();
    expect(commands.get(COMMAND_IDS.note)?.enabled).toBe(false);

    act(() => session.select("h"));
    expect(commands.get(COMMAND_IDS.note)).toMatchObject({ enabled: true, label: "Add Note…" });
    expect(commands.get(COMMAND_IDS.resolveNote)?.enabled).toBe(false);

    await act(() => commands.run(COMMAND_IDS.note));
    await userEvent.type(screen.getByRole("textbox", { name: "Note" }), "  Swap this photo  ");
    await userEvent.click(screen.getByRole("button", { name: "Save Note" }));
    expect(note()).toBe("Swap this photo");
    expect(commands.get(COMMAND_IDS.note)?.label).toBe("Edit Note…");
    expect(commands.get(COMMAND_IDS.resolveNote)?.enabled).toBe(true);

    await act(() => commands.run(COMMAND_IDS.note));
    const field = screen.getByRole("textbox", { name: "Note" });
    expect((field as HTMLTextAreaElement).value).toBe("Swap this photo");
    await userEvent.clear(field);
    await userEvent.type(field, "Swap it for the new one");
    await userEvent.click(screen.getByRole("button", { name: "Save Note" }));

    await act(() => commands.run(COMMAND_IDS.resolveNote));
    expect(note()).toBeUndefined();
    expect(labels()).toEqual([
      "Added a note to Heading",
      "Changed the note on Heading",
      "Resolved the note on Heading",
    ]);
    act(() => session.history.undo());
    expect(note()).toBe("Swap it for the new one");
  });

  it("resolves a note emptied in the dialog, and saves nothing unchanged", async () => {
    const { session, commands, note, labels } = setUp();
    act(() => session.select("h"));
    await act(() => commands.run(COMMAND_IDS.note));
    await userEvent.type(screen.getByRole("textbox", { name: "Note" }), "Check the date");
    await userEvent.click(screen.getByRole("button", { name: "Save Note" }));

    await act(() => commands.run(COMMAND_IDS.note));
    await userEvent.click(screen.getByRole("button", { name: "Save Note" }));
    await act(() => commands.run(COMMAND_IDS.note));
    await userEvent.clear(screen.getByRole("textbox", { name: "Note" }));
    await userEvent.click(screen.getByRole("button", { name: "Save Note" }));

    expect(note()).toBeUndefined();
    expect(labels()).toEqual(["Added a note to Heading", "Resolved the note on Heading"]);
  });

  it("is off with several elements selected, as a note is on one", () => {
    const { session, commands, remove } = setUp();

    act(() => session.selectElements(["h", "t"]));

    expect(commands.get(COMMAND_IDS.note)?.enabled).toBe(false);
    remove();
    expect(commands.get(COMMAND_IDS.note)).toBeUndefined();
  });
});
