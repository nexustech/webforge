import { type FieldRenderers, FieldRenderersProvider } from "@webforge/editor-ui";
import { useState } from "react";
import { EditPanelHost } from "../../editor/EditPanelHost.js";
import type { EditorSession } from "../../editor/editor-session.js";
import { colourField } from "../../fields/index.js";
import { STYLE_DIALOG_GROUPS } from "./style-groups.js";

/** Props of {@link StyleGroups}. */
export type StyleGroupsProps = {
  readonly session: EditorSession;
};

/**
 * What *Style this ‹kind›…* edits: the selected item's Appearance fields as the Style tab has them
 * (3.13a), then the deeper groups (3.13b, CT-2): Background, Border, Corners, Shadow, Title,
 * Spacing and When hovered, each with its provenance (3.12). The dialog around it (`StyleDialog`)
 * keeps the preview and where the changes apply.
 */
export function StyleGroups({ session }: StyleGroupsProps) {
  const [renderers] = useState<FieldRenderers>(() => ({
    color: colourField({ session }),
  }));
  return (
    <FieldRenderersProvider renderers={renderers}>
      <EditPanelHost
        session={session}
        flush={() => session.flush()}
        appearanceOnly
        dialogGroups={STYLE_DIALOG_GROUPS}
        columns
      />
    </FieldRenderersProvider>
  );
}
