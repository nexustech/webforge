import { parentPort } from "node:worker_threads";
import { storageWriterMessageSchema } from "../shared/storage-writer-protocol.js";
import { storeImport } from "./store-import.js";

// The storage writer thread (R13b, ADR 0013): a worker thread of the main process that reads,
// checks, hashes and stores imports through a connection of its own, one at a time, as the main
// process sends them. The main process's store gate keeps everything else off the file meanwhile.

const port = parentPort;
if (port === null) {
  throw new Error("The storage writer runs as a worker thread");
}

port.on("message", (message: unknown) => {
  const parsed = storageWriterMessageSchema.safeParse(message);
  if (!parsed.success) {
    return;
  }
  const { id, request } = parsed.data;
  void storeImport(request).then(
    (outcome) => port.postMessage({ id, outcome }),
    () => port.postMessage({ id, outcome: { status: "failed" } }),
  );
});
