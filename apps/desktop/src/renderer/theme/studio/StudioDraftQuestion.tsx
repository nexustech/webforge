import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";

/** Props of {@link StudioDraftQuestion}. */
type StudioDraftQuestionProps = {
  /** The kind whose draft is asked about ("Button"), or none while nothing is asked. */
  readonly item: string | undefined;
  readonly onApply: () => void;
  readonly onDiscard: () => void;
  /** Keeps editing: nothing happens. */
  readonly onCancel: () => void;
};

/**
 * What Theme Studio asks before it leaves a kind with changes not applied yet, or closes with them
 * (4.10): apply them, as one step, or discard them; or keep editing.
 */
export function StudioDraftQuestion({
  item,
  onApply,
  onDiscard,
  onCancel,
}: StudioDraftQuestionProps) {
  return (
    <AlertDialog
      open={item !== undefined}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("theme.components.pending.title", { item: item ?? "" })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("theme.components.pending.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("theme.components.pending.cancel")}</AlertDialogCancel>
          <Button type="button" variant="outline" onClick={onDiscard}>
            {t("theme.components.pending.discard")}
          </Button>
          <Button type="button" onClick={onApply}>
            {t("theme.components.pending.apply")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
