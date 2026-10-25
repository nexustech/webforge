// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldRenderersProvider } from "@webforge/editor-ui";
import type { MediaId, NodeDoc, PageDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it } from "vitest";
import { EditPanelHost } from "../editor/EditPanelHost.js";
import { currentPage } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { linkFieldRenderer } from "./LinkField.js";

afterEach(cleanup);

/**
 * The starter page with a Hero to link from and an "Opening times" section to link to, with
 * `times`' props over its own.
 */
function setUp(buttonLink?: unknown, times: Record<string, unknown> = {}) {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push(
    {
      type: "Hero",
      props: {
        id: "hero",
        ...structuredClone(siteLibrary.components.Hero?.defaults ?? {}),
        ...(buttonLink === undefined ? {} : { buttonLink }),
      },
    },
    {
      type: "Section",
      props: { id: "times", layerName: "Opening times", content: [], ...times },
    },
  );
  const session = sessionWith(site);
  session.select("hero");
  render(
    <FieldRenderersProvider renderers={{ link: linkFieldRenderer({ session }) }}>
      <EditPanelHost session={session} flush={() => undefined} />
    </FieldRenderersProvider>,
  );
  const node = (id: string) =>
    (currentPage(session)?.doc as PageDoc | undefined)?.content.find(
      (n: NodeDoc) => n.props.id === id,
    )?.props;
  const labels = () => session.history.entries().map((entry) => entry.label);
  return {
    session,
    node,
    labels,
    home: site.homePageId,
    // No wait between events, and addresses pasted rather than typed: each typed character waited
    // a timer tick and redrew the dialog, which took these tests past 5 s under a busy full run.
    user: userEvent.setup({ delay: null }),
  };
}

describe("LinkField and LinkDialog (F-ED-18)", () => {
  it("links to a section, giving it an anchor in the same undo step", async () => {
    const { session, node, labels, home, user } = setUp();
    expect(screen.getByText("No link")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Add Link…" }));
    const dialog = within(screen.getByRole("dialog", { name: "Link" }));
    await user.selectOptions(dialog.getByRole("combobox", { name: "Section" }), "Opening times");
    await user.click(dialog.getByRole("checkbox", { name: "Open in a new tab" }));
    await user.click(dialog.getByRole("button", { name: "Save Link" }));

    expect(node("hero")?.buttonLink).toEqual({
      kind: "page",
      pageId: home,
      anchor: "opening-times",
      newTab: true,
    });
    expect(node("times")?.advanced).toEqual({ anchorId: "opening-times" });
    expect(labels()).toEqual(["Changed Hero button link"]);
    expect(screen.getByText("My site › Opening times")).toBeTruthy();

    session.history.undo();
    expect(node("times")?.advanced).toBeUndefined();
  });

  it("says when a section's anchor ID can't be linked to, under Section, and won't save", async () => {
    // An anchor ID the link schema refuses (typed in the Advanced tab): before, Save stayed off
    // with nothing said, since no field showed the anchor's problem (#435 review).
    const { node, user } = setUp(undefined, { advanced: { anchorId: "Opening Times!" } });

    await user.click(screen.getByRole("button", { name: "Add Link…" }));
    const dialog = within(screen.getByRole("dialog", { name: "Link" }));
    const section = dialog.getByRole("combobox", { name: "Section" });
    await user.selectOptions(section, "Opening times");

    expect(section.getAttribute("aria-invalid")).toBe("true");
    expect(dialog.getByText(/anchor ID can't be used in a link/)).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Save Link" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.selectOptions(section, "Top of the page");
    expect(section.getAttribute("aria-invalid")).not.toBe("true");
    await user.click(dialog.getByRole("button", { name: "Save Link" }));
    expect(node("hero")?.buttonLink).toEqual({ kind: "page", pageId: expect.any(String) });
  });

  it("checks addresses before saving, and adds https:// to a bare web address", async () => {
    const { node, user } = setUp();

    await user.click(screen.getByRole("button", { name: "Add Link…" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("radio", { name: "Email" }));
    await user.click(dialog.getByRole("textbox", { name: "Email address" }));
    await user.paste("not an address");
    // Under the field, which it describes (#391).
    expect(
      dialog.getByRole("textbox", { name: "Email address" }).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(dialog.getByText(/Enter an email address/)).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Save Link" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.click(dialog.getByRole("radio", { name: "Web address" }));
    await user.click(dialog.getByRole("textbox", { name: "Web address" }));
    await user.paste("example.com/menu");
    await user.click(dialog.getByRole("button", { name: "Save Link" }));

    expect(node("hero")?.buttonLink).toEqual({ kind: "url", href: "https://example.com/menu" });
  });

  it("edits a phone link, and removes a link", async () => {
    const { node, labels, user } = setUp({ kind: "phone", number: "01234 567890" });
    expect(screen.getByText("01234 567890")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Change Link…" }));
    const number = within(screen.getByRole("dialog")).getByRole("textbox", {
      name: "Phone number",
    });
    expect((number as HTMLInputElement).value).toBe("01234 567890");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Remove Link" }));

    expect(node("hero")?.buttonLink).toBeUndefined();
    expect(labels()).toEqual(["Changed Hero button link"]);
  });

  it("sets the link of an element in the shared Footer in the site's layout (F-ED-7)", async () => {
    const { session, user } = setUp();
    act(() => {
      session.edit("insert", "Added Hero", (draft) => {
        const hero = draft.pages[draft.homePageId]?.doc.content.find((n) => n.props.id === "hero");
        if (hero !== undefined)
          draft.layout.footer.push({ ...hero, props: { ...hero.props, id: "shared-hero" } });
      });
      session.select("shared-hero");
    });

    await user.click(screen.getByRole("button", { name: "Add Link…" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("radio", { name: "Web address" }));
    await user.click(dialog.getByRole("textbox", { name: "Web address" }));
    await user.paste("example.com");
    await user.click(dialog.getByRole("button", { name: "Save Link" }));

    const shared = session.history.document.getState().layout.footer.at(-1);
    expect(shared?.props.buttonLink).toEqual({ kind: "url", href: "https://example.com" });
    expect(session.history.entries().at(-1)?.label).toBe("Changed shared Hero button link");
  });

  it("shows a page path typed before link fields until it is replaced", () => {
    setUp("about");

    expect(screen.getByText("about")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change Link…" })).toBeTruthy();
  });

  describe("links to documents in Media (1.28)", () => {
    const addPrices = (session: ReturnType<typeof setUp>["session"]) =>
      session.edit("insert", "Added file", (draft) => {
        draft.media["prices" as MediaId] = {
          id: "prices" as MediaId,
          hash: "b".repeat(64),
          name: "prices",
          fileName: "Price list.pdf",
          kind: "file",
          mimeType: "application/pdf",
          size: 1200,
        };
      });

    it("links to a document, in a new tab by default, or as a download", async () => {
      const { session, node, user } = setUp();
      act(() => addPrices(session));

      await user.click(screen.getByRole("button", { name: "Add Link…" }));
      const dialog = within(screen.getByRole("dialog", { name: "Link" }));
      await user.click(dialog.getByRole("radio", { name: "File" }));
      expect(
        (dialog.getByRole("checkbox", { name: "Open in a new tab" }) as HTMLInputElement).checked,
      ).toBe(true);
      await user.click(
        dialog.getByRole("checkbox", { name: "Download the file instead of opening it" }),
      );
      await user.click(dialog.getByRole("button", { name: "Save Link" }));

      expect(node("hero")?.buttonLink).toEqual({
        kind: "file",
        mediaId: "prices",
        newTab: true,
        download: true,
      });
      expect(screen.getByText("Price list.pdf")).toBeTruthy();
    });

    it("asks for a document in Media first when there is none", async () => {
      const { user } = setUp();

      await user.click(screen.getByRole("button", { name: "Add Link…" }));
      const dialog = within(screen.getByRole("dialog", { name: "Link" }));
      await user.click(dialog.getByRole("radio", { name: "File" }));

      expect(dialog.getByText("Add a document to Media first, then link to it.")).toBeTruthy();
      expect(
        (dialog.getByRole("button", { name: "Save Link" }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });
});
