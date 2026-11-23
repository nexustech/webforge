import { writeSync } from "node:fs";
import { SiteFileWriter } from "../../src/index.js";
import { HOLDING } from "./child-writer.js";

// Child process for crash tests (R13b): imports into the project at argv[2] through an asset
// writer's connection of its own, as the storage writer thread does, in a tight loop until it is
// killed, and prints the sequence number of every import after its write has returned.
//
// With argv[3], import number argv[3] stops inside its transaction, its bytes written and its
// asset not yet (#1355): it prints HOLDING and waits there to be killed, so a test kills it inside
// a transaction by design, not by the timing of its kill.

const path = process.argv[2];
if (path === undefined) {
  throw new Error("Usage: site-file-writer.ts <project.wforge> [import to hold in]");
}
const holdAt = process.argv[3] === undefined ? undefined : Number(process.argv[3]);

/** Blob `seq`: 2 MB, so a write spans many pages and a kill usually lands inside it. (The test
 * makes the same bytes.) */
function blobOf(seq: number): Uint8Array {
  return new Uint8Array(2 * 1024 * 1024).fill(seq % 251);
}

/**
 * Waits where it's called, in the transaction `put` has open: `put` reads the asset's original
 * name as it writes the asset row, after the bytes, and so after SQLite has opened its journal.
 * Says so first, synchronously, so the parent sees it before it kills.
 */
function holdInTransaction(): string {
  writeSync(1, `${HOLDING}\n`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120_000);
  throw new Error("Held in the transaction for 2 minutes without being killed");
}

const writer = SiteFileWriter.open(path);
for (let seq = 1; ; seq += 1) {
  const asset = {
    mediaId: `photo-${seq}`,
    data: blobOf(seq),
    mime: "image/png",
    originalName: "photo.png",
  };
  writer.put(
    seq === holdAt
      ? {
          ...asset,
          get originalName() {
            return holdInTransaction();
          },
        }
      : asset,
  );
  // Synchronous write: the parent must see every acknowledgement sent before the kill.
  writeSync(1, `${seq}\n`);
}
