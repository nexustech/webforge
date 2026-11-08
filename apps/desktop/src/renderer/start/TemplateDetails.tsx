import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { TemplatePreview } from "./TemplatePreview.js";
import { presetLabel, templateName } from "./template-labels.js";

/** A template's larger preview, its description, and Use this template. */
export function TemplateDetails({
  template,
  onUse,
  onClose,
}: {
  readonly template: TemplateSummary | null;
  readonly onUse: (template: TemplateSummary) => void;
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      open={template !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {template === null ? null : (
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{templateName(template.id)}</DialogTitle>
            <DialogDescription>{t(`template.${template.id}.description`)}</DialogDescription>
          </DialogHeader>
          <span className="flex aspect-video w-full overflow-hidden rounded-md border border-border">
            <TemplatePreview template={template} />
          </span>
          <p className="m-0 text-xs text-muted-foreground">
            {`${t(`template.category.${template.category}`)} · ${plural("newSite.pages", template.pages)} · ${presetLabel(template.theme)}`}
          </p>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("newSite.cancel")}
            </Button>
            <Button type="button" onClick={() => onUse(template)}>
              {t("newSite.useTemplate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
