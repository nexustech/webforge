import { t } from "@webforge/i18n";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { EditorSession } from "../editor/editor-session.js";
import { type Layer, layerItem, layerOf, setLayerNote } from "../editor/layers.js";
import { COMMAND_IDS } from "../shell/command-ids.js";
import type { CommandRegistry } from "../shell/commands.js";
import type { WindowDialogRegistry } from "../shell/window-dialogs.js";
import { NoteDialog } from "./NoteDialog.js";

/** The layer whose note the dialog edits, while it's open. */
type NoteState = { readonly editing: Layer | null };

/** The one element selected, as a layer, if it is one: notes are on one element at a time. */
function selectedLayer(session: EditorSession): Layer | undefined {
  const { nodeId, others } = session.ui.getState();
  return nodeId === null || (others ?? []).length > 0 ? undefined : layerOf(session, nodeId);
}

/**
 * Notes on elements (UX-17, #868): *Add Note…* or *Edit Note…* and *Resolve Note*, in the Edit menu,
 * the command box and the element menu, on the one element selected, in Design and Content mode
 * alike, as a note changes nothing on the page. Each change is one undo step. Returns a function
 * that removes them.
 */
export function registerNotes(
  registry: CommandRegistry,
  dialogs: WindowDialogRegistry,
  session: EditorSession,
  state: StoreApi<NoteState> = createStore<NoteState>()(() => ({ editing: null })),
): () => void {
  function Note() {
    const layer = useStore(state, (current) => current.editing);
    return (
      <NoteDialog
        open={layer !== null}
        item={layer === null ? "" : layerItem(layer)}
        note={layer?.note ?? ""}
        onSave={(note) => {
          if (layer !== null) setLayerNote(session, layer.id, note);
          state.setState({ editing: null });
        }}
        onCancel={() => state.setState({ editing: null })}
      />
    );
  }
  // What the commands were last set to: set again only when that changes.
  let last = "";
  const update = () => {
    const layer = selectedLayer(session);
    const key = `${layer?.id ?? ""}:${layer?.note === undefined}`;
    if (key === last) return;
    last = key;
    registry.update(COMMAND_IDS.note, {
      enabled: layer !== undefined,
      label: t(layer?.note === undefined ? "notes.add" : "notes.edit"),
    });
    registry.update(COMMAND_IDS.resolveNote, { enabled: layer?.note !== undefined });
  };
  const removers = [
    dialogs.register({ id: "note", component: Note }),
    registry.register({
      id: COMMAND_IDS.note,
      label: t("notes.add"),
      menu: "edit",
      enabled: false,
      run: () => {
        const layer = selectedLayer(session);
        if (layer !== undefined) state.setState({ editing: layer });
      },
    }),
    registry.register({
      id: COMMAND_IDS.resolveNote,
      label: t("notes.resolveCommand"),
      menu: "edit",
      enabled: false,
      run: () => {
        const layer = selectedLayer(session);
        if (layer?.note !== undefined) setLayerNote(session, layer.id, "");
      },
    }),
    session.ui.subscribe(update),
    session.history.document.subscribe(update),
  ];
  update();
  return () => {
    for (const remove of removers.toReversed()) remove();
  };
}
