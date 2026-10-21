import type { ImageMeta, MediaId, MediaMeta } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { createEditorSession, type EditorSession } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import {
  addMedia,
  cropMedia,
  cropPresetOf,
  deleteMedia,
  replaceMedia,
  setFocalPoint,
} from "./media-commands.js";

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

function sessionWith(...items: MediaMeta[]): EditorSession {
  const session = createEditorSession(siteLibrary, starterSite());
  if (items.length > 0) {
    addMedia(session, items);
  }
  return session;
}

const media = (session: EditorSession) => session.history.document.getState().media;
const lastLabel = (session: EditorSession) => {
  const { entries, cursor } = session.history.state.getState();
  return entries[cursor - 1]?.label;
};

describe("addMedia", () => {
  it("adds one item as one undo step named after its file", () => {
    const session = sessionWith(photo);

    expect(media(session)).toEqual({ photo });
    expect(lastLabel(session)).toBe("Added image 'shop.jpg'");
    session.history.undo();
    expect(media(session)).toEqual({});
  });

  it("adds several items in one step, with names no other item has", () => {
    const session = sessionWith(photo);

    addMedia(session, [
      { ...photo, id: "again" as MediaId },
      { ...photo, id: "third" as MediaId },
      prices,
    ]);

    expect(lastLabel(session)).toBe("Added 3 images and files");
    expect(Object.values(media(session)).map((item) => item.name)).toEqual([
      "shop",
      "shop-2",
      "shop-3",
      "prices",
    ]);
  });

  it("does nothing without items", () => {
    const session = sessionWith();
    addMedia(session, []);
    expect(session.history.state.getState().entries).toHaveLength(0);
  });
});

describe("replaceMedia", () => {
  it("swaps the file and keeps the id, name, alt text and focal point, dropping the crop", () => {
    const session = sessionWith({
      ...photo,
      alt: "Our shop front",
      focal: { x: 0.2, y: 0.3 },
      crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
    });

    replaceMedia(session, photo.id, {
      ...photo,
      id: "new" as MediaId,
      hash: "c".repeat(64),
      name: "shop-2",
      fileName: "shop-2024.png",
      mimeType: "image/png",
      width: 800,
      height: 800,
    });

    expect(lastLabel(session)).toBe("Replaced image 'shop.jpg'");
    expect(media(session)[photo.id]).toEqual({
      ...photo,
      hash: "c".repeat(64),
      fileName: "shop-2024.png",
      mimeType: "image/png",
      width: 800,
      height: 800,
      alt: "Our shop front",
      focal: { x: 0.2, y: 0.3 },
    });
  });

  it("replaces a file with an image, and ignores unknown items", () => {
    const session = sessionWith(prices);

    replaceMedia(session, prices.id, { ...photo, alt: "New" });
    replaceMedia(session, "missing" as MediaId, photo);

    expect(lastLabel(session)).toBe("Replaced file 'prices.pdf'");
    expect(media(session)[prices.id]).toMatchObject({
      id: "prices",
      name: "prices",
      kind: "image",
    });
  });
});

describe("deleteMedia", () => {
  it("deletes an item as an undoable step", () => {
    const session = sessionWith(photo, prices);

    deleteMedia(session, prices.id);
    expect(lastLabel(session)).toBe("Deleted file 'prices.pdf'");
    deleteMedia(session, photo.id);
    expect(lastLabel(session)).toBe("Deleted image 'shop.jpg'");
    expect(media(session)).toEqual({});

    session.history.undo();
    expect(media(session)[photo.id]).toEqual(photo);
    deleteMedia(session, "missing" as MediaId);
    expect(lastLabel(session)).toBe("Deleted file 'prices.pdf'");
  });
});

describe("cropMedia", () => {
  it("crops to a preset around the focal point, and back to the original", () => {
    const session = sessionWith({ ...photo, focal: { x: 0, y: 0.5 } });

    cropMedia(session, photo.id, "square");
    expect(lastLabel(session)).toBe("Cropped image");
    const cropped = media(session)[photo.id];
    expect(cropped?.kind === "image" && cropped.crop).toEqual({
      x: 0,
      y: 0,
      width: 0.625,
      height: 1,
    });
    expect(cropped?.kind === "image" && cropPresetOf(cropped)).toBe("square");

    cropMedia(session, photo.id, "original");
    const original = media(session)[photo.id];
    expect(original?.kind === "image" && original.crop).toBeUndefined();
    expect(original?.kind === "image" && cropPresetOf(original)).toBe("original");
  });

  it("leaves files alone", () => {
    const session = sessionWith(prices);
    cropMedia(session, prices.id, "square");
    expect(lastLabel(session)).toBe("Added file 'prices.pdf'");
  });
});

describe("cropPresetOf", () => {
  it("finds no preset for a crop of another shape", () => {
    expect(cropPresetOf({ ...photo, crop: { x: 0, y: 0, width: 0.3, height: 0.9 } })).toBe(
      undefined,
    );
  });
});

describe("setFocalPoint", () => {
  it("moves the focal point within the image, and the crop with it", () => {
    const session = sessionWith(photo);
    cropMedia(session, photo.id, "square");

    setFocalPoint(session, photo.id, { x: 1.4, y: 0.33333 });

    expect(lastLabel(session)).toBe("Changed focal point");
    expect(media(session)[photo.id]).toMatchObject({
      focal: { x: 1, y: 0.333 },
      crop: { x: 0.375, y: 0, width: 0.625, height: 1 },
    });
  });

  it("merges a run of arrow-key nudges into one step", () => {
    const session = sessionWith(photo);

    setFocalPoint(session, photo.id, { x: 0.55, y: 0.5 }, true);
    setFocalPoint(session, photo.id, { x: 0.6, y: 0.5 }, true);

    expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
      "Added image 'shop.jpg'",
      "Changed focal point",
    ]);
    expect(media(session)[photo.id]).toMatchObject({ focal: { x: 0.6, y: 0.5 } });
  });

  it("leaves files alone", () => {
    const session = sessionWith(prices);
    setFocalPoint(session, prices.id, { x: 0.5, y: 0.5 });
    expect(lastLabel(session)).toBe("Added file 'prices.pdf'");
  });
});
