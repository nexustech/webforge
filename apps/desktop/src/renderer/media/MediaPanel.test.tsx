// @vitest-environment happy-dom
import {
  type ImageMeta,
  type MediaId,
  type MediaMeta,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaImportResult } from "../../shared/ipc-contract.js";
import type { EditorSession } from "../editor/editor-session.js";
import { sessionWith } from "../testing/fixtures.js";
import { MediaPanel } from "./MediaPanel.js";
import { addMedia } from "./media-commands.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const photo: ImageMeta = {
  id: "photo" as MediaId,
  hash: "a".repeat(64),
  name: "shop",
  fileName: "shop.jpg",
  kind: "image",
  mimeType: "image/jpeg",
  width: 1600,
  height: 1000,
  alt: "",
};
const prices: MediaMeta = {
  id: "prices" as MediaId,
  hash: "b".repeat(64),
  name: "prices",
  fileName: "prices.pdf",
  kind: "file",
  mimeType: "application/pdf",
};

let container: HTMLDivElement;
let root: Root;
let session: EditorSession;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  session = sessionWith();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const imported = (items: MediaMeta[]): MediaImportResult => ({
  status: "imported",
  items,
  rejected: [],
});

async function render(api: Partial<{ import: () => Promise<MediaImportResult> }> = {}) {
  const media = {
    import: vi.fn(api.import ?? (async () => imported([photo]))),
    choose: vi.fn(async () => imported([photo])),
  };
  const notify = vi.fn();
  await act(async () =>
    root.render(
      <MediaPanel
        session={session}
        media={media}
        notify={notify}
        imageUrl={(item, size) => `test://${size}/${item.name}`}
      />,
    ),
  );
  return { media, notify };
}

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((element) =>
    (element.getAttribute("aria-label") ?? element.textContent ?? "").includes(name),
  );
const lastLabel = () => {
  const { entries, cursor } = session.history.state.getState();
  return entries[cursor - 1]?.label;
};
const media = () => session.history.document.getState().media;

describe("MediaPanel", () => {
  it("says when there is nothing yet, and adds files from the dialog", async () => {
    const { media: api } = await render();
    expect(container.textContent).toContain("No images or files yet.");

    await act(async () => button("Add images or files")?.click());

    expect(api.choose).toHaveBeenCalled();
    expect(lastLabel()).toBe("Added image 'shop.jpg'");
    // The new image is chosen at once, with its details.
    expect(container.querySelector('[aria-label="shop.jpg details"]')).not.toBeNull();
    expect(container.querySelector("li img")?.getAttribute("src")).toBe("test://thumbnail/shop");
  });

  it("imports files dropped on the panel and says what wasn't added", async () => {
    const { media: api, notify } = await render({
      import: async () => ({
        status: "imported",
        items: [prices],
        rejected: [{ fileName: "logo.gif", reason: "unsupported" }],
      }),
    });
    const file = new File([new Uint8Array([0x25])], "prices.pdf", { type: "application/pdf" });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.assign(drop, { dataTransfer: { files: [file], types: ["Files"] } });

    await act(async () => {
      container.querySelector("section")?.dispatchEvent(drop);
    });

    expect(api.import).toHaveBeenCalledWith(expect.any(String), [
      { fileName: "prices.pdf", data: new Uint8Array([0x25]) },
    ]);
    expect(media()[prices.id]).toEqual(prices);
    expect(notify).toHaveBeenCalledWith(
      "logo.gif isn't an image or document Media takes, so it wasn't added.",
    );
  });

  it("edits alt text as one undo step when the field is left", async () => {
    addMedia(session, [photo]);
    await render();
    await act(async () => button("shop.jpg")?.click());
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (input === null) throw new Error("no alt text field");

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    for (const text of ["O", "Ou", "Our shop"]) {
      await act(async () => {
        setValue?.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });

    expect(media()[photo.id]).toMatchObject({ alt: "Our shop" });
    expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
      "Added image 'shop.jpg'",
      "Edited alt text of 'shop.jpg'",
    ]);
  });

  it("crops to a preset and moves the focal point with the arrow keys", async () => {
    addMedia(session, [photo]);
    await render();
    await act(async () => button("shop.jpg")?.click());

    await act(async () => button("Square")?.click());
    expect(lastLabel()).toBe("Cropped image 'shop.jpg'");
    expect(media()[photo.id]).toMatchObject({ crop: { width: 0.625, height: 1 } });

    const marker = button("Focal point");
    expect(marker?.getAttribute("aria-label")).toBe("Focal point, 50% across, 50% down");
    await act(async () => {
      marker?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(lastLabel()).toBe("Changed focal point of 'shop.jpg'");
    expect(media()[photo.id]).toMatchObject({ focal: { x: 0.55, y: 0.5 } });
    expect(button("Focal point")?.getAttribute("aria-label")).toBe(
      "Focal point, 55% across, 50% down",
    );
  });

  it("replaces and deletes the chosen item", async () => {
    addMedia(session, [photo]);
    const { media: api } = await render();
    api.choose.mockResolvedValueOnce(
      imported([{ ...photo, id: "new" as MediaId, hash: "c".repeat(64), fileName: "new.jpg" }]),
    );
    await act(async () => button("shop.jpg")?.click());

    await act(async () => button("Replace")?.click());
    expect(lastLabel()).toBe("Replaced image 'shop.jpg'");
    expect(Object.keys(media())).toEqual(["photo"]);
    expect(media()[photo.id]).toMatchObject({ hash: "c".repeat(64), fileName: "new.jpg" });

    await act(async () => button("Delete")?.click());
    expect(lastLabel()).toBe("Deleted image 'new.jpg'");
    expect(media()).toEqual({});
    expect(container.textContent).toContain("No images or files yet.");
  });

  it("warns before deleting an image or a document used only inside a shared section (F-ED-23)", async () => {
    addMedia(session, [photo, prices]);
    session.edit("insert", "Added a copy", (draft) => {
      draft.sharedSections["offer" as SharedSectionId] = {
        id: "offer" as SharedSectionId,
        name: "Weekly offer",
        section: {
          type: "Hero",
          props: {
            id: "h",
            title: "Offer",
            image: { mediaId: photo.id },
            buttonLink: { kind: "file", mediaId: prices.id },
          },
        },
      };
      draft.pages[draft.homePageId]?.doc.content.push({
        type: SHARED_COPY_TYPE,
        props: { id: "copy", sharedSectionId: "offer" as SharedSectionId },
      });
    });
    await render();
    await act(async () => button("shop.jpg")?.click());

    await act(async () => button("Delete")?.click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      "It's used on 1 page.",
    );
    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
        .find((element) => element.textContent === "Cancel")
        ?.click();
    });

    await act(async () => button("prices.pdf")?.click());
    await act(async () => button("Delete")?.click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
      "1 page links to it.",
    );
    expect(media()[photo.id]).toEqual(photo);
    expect(media()[prices.id]).toEqual(prices);
  });

  it("warns before deleting an image only a hidden copy or an unplaced shared section uses (F-ED-23)", async () => {
    addMedia(session, [photo, prices]);
    session.edit("insert", "Added shared sections", (draft) => {
      const offer = "offer" as SharedSectionId;
      draft.sharedSections[offer] = {
        id: offer,
        name: "Weekly offer",
        section: { type: "Hero", props: { id: "h", title: "Offer", image: { mediaId: photo.id } } },
      };
      const files = "files" as SharedSectionId;
      draft.sharedSections[files] = {
        id: files,
        name: "Price lists",
        section: {
          type: "Hero",
          props: { id: "f", title: "Prices", buttonLink: { kind: "file", mediaId: prices.id } },
        },
      };
      // Hidden in Layers: still a placement, which shows the image again once shown.
      draft.pages[draft.homePageId]?.doc.content.push({
        type: SHARED_COPY_TYPE,
        props: { id: "copy", sharedSectionId: offer, hidden: true },
      });
    });
    await render();
    const dialogText = () => document.querySelector('[role="alertdialog"]')?.textContent;
    const cancel = () =>
      act(async () => {
        [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
          .find((element) => element.textContent === "Cancel")
          ?.click();
      });

    await act(async () => button("shop.jpg")?.click());
    await act(async () => button("Delete")?.click());
    expect(dialogText()).toContain("It's used on 1 page.");
    await cancel();

    // "Price lists" is on no page: deleting what it links to still warns, by its name.
    await act(async () => button("prices.pdf")?.click());
    await act(async () => button("Delete")?.click());
    expect(dialogText()).toContain(
      "The shared section 'Price lists' links to it, and isn't on any page yet.",
    );
    await cancel();
    expect(media()[prices.id]).toEqual(prices);

    // Without the copy, "Weekly offer" is on no page either.
    session.edit("remove", "Deleted the copy", (draft) => {
      draft.pages[draft.homePageId]?.doc.content.pop();
    });
    await act(async () => button("shop.jpg")?.click());
    await act(async () => button("Delete")?.click());
    expect(dialogText()).toContain(
      "It's used in the shared section 'Weekly offer', which isn't on any page yet.",
    );
  });

  it("warns before deleting an image pages use, and Undo brings it back for them", async () => {
    addMedia(session, [photo]);
    // The home page places the photo in a Hero.
    session.edit("insert", "Added Hero", (draft) => {
      draft.pages[draft.homePageId]?.doc.content.push({
        type: "Hero",
        props: { id: "hero", title: "Fresh bread", image: { mediaId: photo.id } },
      });
    });
    await render();
    await act(async () => button("shop.jpg")?.click());

    await act(async () => button("Delete")?.click());
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain("Delete shop.jpg?");
    expect(dialog?.textContent).toContain("It's used on 1 page.");
    // Cancel keeps it.
    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
        .find((element) => element.textContent === "Cancel")
        ?.click();
    });
    expect(media()[photo.id]).toEqual(photo);

    await act(async () => button("Delete")?.click());
    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')]
        .find((element) => element.textContent === "Delete")
        ?.click();
    });
    expect(lastLabel()).toBe("Deleted image 'shop.jpg'");
    expect(media()).toEqual({});
    // The placement still points at the image, so one Undo restores both.
    act(() => {
      session.history.undo();
    });
    expect(media()[photo.id]).toEqual(photo);
    const home = session.history.document.getState();
    expect(home.pages[home.homePageId]?.doc.content.at(-1)?.props.image).toEqual({
      mediaId: photo.id,
    });
  });

  it("shows a document's type icon, size and type, never a preview (1.28)", async () => {
    addMedia(session, [
      {
        ...prices,
        id: "sheet" as MediaId,
        hash: "c".repeat(64),
        name: "stock",
        fileName: "Stock.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1_468_006,
      },
    ]);
    await render();

    expect(container.querySelector("li")?.textContent).toBe("1.4 MBStock.xlsx");
    await act(async () => button("Stock.xlsx")?.click());
    expect(container.querySelector('[aria-label="Stock.xlsx details"]')?.textContent).toContain(
      "Excel spreadsheet, 1.4 MB",
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows a file without an image, with Replace and Delete only", async () => {
    addMedia(session, [prices]);
    await render();
    await act(async () => button("prices.pdf")?.click());

    expect(container.querySelector('[aria-label="prices.pdf details"]')).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(button("Square")).toBeUndefined();
    expect(button("Replace")).toBeDefined();
  });
});
