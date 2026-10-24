import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { LAYER_NAME_MAX } from "@webforge/model";
import { useEffect, useRef, useState } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { type Layer, layerItem, renameLayer, shownLayer } from "../layers/layers.js";
import { NameDialog } from "../site/NameDialog.js";
import { ElementMenu, type MenuPoint } from "./ElementMenu.js";

/** The selected element's layer on the shown page, if it is one (not the Header or Footer). */
function selectedLayer(session: EditorSession): Layer | undefined {
  const { nodeId } = session.ui.getState();
  return nodeId === null ? undefined : shownLayer(session, nodeId);
}

/** Props of {@link CanvasElementMenu}. */
export type CanvasElementMenuProps = {
  readonly engine: CanvasEngine | null;
  readonly session: EditorSession;
  /** The layer whose name the dialog asks for, if it is open: from Rename here, or F2 (1.30). */
  readonly renaming: Layer | null;
  readonly onRenamingChange: (layer: Layer | null) => void;
};

/**
 * The element menu on the canvas (1.35): a right-click on an element selects it and opens the
 * menu Layers has too. Rename asks for the name in a dialog, as Layers isn't always showing; F2
 * opens the same dialog (see `element-commands.ts`).
 */
export function CanvasElementMenu({
  engine,
  session,
  renaming,
  onRenamingChange: setRenaming,
}: CanvasElementMenuProps) {
  const [at, setAt] = useState<MenuPoint | null>(null);
  // What had the focus when the menu opened (the canvas), to give it back when it closes; or, if
  // Rename was chosen, the layer whose name to ask for once it has closed.
  const opener = useRef<Element | null>(null);

  useEffect(
    () =>
      engine?.onContextMenu(({ nodeId, x, y }) => {
        opener.current = document.activeElement;
        session.select(nodeId);
        setAt({ x, y });
      }),
    [engine, session],
  );

  const layer = at === null ? undefined : selectedLayer(session);
  return (
    <>
      <ElementMenu
        at={at}
        onClose={() => setAt(null)}
        onRename={layer === undefined ? undefined : () => setRenaming(layer)}
        onCloseFocus={() => (opener.current as HTMLElement | null)?.focus?.()}
      />
      <NameDialog
        open={renaming !== null}
        title={t("elementMenu.renameTitle", {
          item: renaming === null ? "" : layerItem(renaming),
        })}
        label={t("layers.nameField", { item: renaming?.kind ?? "" })}
        initialValue={renaming?.name ?? ""}
        maxLength={LAYER_NAME_MAX}
        confirm={t("layers.rename")}
        onSubmit={(name) => {
          if (renaming !== null) renameLayer(session, renaming.id, name);
          setRenaming(null);
        }}
        onCancel={() => setRenaming(null)}
      />
    </>
  );
}
