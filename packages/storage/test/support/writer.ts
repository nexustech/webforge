import { writeSync } from "node:fs";
import { ProjectStore } from "../../src/index.js";

// Child process for crash and sync tests: commits to the project at argv[2] in a tight loop until
// it is killed, and prints the sequence number of every commit after it has returned.

const path = process.argv[2];
if (path === undefined) {
  throw new Error("Usage: writer.ts <project.wforge>");
}
// Large enough that every commit writes many pages, so a kill usually lands inside a transaction.
const FILLER = "Lorem ipsum dolor sit amet. ".repeat(10_000);

const store = ProjectStore.open(path);
for (let seq = 1; ; seq += 1) {
  // An import writes a blob and its assets row together; the kill may land in either transaction.
  store.putAsset({
    mediaId: "photo",
    data: new TextEncoder().encode(`${seq} ${FILLER}`),
    mime: "image/png",
    originalName: "photo.png",
  });
  store.commit([
    { type: "put", id: "page:home", kind: "page", content: { seq, body: `${seq} ${FILLER}` } },
    { type: "put", id: "menu", kind: "menu", content: { seq } },
  ]);
  // Synchronous write: the parent must see every acknowledgement sent before the kill.
  writeSync(1, `${seq}\n`);
}
