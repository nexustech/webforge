import { type ComponentType, useSyncExternalStore } from "react";

/**
 * A dialog an area draws in the window (Theme Studio): drawn once, open or closed by the area's own
 * state, whatever the panels show, so a menu command can open it from anywhere.
 */
type WindowDialog = {
  /** Unique: "themeStudio". */
  readonly id: string;
  readonly component: ComponentType;
};

/** The window's dialogs that areas register (2.3b): App draws each once, with {@link WindowDialogs}. */
export type WindowDialogRegistry = {
  /** Adds a dialog and returns a function that removes it. Ids must be unique. */
  register(dialog: WindowDialog): () => void;
  /** The dialogs, in the order they were registered; the same list until one comes or goes. */
  list(): readonly WindowDialog[];
  /** Calls `listener` after a dialog is added or removed; returns a function that stops it. */
  subscribe(listener: () => void): () => void;
};

/** Creates an empty registry. */
export function createWindowDialogs(): WindowDialogRegistry {
  let dialogs: readonly WindowDialog[] = [];
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const listener of listeners) listener();
  };
  return {
    register(dialog) {
      if (dialogs.some((each) => each.id === dialog.id)) {
        throw new Error(`The dialog "${dialog.id}" is already registered`);
      }
      dialogs = [...dialogs, dialog];
      changed();
      return () => {
        if (!dialogs.includes(dialog)) return;
        dialogs = dialogs.filter((each) => each !== dialog);
        changed();
      };
    },
    list: () => dialogs,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Draws every dialog registered in `registry`, once each (App). */
export function WindowDialogs({ registry }: { readonly registry: WindowDialogRegistry }) {
  const dialogs = useSyncExternalStore(registry.subscribe, registry.list, registry.list);
  return dialogs.map(({ id, component: Dialog }) => <Dialog key={id} />);
}
