import { Button, WithTooltip } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { SmartphoneIcon } from "lucide-react";
import { useId } from "react";
import { useCommand, useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";

/**
 * The title bar's cue while a phone can open the preview (3.2): "Phone preview on", with Stop, for
 * as long as Stop Phone Preview is registered, which the preview does while its listener on the
 * local network is on. Nothing otherwise.
 *
 * Its tooltip says who can see the preview, on pointing at the cue and on Stop's keyboard focus
 * (which reaches the cue): what to know before stopping it. Stop is described by it too, so a
 * screen reader hears it there.
 */
export function PhonePreviewCue() {
  const registry = useCommandRegistry();
  const stop = useCommand(COMMAND_IDS.stopPhonePreview);
  const description = useId();
  if (stop === undefined) return null;
  return (
    <WithTooltip tooltip={t("preview.phone.onDescription")}>
      <div
        role="status"
        className="flex h-7 items-center gap-1.5 rounded-sm bg-accent px-2 text-xs text-accent-foreground"
      >
        <SmartphoneIcon aria-hidden className="size-3.5" />
        <span>{t("preview.phone.on")}</span>
        <span id={description} hidden>
          {t("preview.phone.onDescription")}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-5 px-1.5"
          aria-describedby={description}
          onClick={() => void registry.run(stop.id)}
        >
          {stop.label}
        </Button>
      </div>
    </WithTooltip>
  );
}
