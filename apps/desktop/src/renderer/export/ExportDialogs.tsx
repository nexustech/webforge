import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Check,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormDialog,
  type FormSpec,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useState, useSyncExternalStore } from "react";
import { z } from "zod";
import type { ExportChoices } from "../../shared/ipc/site.js";
import type { ExportDialogs as Dialogs, ExportReport } from "./export-dialogs.js";

type OptionValues = {
  readonly format: "folder" | "zip";
  readonly minify: boolean;
  readonly developerFiles: boolean;
};

const optionsSchema = z.strictObject({
  format: z.enum(["folder", "zip"]),
  minify: z.boolean(),
  developerFiles: z.boolean(),
});

/** The export's options (3.3): a folder or a ZIP, and *Minify output*; developer files in Advanced. */
function optionsSpec(advanced: boolean): FormSpec<OptionValues, OptionValues> {
  return {
    fields: () => [
      {
        kind: "choice",
        name: "format",
        label: t("export.dialog.format"),
        help: t("export.dialog.format.help"),
        options: [
          { value: "folder", label: t("export.dialog.format.folder") },
          { value: "zip", label: t("export.dialog.format.zip") },
        ],
      },
      {
        kind: "toggle",
        name: "minify",
        label: t("export.dialog.minify"),
        help: t("export.dialog.minify.help"),
      },
      // Developer files are an Advanced mode option (T2, X6).
      ...(advanced
        ? [
            {
              kind: "toggle",
              name: "developerFiles",
              label: t("export.dialog.developerFiles"),
              help: t("export.dialog.developerFiles.help"),
            } as const,
          ]
        : []),
    ],
    schema: optionsSchema,
    toModel: (values) => values,
  };
}

/** "Add your site's web address?" (X3), with *Don't ask again for this site*. */
function WebAddressPrompt({
  answer,
}: {
  readonly answer: (choice: "add" | "skip" | "skip-always" | "cancel") => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) answer("cancel");
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("export.webAddress.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("export.webAddress.body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <Check label={t("export.webAddress.dontAsk")} checked={dontAsk} onChange={setDontAsk} />
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => answer(dontAsk ? "skip-always" : "skip")}>
            {t("export.webAddress.skip")}
          </Button>
          <Button onClick={() => answer("add")}>{t("export.webAddress.add")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The export report (07): where the site went, its size, and what's worth a look. */
function Report({
  report,
  onOpen,
  onClose,
}: {
  readonly report: ExportReport;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}) {
  const where =
    report.format === "zip"
      ? t("export.report.zip", { name: report.name })
      : t("export.report.folder", { name: report.name });
  const noIssues = report.issues.length === 0 && !report.noWebAddress;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("export.report.title")}</DialogTitle>
          <DialogDescription>{where}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">{report.summary}</p>
        {noIssues ? (
          <p className="text-muted-foreground text-sm">{t("export.report.allGood")}</p>
        ) : (
          <section aria-labelledby="export-report-issues" className="space-y-2 text-sm">
            <h3 id="export-report-issues" className="font-medium">
              {t("export.report.issues")}
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              {report.noWebAddress ? <li>{t("export.report.noWebAddress")}</li> : null}
              {report.issues.map((issue, at) => (
                // The same problem can be listed twice (two broken links on a page).
                // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders.
                <li key={at}>{issue}</li>
              ))}
            </ul>
            {report.more > 0 ? <p>{t("export.report.more", { count: report.more })}</p> : null}
          </section>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("export.report.done")}
          </Button>
          <Button onClick={onOpen}>
            {report.format === "zip" ? t("export.report.showZip") : t("export.report.openFolder")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The export's dialogs (3.3), drawn once in the window: whichever the export flow has open. *Open
 * Site* (Preview from disk) asks the main process to open what it exported (`onOpen`).
 */
export function ExportDialogs({
  dialogs,
  onOpen,
}: {
  readonly dialogs: Dialogs;
  readonly onOpen: () => void;
}) {
  const shown = useSyncExternalStore(dialogs.subscribe, dialogs.shown, dialogs.shown);
  if (shown === null) return null;
  switch (shown.kind) {
    case "web-address":
      return <WebAddressPrompt answer={shown.answer} />;
    case "options":
      return (
        <FormDialog
          open
          title={t("export.dialog.title")}
          description={t("export.dialog.description")}
          confirm={t("export.dialog.confirm")}
          spec={optionsSpec(shown.advanced)}
          initial={{
            format: shown.initial.format,
            minify: shown.initial.minify,
            developerFiles: shown.advanced && shown.initial.developerFiles,
          }}
          onSave={(values) =>
            shown.answer({
              ...shown.initial,
              ...values,
              developerFiles: shown.advanced && values.developerFiles,
            } satisfies ExportChoices)
          }
          onCancel={() => shown.answer(undefined)}
        />
      );
    case "report":
      return <Report report={shown.report} onOpen={onOpen} onClose={dialogs.close} />;
  }
}

/** {@link ExportDialogs} as a window dialog (2.3b): drawn once, with these dialogs. */
export function exportDialogsFor(dialogs: Dialogs, onOpen: () => void) {
  return function ExportDialogsHost() {
    return <ExportDialogs dialogs={dialogs} onOpen={onOpen} />;
  };
}
