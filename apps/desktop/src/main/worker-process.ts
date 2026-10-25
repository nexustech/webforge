/**
 * The parts of an Electron `UtilityProcess` the main process's worker clients use, the one shape
 * for all of them (the export's, the canvas styles', the thumbnails'); a fake in tests.
 */
export type WorkerProcess = {
  postMessage(message: unknown): void;
  on(event: "message", listener: (message: unknown) => void): unknown;
  on(event: "exit", listener: (code: number) => void): unknown;
  kill(): boolean;
};
