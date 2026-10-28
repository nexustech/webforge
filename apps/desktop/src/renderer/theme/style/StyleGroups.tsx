import { type FieldRenderers, FieldRenderersProvider } from "@webforge/editor-ui";
import { useState } from "react";
import { EditPanelHost } from "../../editor/EditPanelHost.js";
import type { EditorSession } from "../../editor/editor-session.js";
import { colourField } from "../../fields/index.js";
import type { PreferencesStore } from "../../shell/preferences-store.js";

/** Props of {@link StyleGroups}. */
export type StyleGroupsProps = {
  readonly session: EditorSession;
  /** The colour field follows the editor level: Advanced mode adds a hex colour (ADR 0009). */
  readonly preferences: PreferencesStore;
};

/**
 * What *Style this ‹kind›…* edits (3.13a): the selected item's Appearance fields as the Style tab
 * has them, with their provenance (3.12). 3.13b's deeper groups join them here; the dialog around
 * it (`StyleDialog`) keeps the preview and where the changes apply.
 */
export function StyleGroups({ session, preferences }: StyleGroupsProps) {
  const [renderers] = useState<FieldRenderers>(() => ({
    color: colourField({ session, preferences }),
  }));
  return (
    <FieldRenderersProvider renderers={renderers}>
      <EditPanelHost session={session} flush={() => session.flush()} appearanceOnly />
    </FieldRenderersProvider>
  );
}
