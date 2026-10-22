import type { CopiedElements, ImageMeta, MediaId, MediaMeta, NodeDoc } from "@webforge/model";
import { type ComponentLibrary, siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import type { ClipboardReadResult } from "../../shared/ipc/clipboard.js";

/** A file a paste didn't add to Media, and why. */
type RejectedFile = Extract<ClipboardReadResult, { status: "media" }>["rejected"][number];

import { createEditorSession, currentPage, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { addMedia } from "../media/media-commands.js";
import { copySelected, pasteElements, pasteTarget } from "./element-clipboard.js";

const prices: MediaMeta = {
  id: "prices" as MediaId,
  hash: "b".repeat(64),
  name: "prices",
  fileName: "prices.pdf",
  kind: "file",
  mimeType: "application/pdf",
};
const photo: ImageMeta = {
  id: "photo" as MediaId,
  hash: "a".repeat(64),
  name: "shop",
  fileName: "shop.jpg",
  kind: "image",
  mimeType: "image/jpeg",
  width: 1600,
  height: 1000,
  alt: "Our shop",
};

/** A clipboard that keeps what was copied, as the main process would; or holds `held`. */
function fakeClipboard(held?: ClipboardReadResult) {
  let copied: CopiedElements | undefined;
  return {
    write: vi.fn(async (elements: CopiedElements) => {
      copied = structuredClone(elements);
      return { status: "copied" } as const;
    }),
    read: vi.fn(
      async (): Promise<ClipboardReadResult> =>
        held ??
        (copied === undefined ? { status: "empty" } : { status: "elements", elements: copied }),
    ),
  };
}

const content = (session: EditorSession) => currentPage(session)?.doc.content ?? [];
const sectionContent = (session: EditorSession) =>
  (content(session)[0]?.props.content ?? []) as NodeDoc[];
const labels = (session: EditorSession) =>
  session.history.state.getState().entries.map((entry) => entry.label);
const select = (session: EditorSession, nodeId: string | null) => session.ui.setState({ nodeId });

describe("copy and paste (1.25)", () => {
  it("pastes a copy after the selected element with new ids, as one step that selects it", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const clipboard = fakeClipboard();
    const notify = vi.fn();
    select(session, "heading-1");

    expect(await copySelected(session, clipboard, notify)).toBe(true);
    expect(await pasteElements(session, clipboard, notify)).toBe(true);

    const [heading, pasted, text] = sectionContent(session);
    expect(heading?.props.id).toBe("heading-1");
    expect(pasted).toMatchObject({ type: "Heading", props: { text: heading?.props.text } });
    expect(pasted?.props.id).not.toBe("heading-1");
    expect(text?.type).toBe("Text");
    expect(session.ui.getState().nodeId).toBe(pasted?.props.id);
    expect(labels(session)).toEqual(["Pasted Heading"]);
    expect(notify).not.toHaveBeenCalled();

    session.history.undo();
    expect(sectionContent(session).map((node) => node.props.id)).toEqual(["heading-1", "text-1"]);
  });

  it("cuts the selection as one step once it is copied, and pastes it back", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const clipboard = fakeClipboard();
    select(session, "text-1");

    await copySelected(session, clipboard, vi.fn(), true);
    expect(sectionContent(session).map((node) => node.type)).toEqual(["Heading"]);
    expect(session.ui.getState().nodeId).toBeNull();

    // A section takes the pasted Text at its end.
    select(session, "section-1");
    await pasteElements(session, clipboard, vi.fn());
    expect(sectionContent(session).map((node) => node.type)).toEqual(["Heading", "Text"]);
    expect(labels(session)).toEqual(["Cut Text", "Pasted Text"]);
  });

  it("pastes into another site with the images the elements show, in the same step", async () => {
    const first = createEditorSession(siteLibrary, starterSite());
    addMedia(first, [photo]);
    first.edit("insert", "Added Hero", (draft) => {
      draft.pages[draft.homePageId]?.doc.content.push({
        type: "Hero",
        props: { id: "hero", title: "Fresh bread", image: { mediaId: photo.id } },
      });
    });
    const clipboard = fakeClipboard();
    select(first, "hero");
    await copySelected(first, clipboard, vi.fn());
    expect(clipboard.write).toHaveBeenCalledWith(
      expect.objectContaining({ media: [expect.objectContaining({ id: "photo" })] }),
    );

    const second = createEditorSession(siteLibrary, starterSite());
    await pasteElements(second, clipboard, vi.fn());

    expect(content(second).at(-1)).toMatchObject({
      type: "Hero",
      props: { image: { mediaId: "photo" } },
    });
    expect(second.history.document.getState().media[photo.id]).toMatchObject({ hash: photo.hash });
    second.history.undo();
    expect(second.history.document.getState().media).toEqual({});
  });

  it("keeps an image the site already has as it is", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    addMedia(session, [{ ...photo, alt: "Changed since" }]);
    const hero: NodeDoc = { type: "Hero", props: { id: "hero", image: { mediaId: photo.id } } };
    const clipboard = fakeClipboard({
      status: "elements",
      elements: { nodes: [hero], media: [photo] },
    });

    await pasteElements(session, clipboard, vi.fn());

    expect(session.history.document.getState().media[photo.id]).toMatchObject({
      alt: "Changed since",
    });
  });

  it("leaves out an anchor the Header or Footer already uses", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    session.edit("page", "Anchored the footer", (draft) => {
      draft.layout.footer.push({
        type: "Footer",
        props: { id: "footer", advanced: { anchorId: "contact" } },
      });
    });
    const section: NodeDoc = {
      type: "Section",
      props: { id: "s", advanced: { anchorId: "contact" }, content: [] },
    };

    await pasteElements(
      session,
      fakeClipboard({ status: "elements", elements: { nodes: [section], media: [] } }),
      vi.fn(),
    );

    expect(content(session).at(-1)?.props).not.toHaveProperty("advanced");
  });

  it("refuses a place that doesn't take the elements, changing nothing", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const question: NodeDoc = { type: "FaqItem", props: { id: "q", question: "Open on Sundays?" } };
    const notify = vi.fn();

    expect(
      await pasteElements(
        session,
        fakeClipboard({ status: "elements", elements: { nodes: [question], media: [] } }),
        notify,
      ),
    ).toBe(false);

    expect(notify).toHaveBeenCalledWith(
      "That Question can't go here. Select a place that takes it, then paste.",
    );
    expect(labels(session)).toEqual([]);
  });

  it("says when there is nothing to paste or the paste failed", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const notify = vi.fn();

    await pasteElements(session, fakeClipboard(), notify);
    await pasteElements(session, fakeClipboard({ status: "failed", reason: "read-only" }), notify);
    await pasteElements(session, { read: vi.fn().mockRejectedValue(new Error("gone")) }, notify);

    expect(notify.mock.calls.map(([message]) => message)).toEqual([
      "There's nothing to paste. Copy a section or element first.",
      "This site is read-only, so nothing can be pasted into it.",
      "Webforge couldn't paste that.",
    ]);
  });

  it("copies nothing without a selection, and says when a copy failed", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    const notify = vi.fn();
    const clipboard = {
      write: vi.fn(async () => ({ status: "failed", reason: "unknown" }) as const),
    };

    expect(await copySelected(session, clipboard, notify)).toBe(false);
    expect(clipboard.write).not.toHaveBeenCalled();

    select(session, "heading-1");
    expect(await copySelected(session, clipboard, notify, true)).toBe(false);
    expect(notify).toHaveBeenCalledWith("Webforge couldn't copy that.");
    // A cut whose copy failed removes nothing.
    expect(sectionContent(session)).toHaveLength(2);
  });

  it("puts several elements where the first goes, if that place takes them all", () => {
    const page = content(createEditorSession(siteLibrary, starterSite()));
    const heading: NodeDoc = { type: "Heading", props: { id: "h" } };
    const section: NodeDoc = { type: "Section", props: { id: "s" } };

    expect(pasteTarget(siteLibrary, page, [heading, heading], "heading-1")).toEqual({
      parentId: "section-1",
      slot: "content",
      index: 1,
    });
    expect(pasteTarget(siteLibrary, page, [heading, section], "heading-1")).toBeUndefined();
    expect(pasteTarget(siteLibrary, page, [], null)).toBeUndefined();
  });

  it("cuts past elements whose list fields hold plain items, not elements", async () => {
    const session = createEditorSession(siteLibrary, starterSite());
    session.edit("insert", "Added a list", (draft) => {
      const section = draft.pages[draft.homePageId]?.doc.content[0];
      const list = section?.props.content;
      if (Array.isArray(list)) {
        list.unshift({
          type: "Text",
          props: { id: "links", text: "<p>Links</p>", items: [{ label: "Opening times" }] },
        });
      }
    });
    select(session, "text-1");

    expect(await copySelected(session, fakeClipboard(), vi.fn(), true)).toBe(true);

    expect(sectionContent(session).map((node) => node.props.id)).toEqual(["links", "heading-1"]);
  });

  describe("image files and copied images (F-ED-16)", () => {
    const media = (items: ImageMeta[] | MediaMeta[], rejected: RejectedFile[] = []) =>
      fakeClipboard({ status: "media", items, rejected });
    const withHero = () => {
      const session = createEditorSession(siteLibrary, starterSite());
      session.edit("insert", "Added Hero", (draft) => {
        draft.pages[draft.homePageId]?.doc.content.push({
          type: "Hero",
          props: { id: "hero", title: "Fresh bread" },
        });
      });
      return session;
    };
    const site = (session: EditorSession) => session.history.document.getState();

    it("puts one image in the selected element's image field, joining Media in the same step", async () => {
      const session = withHero();
      select(session, "hero");

      expect(await pasteElements(session, media([photo]), vi.fn())).toBe(true);

      expect(content(session).at(-1)?.props.image).toEqual({ mediaId: photo.id });
      expect(site(session).media[photo.id]).toMatchObject({ fileName: "shop.jpg" });
      expect(labels(session).at(-1)).toBe("Pasted image 'shop.jpg'");
      session.history.undo();
      expect(content(session).at(-1)?.props).not.toHaveProperty("image");
      expect(site(session).media).toEqual({});
    });

    it("adds to Media, and says so, when nothing selected takes an image", async () => {
      const session = createEditorSession(siteLibrary, starterSite());
      const notify = vi.fn();
      select(session, "heading-1");

      await pasteElements(session, media([photo]), notify);
      await pasteElements(session, media([{ ...photo, id: "two" as MediaId }, prices]), notify);

      expect(Object.keys(site(session).media)).toEqual(["photo", "two", "prices"]);
      expect(sectionContent(session).map((node) => node.type)).toEqual(["Heading", "Text"]);
      expect(notify.mock.calls.map(([message]) => message)).toEqual([
        "Added 'shop.jpg' to Media",
        "Added 2 images and files to Media",
      ]);
    });

    it("keeps a PDF out of an image field, and names the files Media didn't take", async () => {
      const session = withHero();
      const notify = vi.fn();
      select(session, "hero");

      await pasteElements(
        session,
        media([prices], [{ fileName: "notes.txt", reason: "unsupported" }]),
        notify,
      );

      expect(content(session).at(-1)?.props).not.toHaveProperty("image");
      expect(site(session).media[prices.id]).toBeDefined();
      expect(notify.mock.calls.map(([message]) => message)).toEqual([
        "notes.txt isn't a JPEG, PNG or PDF, so it wasn't added.",
        "Added 'prices.pdf' to Media",
      ]);
      // Nothing Media takes: nothing pasted.
      expect(
        await pasteElements(
          session,
          media([], [{ fileName: "huge.png", reason: "too-large" }]),
          notify,
        ),
      ).toBe(false);
    });
  });

  describe("the shared Header and Footer (F-ED-7)", () => {
    /** The site library plus a shared Banner whose slot holds elements, as the Header could. */
    const library: ComponentLibrary = {
      components: {
        ...siteLibrary.components,
        Banner: {
          label: "Banner",
          place: "layout",
          fields: { content: { kind: "slot", label: "Content", allow: ["Heading"] } },
          defaults: { content: [] },
          render: () => null,
        },
      },
    };
    const withBanner = () => {
      const session = createEditorSession(library, starterSite());
      session.edit("page", "Added a banner", (draft) => {
        draft.layout.header.push({
          type: "Banner",
          props: {
            id: "banner",
            content: [{ type: "Heading", props: { id: "notice", text: "Closed Monday" } }],
          },
        });
      });
      return session;
    };
    const bannerContent = (session: EditorSession) =>
      session.history.document.getState().layout.header.at(-1)?.props.content;

    it("never copies or cuts the Header or Footer themselves", async () => {
      const session = createEditorSession(siteLibrary, starterSite());
      const clipboard = fakeClipboard();
      const notify = vi.fn();
      select(session, "header");

      expect(await copySelected(session, clipboard, notify, true)).toBe(false);

      expect(clipboard.write).not.toHaveBeenCalled();
      expect(notify).toHaveBeenCalledWith(
        "The Header is on every page, so it can't be copied or cut. Its elements can.",
      );
      expect(session.history.document.getState().layout.header).toHaveLength(1);
    });

    it("cuts an element from the shared layout as one step, so it goes from every page", async () => {
      const session = withBanner();
      const clipboard = fakeClipboard();
      select(session, "notice");

      expect(await copySelected(session, clipboard, vi.fn(), true)).toBe(true);

      expect(bannerContent(session)).toEqual([]);
      expect(sectionContent(session)).toHaveLength(2);
      expect(labels(session).at(-1)).toBe("Cut shared Heading");
      session.history.undo();
      expect(bannerContent(session)).toEqual([
        { type: "Heading", props: { id: "notice", text: "Closed Monday" } },
      ]);
    });

    it("never takes a Header or Footer the page hides", async () => {
      const session = withBanner();
      session.edit("page", "Hid the Header", (draft) => {
        const home = draft.pages[draft.homePageId];
        if (home !== undefined) home.settings.hideHeader = true;
      });
      const clipboard = fakeClipboard();
      select(session, "notice");

      expect(await copySelected(session, clipboard, vi.fn(), true)).toBe(false);
      expect(clipboard.write).not.toHaveBeenCalled();
      expect(bannerContent(session)).toHaveLength(1);
    });

    it("pastes into the page, never into the shared layout, with a shared element selected", async () => {
      const session = withBanner();
      const clipboard = fakeClipboard();
      select(session, "notice");
      await copySelected(session, clipboard, vi.fn());

      await pasteElements(session, clipboard, vi.fn());

      // Where the Add panel puts a Heading with nothing selected: the end of the last section.
      expect(sectionContent(session).map((node) => node.type)).toEqual([
        "Heading",
        "Text",
        "Heading",
      ]);
      expect(sectionContent(session).at(-1)?.props.text).toBe("Closed Monday");
      expect(bannerContent(session)).toHaveLength(1);
    });
  });
});
