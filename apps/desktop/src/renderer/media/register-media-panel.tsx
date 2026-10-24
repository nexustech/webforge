import { t } from "@webforge/i18n";
import { ImageIcon } from "lucide-react";
import type { EditorSession } from "../editor/editor-session.js";
import type { PanelRegistry } from "../shell/panels.js";
import { MediaPanel } from "./MediaPanel.js";

/** Puts Media in the right column's bottom, with the other Site panels (UI1, 1.16). */
export function registerMediaPanel(panels: PanelRegistry, session: EditorSession): () => void {
  function Media() {
    return <MediaPanel session={session} />;
  }
  return panels.register({
    id: "media",
    slot: "right.bottom",
    title: t("site.media.title"),
    icon: ImageIcon,
    component: Media,
  });
}
