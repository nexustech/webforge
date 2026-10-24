import type { MediaId, MediaMeta } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { MAX_MEDIA_BYTES } from "../../shared/ipc/media.js";
import type { MediaImportResult } from "../../shared/ipc-contract.js";
import { setFailureLog } from "../log.js";
import { type DroppedFileLike, importDroppedFiles, importItems } from "./import-media.js";

const prices: MediaMeta = {
  id: "prices" as MediaId,
  hash: "b".repeat(64),
  name: "prices",
  fileName: "prices.pdf",
  kind: "file",
  mimeType: "application/pdf",
};

/** A dropped file of `size` bytes that only says so; reading it gives a few bytes. */
function file(name: string, size: number): DroppedFileLike & { read: ReturnType<typeof vi.fn> } {
  const read = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer);
  return { name, size, arrayBuffer: read, read };
}

const imported = (items: MediaMeta[] = []): MediaImportResult => ({
  status: "imported",
  items,
  rejected: [],
});

describe("importDroppedFiles", () => {
  it("sends files in requests of at most 100 MB, and doesn't read one over 50 MB", async () => {
    const half = MAX_MEDIA_BYTES / 2;
    const files = [
      file("a.jpg", MAX_MEDIA_BYTES),
      file("b.jpg", half),
      file("c.jpg", half + 1),
      file("huge.jpg", MAX_MEDIA_BYTES + 1),
      file("d.pdf", 10),
    ];
    const media = {
      import: vi.fn(async (_session: string, sent: readonly { fileName: string }[]) =>
        imported(sent.map((one) => ({ ...prices, id: one.fileName as MediaId }))),
      ),
    };

    const result = await importDroppedFiles(files, media);

    expect(media.import.mock.calls.map(([, sent]) => sent.map((one) => one.fileName))).toEqual([
      ["a.jpg", "b.jpg"],
      ["c.jpg", "d.pdf"],
    ]);
    expect(files[3]?.read).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: "imported",
      items: [{ id: "a.jpg" }, { id: "b.jpg" }, { id: "c.jpg" }, { id: "d.pdf" }],
      rejected: [{ fileName: "huge.jpg", reason: "too-large" }],
    });
  });

  it("sends at most 50 files at a time, and stops at a failed request", async () => {
    const files = Array.from({ length: 51 }, (_, index) => file(`${index}.png`, 1));
    const media = {
      import: vi
        .fn<() => Promise<MediaImportResult>>()
        .mockResolvedValueOnce({ status: "failed", reason: "read-only" }),
    };

    await expect(importDroppedFiles(files, media)).resolves.toEqual({
      status: "failed",
      reason: "read-only",
    });
    expect(media.import).toHaveBeenCalledTimes(1);
  });
});

describe("importDroppedFiles, unreadable entries", () => {
  it("lists a dropped folder as not added, and still imports the rest", async () => {
    const folder = file("Photos", 0);
    folder.read.mockRejectedValue(new Error("NotFoundError"));
    const media = { import: vi.fn(async () => imported([prices])) };

    await expect(importDroppedFiles([folder, file("prices.pdf", 10)], media)).resolves.toEqual({
      status: "imported",
      items: [prices],
      rejected: [{ fileName: "Photos", reason: "unsupported" }],
    });
    expect(media.import).toHaveBeenCalledWith(expect.any(String), [
      { fileName: "prices.pdf", data: new Uint8Array([1, 2, 3]) },
    ]);
    await expect(importDroppedFiles([folder], media)).resolves.toMatchObject({ items: [] });
    expect(media.import).toHaveBeenCalledTimes(1);
  });
});

describe("importItems", () => {
  it("returns what was imported and says what wasn't", async () => {
    const notify = vi.fn();

    const added = await importItems(
      async () => ({
        status: "imported",
        items: [prices],
        rejected: [
          { fileName: "logo.gif", reason: "unsupported" },
          { fileName: "poster.png", reason: "too-large" },
          { fileName: "notes.txt", reason: "not-text" },
        ],
      }),
      notify,
    );

    expect(added).toEqual([prices]);
    expect(notify.mock.calls).toEqual([
      ["logo.gif isn't an image or document Media takes, so it wasn't added."],
      ["poster.png is too large. Media takes files up to 50 MB and images up to 50 megapixels."],
      ["notes.txt isn't plain text, so it wasn't added. It may be another kind of file renamed."],
    ]);
  });

  it("says why nothing was imported, and stays quiet when the user cancels", async () => {
    const notify = vi.fn();

    await expect(
      importItems(async () => ({ status: "failed", reason: "read-only" }), notify),
    ).resolves.toEqual([]);
    await importItems(async () => {
      throw new Error("IPC gone");
    }, notify);
    await importItems(async () => ({ status: "canceled" }), notify);

    expect(notify.mock.calls).toEqual([
      ["This site is read-only, so nothing can be added to it."],
      ["Webforge couldn't add the files."],
    ]);
  });

  it("logs an import that failed by the error's code (R12)", async () => {
    const failures = vi.fn(async () => null);
    setFailureLog(failures);

    await importItems(async () => {
      throw new TypeError("Cannot read '/home/ana/photo.jpg'");
    }, vi.fn());

    expect(failures).toHaveBeenCalledExactlyOnceWith("media.import", "TypeError");
    setFailureLog(undefined);
  });
});
