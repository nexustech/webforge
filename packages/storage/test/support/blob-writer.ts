import { writeSync } from "node:fs";
import { BlobWriter } from "../../src/index.js";

// Child process for crash tests (R13b): writes blobs to the project at argv[2] through a blob
// writer's connection of its own, as the storage writer thread does, in a tight loop until it is
// killed, and prints the sequence number of every blob after its write has returned.

const path = process.argv[2];
if (path === undefined) {
  throw new Error("Usage: blob-writer.ts <project.wforge>");
}

/** Blob `seq`: 2 MB, so a write spans many pages and a kill usually lands inside it. (The test
 * makes the same bytes.) */
function blobOf(seq: number): Uint8Array {
  return new Uint8Array(2 * 1024 * 1024).fill(seq % 251);
}

const writer = BlobWriter.open(path);
for (let seq = 1; ; seq += 1) {
  writer.put(blobOf(seq), "image/png");
  // Synchronous write: the parent must see every acknowledgement sent before the kill.
  writeSync(1, `${seq}\n`);
}
