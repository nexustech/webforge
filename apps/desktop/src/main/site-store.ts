import { type ProjectStore, ReadOnlyProjectError } from "@webforge/storage";
import { logFailure } from "./log.js";
import type { StorageWriter } from "./storage-writer.js";
import type { GateKind } from "./store-gate.js";

/** Why a call can't use the open site: none is open, or another has opened since (R6). */
export type StaleReason = "no-site" | "stale-session";

/**
 * The open site as one opening of it reaches its store (A13): {@link ProjectSession.site}. Each
 * use of the store goes through the gate (R13b) and checks the opening again once the gate lets it
 * in, so work that waited while a hand-off replaced the site gets `none` instead of the next site.
 * The site's operations (`site-media.ts`, `export-choices.ts`, `site-zip.ts`) are written on it.
 */
export type SiteStore = {
  /** Why it can't be used now; `undefined` while it is the open site's. */
  staleReason(): StaleReason | undefined;
  /** The open site's file, whichever opening it is; for the main process only. */
  openPath(): string | undefined;
  /**
   * Runs `work` with the store on the gate's `kind` side, or gives `none(reason)` when no site is
   * open, or this opening no longer is, by the time the gate lets it in.
   */
  withStore<T>(
    kind: GateKind,
    work: (store: ProjectStore) => T | Promise<T>,
    none: (reason: StaleReason) => T,
  ): Promise<T>;
  /**
   * Reads, checks and hashes imports off the main thread (R13b, ADR 0013), and forgets one that
   * goes no further. Only {@link writerTurn} stores one.
   */
  readonly writer: Pick<StorageWriter, "prepare" | "discard">;
  /**
   * Runs `work` with the open site's file and the writer's writes on the gate's exclusive side, as
   * the storage writer's turn: a close that can wait no longer stops the writer first (R13b).
   * `none` as for {@link withStore}, and `read-only` for a site the store can't write (the writer
   * writes through a connection of its own, which doesn't know).
   */
  writerTurn<T>(
    work: (path: string, writer: Pick<StorageWriter, "store" | "putBlobs">) => Promise<T>,
    none: (reason: StaleReason | "read-only") => T,
  ): Promise<T>;
};

/** How a change to the store failed, as the renderer may be told it. */
export type StoreFailure = { readonly status: "failed"; readonly reason: "read-only" | "unknown" };

/**
 * What became of a write to the store that threw (A13): `read-only` for a site from a newer
 * Webforge, said as it is; anything else is logged as `event`, by its code only, and `unknown`.
 */
export function storeFailure(error: unknown, event: string): StoreFailure {
  if (error instanceof ReadOnlyProjectError) return { status: "failed", reason: "read-only" };
  logFailure(event, error);
  return { status: "failed", reason: "unknown" };
}
