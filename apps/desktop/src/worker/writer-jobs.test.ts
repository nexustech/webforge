import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { heroPhoto } from "@webforge/test-utils";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it, vi } from "vitest";
import { createWriterJobs } from "./writer-jobs.js";

// The storage writer's two steps (R13b): preparing reads, checks and hashes a file without
// touching the site; storing writes what was prepared.

const tempDir = tempDirFactory("webforge-writer-jobs-");

/** A writer that records what it is asked to store. */
function recordingWriter() {
  const put = vi.fn((_asset: unknown, hash?: string) => hash ?? "");
  const putBlobs = vi.fn((blobs: readonly unknown[]) => blobs.map(() => "b".repeat(64)));
  const cleanUp = vi.fn(() => ({ blobs: 1, bytes: 10, assets: 0, vacuumed: false }));
  const close = vi.fn();
  return { put, putBlobs, cleanUp, close, open: vi.fn(() => ({ put, putBlobs, cleanUp, close })) };
}

describe("createWriterJobs", () => {
  it("prepares without opening the site, then stores the prepared bytes with their hash", async () => {
    const writer = recordingWriter();
    const jobs = createWriterJobs(writer.open);
    const photo = join(tempDir(), "shop.jpg");
    writeFileSync(photo, heroPhoto());

    const prepared = await jobs.prepare(7, "shop.jpg", { path: photo });

    expect(prepared).toMatchObject({ status: "prepared", media: { kind: "image" } });
    expect(writer.open).not.toHaveBeenCalled();
    const target = { sitePath: "site.wforge", mediaId: "shop", originalName: "shop.jpg" };
    expect(jobs.store(7, target)).toEqual({ status: "stored" });
    expect(writer.open).toHaveBeenCalledWith("site.wforge");
    expect(writer.put).toHaveBeenCalledWith(
      expect.objectContaining({ mediaId: "shop", mime: "image/jpeg", originalName: "shop.jpg" }),
      prepared.status === "prepared" ? prepared.hash : "",
    );
    // Stored once: the bytes are gone.
    expect(jobs.store(7, target)).toEqual({ status: "failed" });
  });

  it("forgets what it discards, and stores nothing it didn't prepare", async () => {
    const writer = recordingWriter();
    const jobs = createWriterJobs(writer.open);
    await jobs.prepare(1, "shop.jpg", { data: heroPhoto() });

    jobs.discard(1);

    const target = { sitePath: "site.wforge", mediaId: "shop", originalName: "shop.jpg" };
    expect(jobs.store(1, target)).toEqual({ status: "failed" });
    expect(jobs.store(2, target)).toEqual({ status: "failed" });
    expect(writer.open).not.toHaveBeenCalled();
  });

  it("stores files and cleans up through a writer it closes, and says when that fails (#664)", () => {
    const writer = recordingWriter();
    const jobs = createWriterJobs(writer.open);
    const blobs = [{ data: new Uint8Array([1]), mime: "image/png" }];
    const asset = { mediaId: "pasted", originalName: "a.png" };

    expect(jobs.putBlobs("site.wforge", blobs, asset)).toEqual({
      status: "put",
      hashes: ["b".repeat(64)],
    });
    expect(writer.putBlobs).toHaveBeenCalledWith(blobs, asset);
    expect(jobs.cleanUp("site.wforge")).toEqual({
      status: "cleaned",
      blobs: 1,
      bytes: 10,
      assets: 0,
      vacuumed: false,
    });
    expect(writer.close).toHaveBeenCalledTimes(2);

    writer.cleanUp.mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    expect(jobs.cleanUp("site.wforge")).toEqual({ status: "failed" });
    expect(writer.close).toHaveBeenCalledTimes(3);
    const unopenable = createWriterJobs(() => {
      throw new Error("gone");
    });
    expect(unopenable.putBlobs("site.wforge", blobs)).toEqual({ status: "failed" });
  });

  it("skips a folder, and a file that is gone", async () => {
    const jobs = createWriterJobs(recordingWriter().open);
    const folder = join(tempDir(), "Photos");
    mkdirSync(folder);

    expect(await jobs.prepare(1, "Photos", { path: folder })).toEqual({ status: "skipped" });
    expect(await jobs.prepare(2, "gone.jpg", { path: join(folder, "gone.jpg") })).toEqual({
      status: "skipped",
    });
  });

  it.skipIf(process.platform === "win32")(
    "skips a pipe without waiting for something to write to it",
    async () => {
      const pipe = join(tempDir(), "photo.jpg");
      execFileSync("mkfifo", [pipe]);
      const jobs = createWriterJobs(recordingWriter().open);

      // Opening it to read would wait for a writer that never comes.
      expect(await jobs.prepare(1, "photo.jpg", { path: pipe })).toEqual({ status: "skipped" });
    },
    5_000,
  );
});
