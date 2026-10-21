import type { CopiedElements, ImageMeta, MediaId, NodeDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it, vi } from "vitest";
import type { ClipboardReadResult } from "../../shared/ipc/clipboard.js";
import { createEditorSession, currentPage, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { addMedia } from "../media/media-commands.js";
import { copySelected, pasteElements, pasteTarget } from "./element-clipboard.js";

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
});
