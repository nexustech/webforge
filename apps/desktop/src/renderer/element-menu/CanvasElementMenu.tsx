import type { CanvasEngine } from "@webforge/engine";
import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { type Layer, layerItem, layersOf, renameLayer } from "../layers/layers.js";
import { NameDialog } from "../site/NameDialog.js";
import { ElementMenu, type MenuPoint } from "./ElementMenu.js";

/** The longest layer name; as Layers' own name field. */
const MAX_NAME_LENGTH = 100;

/** The layer `id` in `layers` or among their children. */
function findLayer(layers: readonly Layer[], id: string): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    const inside = findLayer(layer.children, id);
    if (inside !== undefined) return inside;
  }
  return undefined;
}

/** The selected element's layer on the shown page, if it is one (not the Header or Footer). */
function selectedLayer(session: EditorSession): Layer | undefined {
  const site = session.history.document.getState();
  const { pageId, nodeId } = session.ui.getState();
  const content = site.pages[pageId]?.doc.content;
  if (content === undefined || nodeId === null) return undefined;
  return findLayer(layersOf(content, session.library, site.sharedSections), nodeId);
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

  useEffect(
    () =>
      engine?.onContextMenu(({ nodeId, x, y }) => {
        session.ui.setState({ nodeId });
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
