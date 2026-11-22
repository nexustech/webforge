import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useId, useState } from "react";
import {
  type DiagnosticCount,
  isDiagnosticCount,
  isDiagnosticTiming,
} from "../../shared/diagnostic-counts.js";
import type { Diagnostics } from "../../shared/diagnostics.js";
import type { AppApi } from "../../shared/ipc/app.js";
import { reportFailure } from "../log.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";

/** The summary's sections, in the order the window shows them: note 22 §4's groups. */
const SECTIONS = [
  "sites",
  "quickStart",
  "tour",
  "used",
  "failures",
  "siteCheck",
  "aiApps",
  "assistant",
] as const;

/** The section `field` is in: `sites` for `sites.started`. */
const sectionOf = (field: DiagnosticCount) => field.split(".")[0] as (typeof SECTIONS)[number];

/** What became of the person's last action. */
export type DiagnosticsStatus = "saved" | "save-failed" | "folder-failed" | "cleared";

/** One count as the window says it: its words, and the listed name it's by, if any. */
export function countWords(field: DiagnosticCount, name: string | undefined): string {
  const words = t(`diagnostics.field.${field}`);
  return name === undefined ? words : t("diagnostics.byName", { words, name });
}

/** The computer, in words: "Webforge 0.3.0 (beta) on Windows 10.0.26300, x64, 16 GB…". */
function computerWords(computer: NonNullable<Diagnostics["computer"]>): string {
  return t("diagnostics.computer", {
    version: computer.version,
    channel: computer.channel,
    platform:
      computer.platform === "win32"
        ? "Windows"
        : computer.platform === "darwin"
          ? "macOS"
          : computer.platform === "linux"
            ? "Linux"
            : computer.platform,
    osVersion: computer.osVersion,
    arch: computer.arch,
    memory: String(computer.memoryGb),
    scale: String(Math.round(computer.scale * 100)),
    language: computer.language,
  });
}

/** Props of {@link DiagnosticsDialog}. */
export type DiagnosticsDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** What the summary holds; `null` while it can't be read, `undefined` while it loads. */
  readonly diagnostics: Diagnostics | null | undefined;
  readonly status: DiagnosticsStatus | null;
  readonly onSave: () => void;
  readonly onOpenFolder: () => void;
  readonly onClear: () => void;
};

/**
 * Help › Diagnostics…'s window (5.41, BD-2): everything the usage summary holds, in words, grouped
 * as note 22 §4 groups it, with the install number and the computer, so a tester can see for
 * themself that nothing of their sites is in it. *Save Report…* saves it with the newest crash
 * reports, to attach to a report; *Open the Folder* shows where they're kept; *Clear…* asks, then
 * starts again with a new install number. Nothing is sent.
 */
export function DiagnosticsDialog(props: DiagnosticsDialogProps) {
  const id = useId();
  const { diagnostics, status } = props;
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("diagnostics.title")}</DialogTitle>
            <DialogDescription>{t("diagnostics.about")}</DialogDescription>
          </DialogHeader>
          {/* Its own scrolling part, which the keyboard reaches too (axe's scrollable-region-focusable). */}
          <section
            aria-label={t("diagnostics.counted")}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region reached by keyboard
            tabIndex={0}
            className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            {diagnostics === undefined ? (
              <p className="m-0 text-muted-foreground">{t("diagnostics.loading")}</p>
            ) : diagnostics === null ? (
              <p className="m-0">{t("diagnostics.unavailable")}</p>
            ) : (
              <>
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="font-semibold">{t("diagnostics.install")}</dt>
                  <dd className="m-0 font-mono text-xs [overflow-wrap:anywhere]">
                    {diagnostics.installId}
                  </dd>
                  <dt className="font-semibold">{t("diagnostics.since")}</dt>
                  <dd className="m-0">{new Date(diagnostics.since).toLocaleDateString()}</dd>
                  {diagnostics.computer === null ? null : (
                    <>
                      <dt className="font-semibold">{t("diagnostics.computerLabel")}</dt>
                      <dd className="m-0">{computerWords(diagnostics.computer)}</dd>
                    </>
                  )}
                </dl>
                {SECTIONS.map((section) => {
                  // Only the counts this build words: one from a later build's summary is left out.
                  const rows = diagnostics.counts.flatMap((row) =>
                    isDiagnosticCount(row.field) && sectionOf(row.field) === section
                      ? [{ ...row, field: row.field }]
                      : [],
                  );
                  return (
                    <section key={section} aria-labelledby={`${id}-${section}`}>
                      <h3 id={`${id}-${section}`} className="m-0 mb-1 text-sm font-semibold">
                        {t(`diagnostics.section.${section}`)}
                      </h3>
                      {rows.length === 0 ? (
                        <p className="m-0 text-muted-foreground">{t("diagnostics.none")}</p>
                      ) : (
                        <ul className="m-0 list-none p-0">
                          {rows.map(({ field, name, count }) => (
                            <li key={`${field}/${name ?? ""}`}>
                              {t("diagnostics.row", { words: countWords(field, name), count })}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
                <section aria-labelledby={`${id}-timings`}>
                  <h3 id={`${id}-timings`} className="m-0 mb-1 text-sm font-semibold">
                    {t("diagnostics.section.timings")}
                  </h3>
                  <ul className="m-0 list-none p-0">
                    {diagnostics.timings.map(({ field, samples, medianMs }) =>
                      // Only the timings this build words.
                      !isDiagnosticTiming(field) ? null : (
                        <li key={field}>
                          {samples === 0
                            ? t("diagnostics.timing.none", {
                                words: t(`diagnostics.timing.${field}`),
                              })
                            : t("diagnostics.timing", {
                                words: t(`diagnostics.timing.${field}`),
                                samples,
                                seconds: (medianMs / 1000).toFixed(1),
                              })}
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              </>
            )}
          </section>
          <p role="status" className="m-0 min-h-5 text-sm">
            {status === null ? "" : t(`diagnostics.status.${status}`)}
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="ghost"
              disabled={diagnostics === undefined || diagnostics === null}
              onClick={() => setConfirming(true)}
            >
              {t("diagnostics.clear")}
            </Button>
            <Button variant="outline" onClick={props.onOpenFolder}>
              {t("diagnostics.openFolder")}
            </Button>
            <Button
              disabled={diagnostics === undefined || diagnostics === null}
              onClick={props.onSave}
            >
              {t("diagnostics.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("diagnostics.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("diagnostics.confirm.about")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("diagnostics.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={props.onClear}>
              {t("diagnostics.confirm.clear")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Props of {@link DiagnosticsWindow}. */
export type DiagnosticsWindowProps = {
  readonly api: Pick<
    AppApi,
    "getDiagnostics" | "saveDiagnostics" | "openDiagnosticsFolder" | "clearDiagnostics"
  >;
};

/**
 * Help › Diagnostics… (5.41, BD-2): registers its command, which the Help menu and the command
 * palette both list, and shows the summary as main reads it each time it opens. Mounted with the
 * app, so it's there with no site open.
 */
export function DiagnosticsWindow({ api }: DiagnosticsWindowProps) {
  const registry = useCommandRegistry();
  const [open, setOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null | undefined>(undefined);
  const [status, setStatus] = useState<DiagnosticsStatus | null>(null);

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.diagnostics,
        label: t("command.diagnostics"),
        menu: "help",
        run: () => {
          setStatus(null);
          setDiagnostics(undefined);
          setOpen(true);
          api.getDiagnostics().then(setDiagnostics, (error: unknown) => {
            reportFailure("diagnostics.read", error);
            setDiagnostics(null);
          });
        },
      }),
    [registry, api],
  );

  return (
    <DiagnosticsDialog
      open={open}
      onOpenChange={setOpen}
      diagnostics={diagnostics}
      status={status}
      onSave={() => {
        void api.saveDiagnostics().then(
          (saved) => {
            if (saved === "saved") setStatus("saved");
            else if (saved === "failed") setStatus("save-failed");
          },
          () => setStatus("save-failed"),
        );
      }}
      onOpenFolder={() => {
        void api.openDiagnosticsFolder().then(
          (opened) => setStatus(opened ? null : "folder-failed"),
          () => setStatus("folder-failed"),
        );
      }}
      onClear={() => {
        void api.clearDiagnostics().then(
          (cleared) => {
            setDiagnostics(cleared);
            setStatus("cleared");
          },
          (error: unknown) => reportFailure("diagnostics.clear", error),
        );
      }}
    />
  );
}
