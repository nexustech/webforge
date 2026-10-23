import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useEffect, useRef, useState } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { type Layer, layerItem, renameLayer, shownLayer } from "../layers/layers.js";
import { NameDialog } from "../site/NameDialog.js";
import { ElementMenu, type MenuPoint } from "./ElementMenu.js";

/** The longest layer name; as Layers' own name field. */
const MAX_NAME_LENGTH = 100;

/** The selected element's layer on the shown page, if it is one (not the Header or Footer). */
function selectedLayer(session: EditorSession): Layer | undefined {
  const { nodeId } = session.ui.getState();
  return nodeId === null ? undefined : shownLayer(session, nodeId);
}

/** Props of {@link CanvasElementMenu}. */
export type CanvasElementMenuProps = {
  readonly engine: CanvasEngine | null;
  readonly session: EditorSession;
};

/**
 * The element menu on the canvas (1.35): a right-click on an element selects it and opens the
 * menu Layers has too. Rename asks for the name in a dialog, as Layers isn't always showing.
 */
export function CanvasElementMenu({ engine, session }: CanvasElementMenuProps) {
  const [at, setAt] = useState<MenuPoint | null>(null);
  const [renaming, setRenaming] = useState<Layer | null>(null);
  // What had the focus when the menu opened (the canvas), to give it back when it closes; or, if
  // Rename was chosen, the layer whose name to ask for once it has closed.
  const opener = useRef<Element | null>(null);
  const toRename = useRef<Layer | null>(null);

  useEffect(
    () =>
      engine?.onContextMenu(({ nodeId, x, y }) => {
        opener.current = document.activeElement;
        toRename.current = null;
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
        onRename={
          layer === undefined
            ? undefined
            : () => {
                toRename.current = layer;
              }
        }
        onCloseFocus={() => {
          const layer = toRename.current;
          // The dialog opens once the menu has gone, so it alone takes the pointer and the focus.
          if (layer !== null) requestAnimationFrame(() => setRenaming(layer));
          else (opener.current as HTMLElement | null)?.focus?.();
        }}
      />
      <NameDialog
        open={renaming !== null}
        title={t("elementMenu.renameTitle", {
          item: renaming === null ? "" : layerItem(renaming),
        })}
        label={t("layers.nameField", { item: renaming?.kind ?? "" })}
        initialValue={renaming?.name ?? ""}
        maxLength={MAX_NAME_LENGTH}
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
