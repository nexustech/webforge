import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { SmartphoneIcon } from "lucide-react";
import { useCommand, useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";

/**
 * The title bar's cue while a phone can open the preview (3.2): "Phone preview on", with Stop, for
 * as long as Stop Phone Preview is registered, which the preview does while its listener on the
 * local network is on. Nothing otherwise.
 */
export function PhonePreviewCue() {
  const registry = useCommandRegistry();
  const stop = useCommand(COMMAND_IDS.stopPhonePreview);
  if (stop === undefined) return null;
  return (
    <div
      role="status"
      title={t("preview.phone.onDescription")}
      className="flex h-7 items-center gap-1.5 rounded-sm bg-accent px-2 text-xs text-accent-foreground"
    >
      <SmartphoneIcon aria-hidden className="size-3.5" />
      <span>{t("preview.phone.on")}</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-5 px-1.5"
        onClick={() => void registry.run(stop.id)}
      >
        {stop.label}
      </Button>
    </div>
  );
}
