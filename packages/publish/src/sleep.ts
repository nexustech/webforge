import { PublishError } from "./publisher.js";

/**
 * Waits `ms`, as a publish does between retries and between polls. Cancelling `signal` ends the
 * wait at once with a `cancelled` {@link PublishError}, as it does any other step of a publish.
 */
export function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new PublishError("cancelled", "Publishing was cancelled"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    if (signal?.aborted === true) cancel();
    else signal?.addEventListener("abort", cancel, { once: true });
  });
}
