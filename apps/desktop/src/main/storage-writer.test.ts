import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { ProjectStore } from "@webforge/storage";
import { TYPESCRIPT_HOOK } from "@webforge/test-utils";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_MEDIA_BYTES } from "../shared/ipc/media.js";
import { ProjectSession } from "./project-session.js";
import { createStorageWriter, type WriterThread } from "./storage-writer.js";

/** The open site, as a call for its opening reaches it (R6, #663). */
const scoped = (session: ProjectSession) => session.forSession(session.current()?.sessionId ?? "");

const tempDir = tempDirFactory("webforge-storage-writer-");

/** A thread that answers only when the test says, recording what it was sent. */
function fakeThread() {
  const listeners = new Map<string, (value: unknown) => void>();
  const sent: { message: unknown; transfer: readonly ArrayBuffer[] | undefined }[] = [];
  const thread: WriterThread = {
    postMessage: (message, transfer) => {
      sent.push({ message, transfer });
    },
    on: (event: string, listener: (value: never) => void) => {
      listeners.set(event, listener as (value: unknown) => void);
      return thread;
    },
    terminate: vi.fn(async () => {
      listeners.get("exit")?.(1);
      return 1;
    }),
  };
  return { thread, sent, emit: (event: string, value: unknown) => listeners.get(event)?.(value) };
}

const bytes = (...values: number[]) => ({ data: new Uint8Array(values) });

/** What the thread answers for a prepared JPEG. */
const preparedAnswer = (id: number) => ({
  id,
  outcome: {
    status: "prepared",
    hash: "a".repeat(64),
    size: 3,
    media: { kind: "image", mimeType: "image/jpeg", width: 4, height: 3 },
  },
});

const target = { sitePath: "site.wforge", mediaId: "photo", originalName: "a.jpg" };

describe("createStorageWriter", () => {
  it("starts its thread for the first import, and gives each step its own answer", async () => {
    const fake = fakeThread();
    const start = vi.fn(() => fake.thread);
    const writer = createStorageWriter(start);

    const first = writer.prepare("a.jpg", bytes(1));
    const second = writer.prepare("b.txt", bytes(2));
    fake.emit("message", { id: 2, outcome: { status: "rejected", reason: "not-text" } });
    fake.emit("message", preparedAnswer(1));
    // Settled already: ignored.
    fake.emit("message", { id: 1, outcome: { status: "skipped" } });

    const prepared = await first;
    expect(prepared).toMatchObject({ status: "prepared", token: 1, hash: "a".repeat(64) });
    expect(await second).toEqual({ status: "rejected", reason: "not-text" });
    if (prepared.status !== "prepared") return;
    const stored = writer.store(prepared, target);
    fake.emit("message", { id: 3, outcome: { status: "stored" } });
    expect(await stored).toEqual({ status: "stored" });
    expect(fake.sent.map(({ message }) => message)).toContainEqual({
      id: 3,
      type: "store",
      prepared: 1,
      ...target,
    });
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("fails a step whose answer doesn't parse, or is another step's, rather than leaving it waiting", async () => {
    const fake = fakeThread();
    const writer = createStorageWriter(() => fake.thread);
    const preparing = writer.prepare("a.jpg", bytes(1));
    const storing = writer.prepare("b.jpg", bytes(2));

    fake.emit("message", "noise");
    fake.emit("message", { id: 1, outcome: { status: "prepared" } });
    fake.emit("message", { id: 2, outcome: { status: "stored" } });

    expect(await preparing).toEqual({ status: "failed" });
    expect(await storing).toEqual({ status: "failed" });
  });

  it("moves bytes with a buffer of their own to the thread, and copies a view of a larger one", () => {
    const fake = fakeThread();
    const writer = createStorageWriter(() => fake.thread);

    void writer.prepare("a.jpg", { data: new Uint8Array([1, 2, 3]) });
    void writer.prepare("b.jpg", { data: new Uint8Array([9, 1, 2, 3]).subarray(1) });
    void writer.prepare("c.jpg", { path: "C:Photosc.jpg" });

    expect(fake.sent.map(({ transfer }) => transfer?.length)).toEqual([1, 0, 0]);
  });

  it("copies pasted and downloaded bytes to the thread, which the caller may still use (#664)", async () => {
    const fake = fakeThread();
    const writer = createStorageWriter(() => fake.thread);
    const data = new Uint8Array([1, 2, 3]);

    const putting = writer.putBlobs("site.wforge", [{ data, mime: "image/png" }]);
    fake.emit("message", { id: 1, outcome: { status: "put", hashes: ["c".repeat(64)] } });

    expect(await putting).toEqual({ status: "put", hashes: ["c".repeat(64)] });
    expect(fake.sent[0]).toMatchObject({
      message: { type: "put-blobs", sitePath: "site.wforge" },
      transfer: [],
    });
    expect(data.byteLength).toBe(3);
    // An answer with a hash for each file, or none at all.
    const short = writer.putBlobs("site.wforge", [{ data, mime: "image/png" }]);
    fake.emit("message", { id: 2, outcome: { status: "put", hashes: [] } });
    expect(await short).toEqual({ status: "failed" });
    const cleaning = writer.cleanUp("site.wforge");
    fake.emit("message", {
      id: 3,
      outcome: { status: "cleaned", blobs: 2, bytes: 9, assets: 1, vacuumed: true },
    });
    expect(await cleaning).toEqual({
      status: "cleaned",
      blobs: 2,
      bytes: 9,
      assets: 1,
      vacuumed: true,
    });
    const wrong = writer.cleanUp("site.wforge");
    fake.emit("message", { id: 4, outcome: { status: "stored" } });
    expect(await wrong).toEqual({ status: "failed" });
  });

  it("tells the thread to forget an import that goes no further", async () => {
    const fake = fakeThread();
    const writer = createStorageWriter(() => fake.thread);
    const preparing = writer.prepare("a.jpg", bytes(1));
    fake.emit("message", preparedAnswer(1));
    const prepared = await preparing;
    if (prepared.status !== "prepared") throw new Error("not prepared");

    writer.discard(prepared);

    expect(fake.sent.at(-1)?.message).toEqual({ id: 2, type: "discard", prepared: 1 });
  });

  it("fails what a thread was doing when it ends, and starts another for the next import", async () => {
    const threads = [fakeThread(), fakeThread()];
    const start = vi.fn(() => (threads[start.mock.calls.length - 1] ?? fakeThread()).thread);
    const writer = createStorageWriter(start);

    const lost = writer.prepare("a.jpg", bytes(1));
    threads[0]?.emit("exit", 1);
    expect(await lost).toEqual({ status: "failed" });

    const next = writer.prepare("b.jpg", bytes(2));
    threads[1]?.emit("message", { id: 2, outcome: { status: "skipped" } });
    expect(await next).toEqual({ status: "skipped" });
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("stops its thread, failing what it was doing", async () => {
    const fake = fakeThread();
    const writer = createStorageWriter(() => fake.thread);
    const preparing = writer.prepare("a.jpg", bytes(1));

    await writer.stop();

    expect(fake.thread.terminate).toHaveBeenCalled();
    expect(await preparing).toEqual({ status: "failed" });
  });
});

describe("the storage writer thread (R13b)", () => {
  const threads: Worker[] = [];
  afterEach(async () => {
    for (const thread of threads.splice(0)) await thread.terminate();
  });

  /** The real thread, running the TypeScript sources. */
  const startThread = () => {
    const thread = new Worker(new URL("../worker/storage-writer.ts", import.meta.url), {
      execArgv: ["--disable-warning=ExperimentalWarning", "--import", TYPESCRIPT_HOOK],
    });
    threads.push(thread);
    return thread;
  };

  /** A 50 MB PNG: a real header claiming 2000 × 1500, then filler. */
  function bigPng(): Uint8Array {
    const bytes = new Uint8Array(MAX_MEDIA_BYTES);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 2000);
    view.setUint32(20, 1500);
    for (let at = 33; at < bytes.length; at += 4096) bytes[at] = at % 251;
    return bytes;
  }

  it("answers a job it can't read as failed, so the store gate is let go (#664)", async () => {
    const writer = createStorageWriter(startThread);
    const blob = { data: new Uint8Array([1]), mime: "image/png" };

    // Past the protocol's limit of 1000 files, which only the thread checks.
    expect(
      await writer.putBlobs(
        "site.wforge",
        Array.from({ length: 1001 }, () => blob),
      ),
    ).toEqual({
      status: "failed",
    });
    expect(await writer.putBlobs("site.wforge", [{ ...blob, mime: "" }])).toEqual({
      status: "failed",
    });
    await writer.stop();
  });

  it("stores a 50 MB image keeping the main thread busy for less than 50 ms", async () => {
    const dir = tempDir();
    const sitePath = join(dir, "Large.wforge");
    ProjectStore.create(sitePath, { name: "Large" }).close();
    const photo = join(dir, "poster.png");
    writeFileSync(photo, bigPng());
    const session = new ProjectSession({}, { writer: createStorageWriter(startThread) });
    // Opening the site starts the writer thread, before the import.
    await session.open(sitePath);
    try {
      await expectQuickImport(session, photo);
    } finally {
      await session.close();
    }
  }, 60_000);

  it("cleans a closing site's file up keeping the main thread busy for less than 50 ms (#664)", async () => {
    const sitePath = join(tempDir(), "Cluttered.wforge");
    const store = ProjectStore.create(sitePath, { name: "Cluttered" });
    // 120 MB that nothing names any more, as undone imports leave behind: garbage collection, then
    // a VACUUM that rewrites the file.
    for (let index = 0; index < 12; index += 1) {
      store.putBlob(new Uint8Array(10 * 1024 * 1024).fill(index + 1), "image/png");
    }
    store.close();
    const before = statSync(sitePath).size;
    const session = new ProjectSession({}, { writer: createStorageWriter(startThread) });
    await session.open(sitePath);

    const cpu = process.threadCpuUsage();
    await session.close();
    const { user, system } = process.threadCpuUsage(cpu);

    // As for an import: this thread's CPU time, which an IPC call would wait behind.
    expect((user + system) / 1000).toBeLessThan(50);
    expect(statSync(sitePath).size).toBeLessThan(before / 10);
    ProjectStore.open(sitePath).close();
  }, 120_000);

  /** Imports `photo`, checking the main thread is never held up for 50 ms or more. */
  async function expectQuickImport(session: ProjectSession, photo: string) {
    // The CPU time this thread spent while the import ran, which an IPC call would wait behind: a
    // total under 50 ms means no single hold-up reached 50 ms. CPU time rather than wall or
    // event-loop time, which a loaded machine stretches (CI runs test files side by side). It
    // doesn't count waiting for the disk, so the import also writes nothing on this thread: its
    // bytes, asset and fingerprint are all the writer's (SiteFileWriter).
    const before = process.threadCpuUsage();
    const result = await scoped(session).importFile("poster", "poster.png", { path: photo });
    const { user, system } = process.threadCpuUsage(before);
    const busy = (user + system) / 1000;

    expect(result).toMatchObject({
      status: "stored",
      size: MAX_MEDIA_BYTES,
      media: { kind: "image", mimeType: "image/png", width: 2000, height: 1500 },
    });
    expect(busy).toBeLessThan(50);
    const blob = await scoped(session).readMedia(result.status === "stored" ? result.hash : "");
    expect(blob?.data.byteLength).toBe(MAX_MEDIA_BYTES);
  }
});
