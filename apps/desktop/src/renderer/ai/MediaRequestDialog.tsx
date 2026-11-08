import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { MediaAsk } from "./media-request.js";

/**
 * An AI app's request for pictures or files (4.12b, AIB-7): who asks and why, in the app's own
 * words, quoted. **Add Files…** opens Webforge's own Add files dialog, where the person chooses
 * what to add, if anything; **Not Now** adds nothing.
 */
export function MediaRequestDialog({
  open,
  asked,
  onAnswer,
}: {
  readonly open: boolean;
  /** The question shown, or last shown while the dialog closes. */
  readonly asked: MediaAsk | null;
  readonly onAnswer: (addFiles: boolean) => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onAnswer(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("ai.media.title", { app: asked?.app ?? "" })}</AlertDialogTitle>
          {/* The app's words, which may name a long web address: they wrap anywhere. */}
          <AlertDialogDescription className="[overflow-wrap:anywhere]">
            {t("ai.media.description", { reason: asked?.reason ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("ai.media.notNow")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => onAnswer(true)}>
            {t("ai.media.addFiles")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
