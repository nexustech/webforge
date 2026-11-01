import { parentPort } from "node:worker_threads";
import { storageWriterMessageSchema } from "../shared/storage-writer-protocol.js";
import { createWriterJobs } from "./writer-jobs.js";

// The storage writer thread (R13b, ADR 0013): a worker thread of the main process that prepares
// imports (reads, checks and hashes them) and stores them through a connection of its own, as the
// main process asks, as it does pasted and downloaded files and the clean-up as a site closes. The
// main process's store gate keeps everything else off the file while it writes; preparing needs
// no gate.

const port = parentPort;
if (port === null) {
  throw new Error("The storage writer runs as a worker thread");
}
const jobs = createWriterJobs();

/** The id of a message that isn't a job this thread knows, when it has one. */
function idOf(message: unknown): number | undefined {
  if (typeof message !== "object" || message === null || !("id" in message)) return undefined;
  return typeof message.id === "number" ? message.id : undefined;
}

port.on("message", (message: unknown) => {
  const parsed = storageWriterMessageSchema.safeParse(message);
  if (!parsed.success) {
    // Answer what can be answered: a job the main process waits for would otherwise hold the
    // store gate for ever (#664), as a put-blobs past the protocol's limits would.
    const id = idOf(message);
    if (id !== undefined) port.postMessage({ id, outcome: { status: "failed" } });
    return;
  }
  const job = parsed.data;
  switch (job.type) {
    case "prepare":
      void jobs.prepare(job.id, job.fileName, job.source).then(
        (outcome) => port.postMessage({ id: job.id, outcome }),
        () => port.postMessage({ id: job.id, outcome: { status: "failed" } }),
      );
      return;
    case "store":
      port.postMessage({ id: job.id, outcome: jobs.store(job.prepared, job) });
      return;
    case "discard":
      jobs.discard(job.prepared);
      return;
    case "put-blobs":
      port.postMessage({ id: job.id, outcome: jobs.putBlobs(job.sitePath, job.blobs, job.asset) });
      return;
    case "clean-up":
      port.postMessage({ id: job.id, outcome: jobs.cleanUp(job.sitePath) });
      return;
  }
});
