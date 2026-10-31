import { t } from "@webforge/i18n";
import { ImageIcon } from "lucide-react";
import type { MediaApi } from "../../shared/ipc/media.js";
import type { EditorSession } from "../editor/editor-session.js";
import type { PanelRegistry } from "../shell/panels.js";
import { MediaPanel } from "./MediaPanel.js";

/**
 * Puts Media in the right column's bottom, with the other Site panels (UI1, 1.16), importing and
 * choosing files through `media`, the preload API's (#668).
 */
export function registerMediaPanel(
  panels: PanelRegistry,
  session: EditorSession,
  media: MediaApi,
): () => void {
  function Media() {
    return <MediaPanel session={session} media={media} />;
  }
  return panels.register({
    id: "media",
    slot: "right.bottom",
    title: t("site.media.title"),
    icon: ImageIcon,
    component: Media,
  });
}
