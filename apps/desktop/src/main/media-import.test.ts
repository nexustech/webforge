import { join } from "node:path";
import type { MediaId } from "@webforge/model";
import { heroPhoto, tempDirFactory } from "@webforge/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { importMediaFiles } from "./media-import.js";
import { ProjectSession } from "./project-session.js";

const tempDir = tempDirFactory("webforge-media-import-");
const sessions: ProjectSession[] = [];
// Registered after tempDirFactory's hook, so it runs first: the files close before their folder goes.
afterEach(() => {
  for (const session of sessions.splice(0)) session.close();
});

function openSession(): ProjectSession {
  const session = new ProjectSession();
  session.create(join(tempDir(), "Bakery.wforge"));
  sessions.push(session);
  return session;
}

/** Ids in order, so the test can name them. */
function ids(...values: string[]) {
  const queue = [...values];
  return () => (queue.shift() ?? "spare") as MediaId;
}

const pdf = new TextEncoder().encode("%PDF-1.7\nprice list");

describe("importMediaFiles", () => {
  it("stores the originals byte for byte and describes them as Media items", () => {
    const session = openSession();
    const photo = heroPhoto();

    const result = importMediaFiles(
      session,
      [
        { fileName: "Shop Front.JPG", data: photo },
        { fileName: "Prices.pdf", data: pdf },
      ],
      ids("photo", "prices"),
    );

    expect(result).toEqual({
      status: "imported",
      items: [
        {
          id: "photo",
          hash: expect.stringMatching(/^[0-9a-f]{64}$/),
          name: "shop-front",
          fileName: "Shop Front.JPG",
          kind: "image",
          mimeType: "image/jpeg",
          width: 1600,
          height: 1000,
          alt: "",
        },
        {
          id: "prices",
          hash: expect.stringMatching(/^[0-9a-f]{64}$/),
          name: "prices",
          fileName: "Prices.pdf",
          kind: "file",
          mimeType: "application/pdf",
        },
      ],
      rejected: [],
    });
    if (result.status !== "imported") return;
    const [image, file] = result.items;
    expect(new Uint8Array(session.readMedia(image?.hash ?? "")?.data ?? [])).toEqual(photo);
    expect(new Uint8Array(session.readMedia(file?.hash ?? "")?.data ?? [])).toEqual(pdf);
  });

  it("gives files with the same name different names, and imports the same bytes twice", () => {
    const session = openSession();
    const photo = heroPhoto();

    const result = importMediaFiles(
      session,
      [
        { fileName: "shop.jpg", data: photo },
        { fileName: "shop.jpg", data: photo },
      ],
      ids("one", "two"),
    );

    expect(
      result.status === "imported" && result.items.map((item) => [item.id, item.name]),
    ).toEqual([
      ["one", "shop"],
      ["two", "shop-2"],
    ]);
  });

  it("rejects files Media doesn't take and imports the rest", () => {
    const session = openSession();

    const result = importMediaFiles(session, [
      { fileName: "logo.gif", data: new TextEncoder().encode("GIF89a") },
      { fileName: "photo.jpg", data: new TextEncoder().encode("not really a JPEG") },
      { fileName: "poster.png", data: undefined },
      { fileName: "prices.pdf", data: pdf },
    ]);

    expect(result).toMatchObject({
      status: "imported",
      items: [{ fileName: "prices.pdf" }],
      rejected: [
        { fileName: "logo.gif", reason: "unsupported" },
        { fileName: "photo.jpg", reason: "unsupported" },
        { fileName: "poster.png", reason: "too-large" },
      ],
    });
  });

  it("fails without an open site", () => {
    expect(importMediaFiles(new ProjectSession(), [{ fileName: "prices.pdf", data: pdf }])).toEqual(
      { status: "failed", reason: "no-site" },
    );
  });
});

describe("ProjectSession.readMedia", () => {
  it("serves only Media files, never a site document or a missing blob", () => {
    const session = openSession();
    const stored = session.storeAsset({
      mediaId: "doc",
      data: new TextEncoder().encode("{}"),
      mime: "application/json",
      originalName: "site.json",
    });

    expect(stored.status).toBe("stored");
    expect(stored.status === "stored" && session.readMedia(stored.hash)).toBeUndefined();
    expect(session.readMedia("0".repeat(64))).toBeUndefined();
    expect(new ProjectSession().readMedia("0".repeat(64))).toBeUndefined();
  });
});
