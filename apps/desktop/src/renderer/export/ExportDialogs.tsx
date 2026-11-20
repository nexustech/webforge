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
import { HelpButton } from "../help/index.js";
import { SiteCheckToFix } from "../site-check/index.js";
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

/** What the report's buttons do: they ask main, which knows where the export went. */
export type ReportActions = {
  /** Opens the export: a folder's home page in the browser, a ZIP in the file manager. */
  readonly onOpen: () => void;
  /** *Show the Folder* (#1171): the exported folder in the file manager. */
  readonly onShowFolder: () => void;
  /** Shows the Site Check panel (#1171). */
  readonly onSiteCheck: () => void;
};

/**
 * The export report (07): where the site went, its full path, its size, what's worth a look, and
 * how many things Site Check still lists to fix (#1171).
 */
function Report({
  report,
  actions,
  onClose,
}: {
  readonly report: ExportReport;
  readonly actions: ReportActions;
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
        <p className="break-all text-muted-foreground text-sm">{report.location}</p>
        <p className="text-sm">{report.summary}</p>
        <SiteCheckToFix
          count={report.toFix}
          onShow={() => {
            onClose();
            actions.onSiteCheck();
          }}
        />
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
          {report.format === "folder" ? (
            <Button variant="outline" onClick={actions.onShowFolder}>
              {t("export.report.showFolder")}
            </Button>
          ) : null}
          <Button onClick={actions.onOpen}>
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
  actions,
}: {
  readonly dialogs: Dialogs;
  readonly actions: ReportActions;
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
          help={<HelpButton topic="export" />}
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
              // Not offered in Simple mode: the site keeps the choice Advanced mode made.
              developerFiles: shown.advanced ? values.developerFiles : shown.initial.developerFiles,
            } satisfies ExportChoices)
          }
          onCancel={() => shown.answer(undefined)}
        />
      );
    case "report":
      return <Report report={shown.report} actions={actions} onClose={dialogs.close} />;
  }
}

/** {@link ExportDialogs} as a window dialog (2.3b): drawn once, with these dialogs. */
export function exportDialogsFor(dialogs: Dialogs, actions: ReportActions) {
  return function ExportDialogsHost() {
    return <ExportDialogs dialogs={dialogs} actions={actions} />;
  };
}
