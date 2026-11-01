# 0013. A second connection writes large blobs, behind a store gate

- Status: Accepted
- Date: 2026-10-25
- Related: #246 (R13), #408 (R13b), [architecture §3, §10](../../spec/01-architecture.md), [ADR 0003](0003-wforge-sqlite-storage.md)

## Context
The main process holds the open site's `.wforge` through one better-sqlite3 connection, whose calls are synchronous. Importing a 50 MB image there blocked the main thread for 1.4–2.0 s (measured 25 Oct 2026): about 350 ms of SHA-256, and the rest inserting the blob with the two fsyncs of a rollback-journal commit (`synchronous = FULL`, ADR 0003). Every IPC call and `webforge-media:` request waited meanwhile.

Hashing in slices on the main thread can't fix that: the insert is one statement. better-sqlite3 has no incremental blob writes, and splitting blobs into chunk rows would change the file format.

A second connection can do the write on another thread. But under the rollback journal (kept for cloud sync, ADR 0003) a connection that commits locks out the others, and a main-thread connection that met that lock would wait on the main thread, which is the block we are removing.

## Decision
1. **A storage writer** (`apps/desktop/src/worker/storage-writer.ts`, a `worker_threads` worker in the main process) imports one file at a time, through a connection of its own to the open file (`AssetWriter`, opened per import and closed after it):
   - It opens through the same `connect()` as every connection to a project (`packages/storage/src/connection.ts`), with the same hardening and write settings.
   - It takes an import in two steps. **Preparing** reads the file in 1 MB chunks (or takes transferred bytes), checks it is one Media takes, and hashes it, outside the gate: the site's file isn't touched, so saves go on however slow the file is to read (a network share). Only **storing** takes the gate's exclusive side.
   - A path is looked at before it is opened, and opened without waiting, so a pipe or a device is skipped rather than holding the import up.
   - It writes the blob, the asset row and the content fingerprint (#295) in one transaction, as `ProjectStore.putAsset` does. Nothing of an import is written on the main thread, not even the asset row, whose commit would wait for the disk there.
   - The thread starts when a site opens, so the first import doesn't pay for starting it.
   - Measured by the main thread's CPU time (`process.threadCpuUsage()`), a 50 MB import costs it 563 ms when stored on it, and 0–16 ms with the writer (`storage-writer.test.ts`). CPU time, because wall and event-loop time stretch on a loaded machine. Since CPU time doesn't count waiting for the disk, the import writes nothing on the main thread.
2. **One store gate** (`apps/desktop/src/main/store-gate.ts`) decides who uses the file:
   - **Shared:** the main process's work (reads, commits, backups) runs alongside other shared work.
   - **Exclusive:** the writer while it stores an import, and closing or replacing the site, run alone.
   - **Order:** work runs in the order it asked. A save asked for while an import writes lands after it, in order with the saves around it. Shared work asked for after waiting exclusive work queues behind it, so the writer is never starved.
3. **Nothing reaches the store outside the gate.** Every `ProjectSession` method that touches the store goes through it, and those methods are async. The backup gets a gated accessor from the `opened` event, not the store. A test wraps the store and fails on any call made while the gate isn't held.
4. **Closing waits for the gate at most 5 s,** then closes anyway, so a writer that never finishes can't hold up quitting or switching sites. A close let in while the writer still writes terminates its thread first. The import fails, and SQLite rolls its transaction back the next time the file opens.
5. **A save checks its session again once the gate lets it in** (R6), so a save or an import that queued behind a hand-off can't change the site that replaced its own.
6. **Dropped files travel by path, not as bytes.** The preload finds each one's path with `webUtils.getPathForFile` and sends the paths to the main process (`media:import-paths`), which the writer reads.
   - The renderer never sees a path, and can't invent one: a `File` a page makes has none.
   - **The preload is the trust boundary for these paths.** The main process takes any absolute path on `media:import-paths`, so the preload must send nothing but `getPathForFile`'s output for the `File` objects the page passed. It never takes a string from the page as a path. A preload test (`api.test.ts`) keeps it that way.
   - Files without a path (dragged from a web page) still go as bytes over `media:import`.

## Consequences
- The main thread never waits on SQLite's locks. Saves during an import wait their turn as promises, not on the thread.
- Every caller of `ProjectSession` awaits it, and `will-quit` defers quitting until the site is closed.
- A long backup holds the shared side. A writer, or a close, waits for it, at most 5 s for a close; saves meanwhile go on.
- The writer's connection is a second reader and writer of the file. The backup already opens a read-only one, so nothing new for SQLite. Opening it per import means nothing stays open when the file is closed, replaced or restored.
- A backup reads through its own read-only connection and renames its file into place only when it is complete, so a close that runs out of time leaves either a whole backup or none.
- Pasted images and downloaded files once went through the main connection (`storeCopiedMedia`, `storeBlobs`). The addendum below moves them to the writer.

## Addendum (2026-11-01, #664): the writer cleans up, and stores pasted and downloaded files
The architecture review of 30 Oct 2026 (A5) found that garbage collection, and the VACUUM Version History's Clean up needs (4.6), would run on the main connection. A VACUUM of a 300 MB file rewrites all of it, and would hold IPC and autosave up for seconds.
- **Two more jobs for the writer**, each taken on the gate's exclusive side, through `SiteFileWriter` (formerly `AssetWriter`):
  - **`put-blobs`** stores files' bytes, all or none, hashing them on the thread: a pasted Media item's, with its asset when the site has no copy yet (`storeCopiedMedia`), and the files the site's code downloads (`storeBlobs`, 3.9). The bytes are copied to the thread, never moved, since the caller may still use them. A pasted item's file carries the hash it must have, and bytes that hash otherwise fail inside the writer's transaction, so its asset never names a file the site doesn't have.
  - **`clean-up`** runs garbage collection, then a VACUUM when all of these hold:
    - the collection removed something, so a site opened and closed unedited stays as it was (#661), however much of its file is free;
    - at least 4 MB and a quarter of the file are free: a VACUUM rewrites the file, which a sync folder then uploads again (ADR 0003), so it waits until that pays;
    - the file keeps at most 16 MB. Nothing stops a VACUUM once it has started, not even stopping the thread, which ends only its JavaScript, and it takes about 45 ms a MB kept on a fast disk. So it stays well inside the 5 s below, and a quit (`closeThenExit`, 10 s) never kills one. A larger file waits for Version History's Clean up (4.6), which can say it's working.

    The VACUUM keeps the header's fingerprint and application id.
- **Closing cleans up on the writer,** after the main connection has closed, still inside the close's exclusive turn, so nothing else opens the file meanwhile. Measured by the main thread's CPU time, as for an import, cleaning up 120 MB of garbage costs it under 50 ms (`storage-writer.test.ts`).
- **A clean-up gets 5 s,** then the writer is stopped, so a writer that doesn't answer can't hold up opening the next site; SQLite rolls back what it had done the next time the file opens. Stopping can't cut a statement short: the stop waits for a garbage collection or VACUUM that has started, which is why the VACUUM is bounded by size. Quitting already exits after 10 s at most (`closeThenExit`).
- **The thread answers a message it can't read** (one past the protocol's limits, such as more than 1000 files) as failed, whenever it has an id, so the turn that sent it lets the store gate go.
- **The writer's turn refuses a read-only site** (`read-only`), whatever it writes: its own connection can't tell, as the store's can.
- The main connection keeps its reads, its commits and the backups. `ProjectStore.collectGarbage` stays for tests and tools.

