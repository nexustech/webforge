import { Button, WithTooltip } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { SmartphoneIcon } from "lucide-react";
import { useId } from "react";
import { useCommand, useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";

/** The cue's look: a filled tag, so it reads as "on", not as one more button in the bar. */
const TAG = "shrink-0 items-center rounded-sm bg-accent text-xs text-accent-foreground";

/**
 * The title bar's cue while a phone can open the preview (3.2): for as long as Stop Phone Preview
 * is registered, which the preview does while its listener on the local network is on. Nothing
 * otherwise. It never wraps, and it folds before anything else in the bar does (#1438):
 * - in a wide title bar, "Phone preview on" with **Stop**;
 * - in a narrower one, the phone's icon with a dot, which opens Preview on Your Phone for the
 *   preview as it is, its address and Stop (Show Phone Preview…). Its name says it's on.
 *
 * Its tooltip says who can see the preview, on pointing at the cue and on its button's keyboard
 * focus: what to know before stopping it. The button is described by it too, so a screen reader
 * hears it there.
 */
export function PhonePreviewCue() {
  const registry = useCommandRegistry();
  const stop = useCommand(COMMAND_IDS.stopPhonePreview);
  const show = useCommand(COMMAND_IDS.showPhonePreview);
  const description = useId();
  if (stop === undefined) return null;
  return (
    <>
      <span id={description} hidden>
        {t("preview.phone.onDescription")}
      </span>
      <WithTooltip tooltip={t("preview.phone.onDescription")}>
        <div
          role="status"
          className={`${TAG} hidden h-8 gap-1.5 pr-0.5 pl-2 whitespace-nowrap @min-[1440px]/title-bar:flex`}
        >
          <SmartphoneIcon aria-hidden className="size-3.5" />
          <span>{t("preview.phone.on")}</span>
          <Button
            // Its least, 24 px (L4, #1454): the small button's height.
            size="sm"
            variant="secondary"
            aria-label={stop.label}
            aria-describedby={description}
            onClick={() => void registry.run(stop.id)}
          >
            {t("preview.phone.stop")}
          </Button>
        </div>
      </WithTooltip>
      {show === undefined ? null : (
        <div role="status" className={`${TAG} flex @min-[1440px]/title-bar:hidden`}>
          <WithTooltip tooltip={t("preview.phone.onDescription")}>
            <Button
              variant="ghost"
              // An icon button's size, the least a target may be (L4, #1454).
              size="icon"
              className="relative text-accent-foreground hover:bg-accent-foreground/10"
              aria-label={t("preview.phone.on")}
              aria-describedby={description}
              aria-haspopup="dialog"
              onClick={() => void registry.run(show.id)}
            >
              <SmartphoneIcon aria-hidden className="size-3.5" />
              {/* On: a dot, as a recording light is. */}
              <span
                aria-hidden
                className="absolute top-1 right-1 size-1.5 rounded-full bg-success"
              />
            </Button>
          </WithTooltip>
        </div>
      )}
    </>
  );
}
