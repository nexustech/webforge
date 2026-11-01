import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { currentPage } from "../editor/editor-session.js";
import { createCommandRegistry } from "../shell/commands.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  canPasteStyle,
  copyStyle,
  pasteStyle,
  registerStyleCommands,
  styleFieldsOf,
} from "./style-clipboard.js";

/** A session on a page of `content`, with helpers to select, read and list steps. */
function sessionOn(content: NodeDoc[]) {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = content;
  const session = sessionWith(site);
  const select = (nodeId: string) => session.select(nodeId);
  const top = (id: string) =>
    currentPage(session)?.doc.content.find((each) => each.props.id === id)?.props;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, select, top, labels };
}

/** A section holding a large primary Heading, a plain one and a Text. */
function setUp() {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content = [
    {
      type: "Section",
      props: {
        id: "s",
        content: [
          {
            type: "Heading",
            props: { id: "big", text: "Fresh bread", size: "large", color: "primary" },
          },
          { type: "Heading", props: { id: "plain", text: "Our cakes" } },
          { type: "Text", props: { id: "t" } },
        ],
      },
    },
  ];
  const session = sessionWith(site);
  const select = (nodeId: string) => session.select(nodeId);
  const node = (id: string) =>
    ((currentPage(session)?.doc.content[0]?.props.content ?? []) as NodeDoc[]).find(
      (each) => each.props.id === id,
    )?.props;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return { session, select, node, labels };
}

describe("styleFieldsOf (1.37)", () => {
  it("is the Edit panel's Style fields: never text, links, images or lists", () => {
    const heading = siteLibrary.components.Heading;
    if (heading === undefined) throw new Error("no Heading");

    expect(styleFieldsOf(heading)).toEqual(expect.arrayContaining(["size", "color"]));
    expect(styleFieldsOf(heading)).not.toContain("text");
  });
});

describe("copyStyle and pasteStyle (UX-14)", () => {
  it("gives a Heading another Heading's style as one step, its text kept, undone in one go", () => {
    const { session, select, node, labels } = setUp();
    select("big");
    const copied = copyStyle(session);
    expect(copied).toMatchObject({ type: "Heading", values: { size: "large", color: "primary" } });

    select("plain");
    expect(pasteStyle(session, copied ?? { type: "", label: "", values: {} })).toBe(true);

    expect(node("plain")).toMatchObject({ text: "Our cakes", size: "large", color: "primary" });
    expect(labels()).toEqual(["Pasted style on Heading"]);
    session.history.undo();
    expect(node("plain")?.size).toBeUndefined();
  });

  it("pastes a Section's padding, margin and gap whole, every device, in one step", () => {
    const padding = { $responsive: { desktop: { top: "l", bottom: "l" }, mobile: { top: "s" } } };
    const { session, select, top, labels } = sessionOn([
      {
        type: "Section",
        props: { id: "from", padding, margin: { bottom: "m" }, gap: "large", content: [] },
      },
      { type: "Section", props: { id: "to", content: [] } },
    ]);
    select("from");
    const copied = copyStyle(session);

    select("to");
    pasteStyle(session, copied ?? { type: "", label: "", values: {} });

    expect(top("to")).toMatchObject({ padding, margin: { bottom: "m" }, gap: "large" });
    expect(labels()).toEqual(["Pasted style on Section"]);
  });

  it("keeps a Hero's own image, link and text, giving it only the other's style", () => {
    const { session, select, top } = sessionOn([
      { type: "Hero", props: { id: "from", title: "Fresh bread", alignment: "left" } },
      {
        type: "Hero",
        props: {
          id: "to",
          title: "Cakes",
          image: { mediaId: "photo" },
          buttonLink: { kind: "file", mediaId: "prices" },
        },
      },
    ]);
    select("from");
    const copied = copyStyle(session);

    select("to");
    pasteStyle(session, copied ?? { type: "", label: "", values: {} });

    expect(top("to")).toMatchObject({
      title: "Cakes",
      alignment: "left",
      image: { mediaId: "photo" },
      buttonLink: { kind: "file", mediaId: "prices" },
    });
  });

  it("records nothing for a style the same but for its keys' order", () => {
    const { session, select, labels } = sessionOn([
      { type: "Section", props: { id: "from", padding: { top: "l", bottom: "s" }, content: [] } },
      { type: "Section", props: { id: "to", padding: { bottom: "s", top: "l" }, content: [] } },
    ]);
    select("from");
    const copied = copyStyle(session);

    select("to");

    expect(pasteStyle(session, copied ?? { type: "", label: "", values: {} })).toBe(false);
    expect(labels()).toEqual([]);
  });

  it("is offered only for an element of the same type, and records nothing that changes nothing", () => {
    const { session, select, labels } = setUp();
    select("big");
    const copied = copyStyle(session);

    select("t");
    expect(canPasteStyle(session, copied)).toBe(false);
    select("big");
    expect(canPasteStyle(session, copied)).toBe(true);
    expect(pasteStyle(session, copied ?? { type: "", label: "", values: {} })).toBe(false);
    expect(labels()).toEqual([]);
    select("");
    expect(copyStyle(session)).toBeUndefined();
  });
});

describe("registerStyleCommands", () => {
  it("copies and pastes from the commands, says what a paste needs, and is off in Content mode", () => {
    const { session, select, node, labels } = setUp();
    const registry = createCommandRegistry();
    const commands = registerStyleCommands(registry, session, () => undefined);
    const command = (id: string) => registry.get(id);

    expect(command("edit.copyStyle")).toMatchObject({ enabled: false, shortcut: "Mod+Alt+C" });
    select("big");
    expect(command("edit.copyStyle")?.enabled).toBe(true);
    registry.run("edit.copyStyle");

    select("t");
    expect(command("edit.pasteStyle")).toMatchObject({
      enabled: false,
      label: "Paste Style (onto a Heading)",
    });
    select("plain");
    expect(command("edit.pasteStyle")).toMatchObject({ enabled: true, label: "Paste Style" });
    // Content mode has no Style tab: neither is offered there.
    commands.setLayoutLocked(true);
    expect(command("edit.copyStyle")?.enabled).toBe(false);
    expect(command("edit.pasteStyle")?.enabled).toBe(false);
    expect(registry.run("edit.pasteStyle")).toBe(false);
    commands.setLayoutLocked(false);
    registry.run("edit.pasteStyle");

    expect(node("plain")?.size).toBe("large");
    expect(labels()).toEqual(["Pasted style on Heading"]);
    commands.remove();
    expect(command("edit.pasteStyle")).toBeUndefined();
  });
});

describe("Paste Style and fields a target can't use (2.9b)", () => {
  it("leaves a List's style while it has an icon, and records nothing if that was all", () => {
    const { session, select, top, labels } = sessionOn([
      { type: "List", props: { id: "numbered", style: "numbers", items: [] } },
      { type: "List", props: { id: "ticked", icon: "check", items: [] } },
    ]);
    select("numbered");
    const copied = copyStyle(session);
    if (copied === undefined) throw new Error("No style copied");

    select("ticked");
    expect(pasteStyle(session, copied)).toBe(false);
    expect(top("ticked")?.style).toBeUndefined();
    expect(labels()).toEqual([]);
  });
});

describe("Copy Style on Custom Code (#649)", () => {
  it("copies its margin and look, never its code, and says no code was written", () => {
    const { session, select, top } = sessionOn([
      {
        type: "CustomCode",
        props: { id: "theirs", code: "<script>skim()</script>", margin: { top: "l" } },
      },
      { type: "CustomCode", props: { id: "mine", code: "<p>Mine</p>" } },
    ]);
    const written = vi.fn();
    session.onCodeWritten(written);
    select("theirs");
    const copied = copyStyle(session);
    expect(copied?.values).toHaveProperty("margin", { top: "l" });
    expect(copied?.values).not.toHaveProperty("code");

    select("mine");
    expect(copied !== undefined && pasteStyle(session, copied)).toBe(true);

    expect(top("mine")).toMatchObject({ code: "<p>Mine</p>", margin: { top: "l" } });
    expect(written).not.toHaveBeenCalled();
  });
});
