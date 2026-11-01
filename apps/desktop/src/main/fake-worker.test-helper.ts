import { vi } from "vitest";
import type { FromWorker, ToWorker } from "../shared/worker-channel-protocol.js";
import type { WorkerProcess } from "./worker-process.js";

type Listener = (value: unknown) => void;

/**
 * A utility process the test answers for, as the worker channel speaks to one (A14): it records
 * what it was sent, and the test sends what a worker would.
 */
export function fakeWorker() {
  const listeners = { message: [] as Listener[], exit: [] as Listener[] };
  const sent: ToWorker[] = [];
  const worker: WorkerProcess = {
    postMessage: (message) => sent.push(message as ToWorker),
    on: ((event: "message" | "exit", listener: Listener) =>
      listeners[event].push(listener)) as WorkerProcess["on"],
    kill: vi.fn(() => true),
  };
  const emit = (message: unknown) => {
    for (const listener of listeners.message) listener(message);
  };
  return {
    worker,
    /** Everything sent to the worker, in order. */
    sent,
    /** The jobs sent, each with the id the channel gave it. */
    get jobs(): ({ readonly id: number } & Record<string, unknown>)[] {
      return sent.flatMap((message) =>
        message.message === "job" ? [{ id: message.id, ...(message.job as object) }] : [],
      );
    },
    /** Answers job `id` with the rest of `answer` as its outcome. */
    answer: ({ id, ...outcome }: { readonly id: number | undefined } & Record<string, unknown>) => {
      emit({ message: "outcome", id, outcome });
    },
    /** Sends a message of the channel's, or anything else. */
    send: (message: FromWorker | Record<string, unknown>) => emit(message),
    exit: (code = 1) => {
      for (const listener of listeners.exit) listener(code);
    },
  };
}
