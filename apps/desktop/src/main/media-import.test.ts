import { join } from "node:path";
import type { MediaId } from "@webforge/model";
import { heroPhoto, tempDirFactory } from "@webforge/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { importMediaFiles } from "./media-import.js";
import { ProjectSession } from "./project-session.js";

const tempDir = tempDirFactory("webforge-media-import-");
const sessions: ProjectSession[] = [];
// Registered after tempDirFactory's hook, so it runs first: the files close before their folder goes.
afterEach(async () => {
  for (const session of sessions.splice(0)) await session.close();
});

async function openSession(): Promise<ProjectSession> {
  const session = new ProjectSession();
  await session.create(join(tempDir(), "Bakery.wforge"));
  sessions.push(session);
  return session;
}

/** Ids in order, so the test can name them. */
function ids(...values: string[]) {
  const queue = [...values];
  return () => (queue.shift() ?? "spare") as MediaId;
}

const pdf = new TextEncoder().encode("%PDF-1.7\nprice list");

/** A PNG header that claims `width` × `height`: small bytes, a huge image. */
function pngClaiming(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("importMediaFiles", () => {
  it("stores the originals byte for byte and describes them as Media items", async () => {
    const session = await openSession();
    const photo = heroPhoto();

    const result = await importMediaFiles(
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
          size: pdf.byteLength,
        },
      ],
      rejected: [],
    });
    if (result.status !== "imported") return;
    const [image, file] = result.items;
    expect(new Uint8Array((await session.readMedia(image?.hash ?? ""))?.data ?? [])).toEqual(photo);
    expect(new Uint8Array((await session.readMedia(file?.hash ?? ""))?.data ?? [])).toEqual(pdf);
  });

  it("gives files with the same name different names, and imports the same bytes twice", async () => {
    const session = await openSession();
    const photo = heroPhoto();

    const result = await importMediaFiles(
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

  it("rejects files Media doesn't take and imports the rest", async () => {
    const session = await openSession();

    const result = await importMediaFiles(session, [
      { fileName: "logo.gif", data: new TextEncoder().encode("GIF89a") },
      { fileName: "photo.jpg", data: new TextEncoder().encode("not really a JPEG") },
      { fileName: "poster.png", data: undefined },
      { fileName: "huge.png", data: pngClaiming(100_000, 100_000) },
      { fileName: "prices.pdf", data: pdf },
      // A program renamed as text: refused as not being text.
      { fileName: "notes.txt", data: new Uint8Array([0x4d, 0x5a, 0x90, 0x00]) },
    ]);

    expect(result).toMatchObject({
      status: "imported",
      items: [{ fileName: "prices.pdf" }],
      rejected: [
        { fileName: "logo.gif", reason: "unsupported" },
        { fileName: "photo.jpg", reason: "unsupported" },
        { fileName: "poster.png", reason: "too-large" },
        { fileName: "huge.png", reason: "too-large" },
        { fileName: "notes.txt", reason: "not-text" },
      ],
    });
  });

  it("fails without an open site", async () => {
    expect(
      await importMediaFiles(new ProjectSession(), [{ fileName: "prices.pdf", data: pdf }]),
    ).toEqual({ status: "failed", reason: "no-site" });
  });
});

describe("ProjectSession.readMedia", () => {
  it("serves only Media files, never a site document or a missing blob", async () => {
    const session = await openSession();
    const stored = await session.storeAsset({
      mediaId: "doc",
      data: new TextEncoder().encode("{}"),
      mime: "application/json",
      originalName: "site.json",
    });

    expect(stored.status).toBe("stored");
    expect(stored.status === "stored" && (await session.readMedia(stored.hash))).toBeUndefined();
    expect(await session.readMedia("0".repeat(64))).toBeUndefined();
    expect(await new ProjectSession().readMedia("0".repeat(64))).toBeUndefined();
  });
});
