import type { CanvasEngine } from "@webforge/engine";
import type { EngineConnection } from "./editor-session.js";

/** The canvas engine the editor has mounted, and its connection to the editor session. */
type MountedEngine = {
  readonly engine: CanvasEngine;
  readonly connection: EngineConnection;
};

/** The canvas engine as an area sees it (2.20, B1): there while the editor has one mounted. */
export type EngineHandle = {
  /** The mounted engine, or null before the canvas mounts and after it unmounts. */
  readonly current: () => MountedEngine | null;
  /** Records the canvas's pending edit as an undo step first; nothing without an engine. */
  readonly flush: () => void;
  /**
   * Calls `connect` with each engine as it mounts (at once, when one is mounted already); what
   * `connect` returns runs as that engine unmounts. Returns how to stop, which also undoes the
   * connection to an engine still mounted.
   */
  readonly whileMounted: (connect: (mounted: MountedEngine) => () => void) => () => void;
};

/** The editor's side of an {@link EngineHandle}: it attaches each engine it mounts. */
export type EngineHost = EngineHandle & {
  /**
   * Connects what waits for an engine to `mounted`, in the order it asked; returns how to detach
   * it again, which undoes those connections in the opposite order.
   */
  readonly attach: (mounted: MountedEngine) => () => void;
};

/** An {@link EngineHost} with no engine attached yet. */
export function createEngineHost(): EngineHost {
  let current: MountedEngine | null = null;
  type Waiting = {
    readonly connect: (mounted: MountedEngine) => () => void;
    disconnect: (() => void) | undefined;
  };
  const waiting: Waiting[] = [];
  let detachCurrent: (() => void) | undefined;
  return {
    current: () => current,
    flush: () => current?.connection.flush(),
    whileMounted: (connect) => {
      const entry: Waiting = {
        connect,
        disconnect: current === null ? undefined : connect(current),
      };
      waiting.push(entry);
      return () => {
        const at = waiting.indexOf(entry);
        if (at >= 0) waiting.splice(at, 1);
        entry.disconnect?.();
        entry.disconnect = undefined;
      };
    },
    attach: (mounted) => {
      const detach = () => {
        if (current !== mounted) return;
        // Gone before what it was connected to stops, so nothing reaches it while that happens;
        // and not kept, so the engine and its iframe can go.
        current = null;
        detachCurrent = undefined;
        for (const entry of [...waiting].reverse()) {
          entry.disconnect?.();
          entry.disconnect = undefined;
        }
      };
      // An engine still attached is detached first, so nothing stays connected to it.
      detachCurrent?.();
      current = mounted;
      detachCurrent = detach;
      try {
        for (const entry of [...waiting]) entry.disconnect = entry.connect(mounted);
      } catch (error) {
        // What connected before the one that failed is undone, so the engine isn't left half
        // connected with nothing to detach it.
        detach();
        throw error;
      }
      return detach;
    },
  };
}
