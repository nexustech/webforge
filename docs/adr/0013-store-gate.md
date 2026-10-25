# 0013. A second connection writes large blobs, behind a store gate

- Status: Accepted
- Date: 2026-10-25
- Related: #246 (R13), #408 (R13b), [architecture §3, §10](../../spec/01-architecture.md), [ADR 0003](0003-wforge-sqlite-storage.md)

## Context
The main process holds the open site's `.wforge` through one better-sqlite3 connection, whose calls are synchronous. Importing a 50 MB image there blocked the main thread for 1.4–2.0 s (measured 25 Oct 2026): about 350 ms of SHA-256, and the rest inserting the blob with the two fsyncs of a rollback-journal commit (`synchronous = FULL`, ADR 0003). Every IPC call and `webforge-media:` request waited meanwhile.

Hashing in slices on the main thread can't fix that: the insert is one statement. better-sqlite3 has no incremental blob writes, and splitting blobs into chunk rows would change the file format.

A second connection can do the write on another thread. But under the rollback journal (kept for cloud sync, ADR 0003) a connection that commits locks out the others, and a main-thread connection that met that lock would wait on the main thread, which is the block we are removing.

## Decision
1. **A storage writer** (a `worker_threads` worker in the main process, R13b part 2) gets its own connection to the open file. It is opened with the same hardening and pragmas as the main one. It reads, checks and hashes an import, and inserts its blob in a transaction of its own. The main connection then adds the small asset row.
2. **One store gate** (`apps/desktop/src/main/store-gate.ts`) decides who uses the file:
   - **Shared:** the main process's work (reads, commits, backups) runs alongside other shared work.
   - **Exclusive:** the writer, and closing or replacing the site, run alone.
   - **Order:** work runs in the order it asked. A save asked for while an import writes lands after it, in order with the saves around it. Shared work asked for after waiting exclusive work queues behind it, so the writer is never starved.
3. **Nothing reaches the store outside the gate.** Every `ProjectSession` method that touches the store goes through it, and those methods are async. The backup gets a gated accessor from the `opened` event, not the store. A test wraps the store and fails on any call made while the gate isn't held.
4. **Closing waits for the gate at most 5 s,** then closes anyway, so a writer that never finishes can't hold up quitting or switching sites. Part 2 terminates the writer at that point; the existing garbage collection removes a blob it left without an asset.
5. **A save checks its session again once the gate lets it in** (R6), so a save that queued behind a hand-off can't change the site that replaced its own.

## Consequences
- The main thread never waits on SQLite's locks. Saves during an import wait their turn as promises, not on the thread.
- Every caller of `ProjectSession` awaits it, and `will-quit` defers quitting until the site is closed.
- A long backup holds the shared side. A writer, or a close, waits for it, at most 5 s for a close; saves meanwhile go on.
- The writer's connection is a second reader and writer of the file. The backup already opens a read-only one, so nothing new for SQLite, but it must close before the file is closed, replaced or restored.
