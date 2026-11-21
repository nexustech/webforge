import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useId, useRef, useState } from "react";
import { type AppApi, REPORT_TEXT_MAX, type ReportInfo } from "../../shared/ipc/app.js";
import { reportFailure } from "../log.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";
import type { PreferencesStore } from "./preferences-store.js";

/** What the person was last told: what became of their last action, if anything. */
export type ReportStatus =
  | "copied"
  | "opened-issue"
  | "opened-mail"
  | "open-failed"
  | "captured"
  | "capture-failed"
  | "saved"
  | "save-failed";

/** How long the draft waits after the last keystroke before it's kept. */
const KEEP_AFTER_MS = 500;

/** The report's text as {@link ReportProblem} copies it: the message, the version and system. */
function reportText(text: string, info: ReportInfo): string {
  return `${text.trim()}\n\n${t("help.report.details", { version: info.version, system: info.system })}`;
}

/** Props of {@link ReportProblemDialog}. */
export type ReportProblemDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The version and system sent with it, once main has said; where it can be sent. */
  readonly info: ReportInfo | null;
  readonly text: string;
  readonly onTextChange: (text: string) => void;
  /** The screenshot taken, as a small JPEG, or none. */
  readonly screenshot: string | null;
  readonly status: ReportStatus | null;
  readonly onCopy: () => void;
  readonly onOpen: (route: "issue" | "mail") => void;
  readonly onTakeScreenshot: () => void;
  readonly onSaveScreenshot: () => void;
  readonly onRemoveScreenshot: () => void;
  readonly onClear: () => void;
};

/**
 * Help › Report a Problem's dialog (5.23, OL-10): the person's message, what's sent with it, and a
 * screenshot of the window if they take one, all shown before anything leaves {appName}. It sends
 * nothing: *Open a GitHub Issue* or *Write an Email* opens the report in their browser or mail
 * app, for them to send; *Copy My Message* is always there.
 */
export function ReportProblemDialog(props: ReportProblemDialogProps) {
  const id = useId();
  const { info, text, screenshot, status } = props;
  const empty = text.trim() === "";
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("help.report.title")}</DialogTitle>
          <DialogDescription>{t("help.report.about")}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-text`} className="text-sm font-semibold">
              {t("help.report.message")}
            </label>
            <textarea
              id={`${id}-text`}
              value={text}
              rows={6}
              maxLength={REPORT_TEXT_MAX}
              placeholder={t("help.report.placeholder")}
              className="w-full resize-y rounded-sm border border-border bg-input px-2 py-1 text-sm"
              onChange={(event) => props.onTextChange(event.currentTarget.value)}
            />
          </div>
          {info === null ? null : (
            <p className="m-0 text-sm text-muted-foreground">
              {t("help.report.sentWith", {
                details: t("help.report.details", { version: info.version, system: info.system }),
              })}
            </p>
          )}
          <section aria-labelledby={`${id}-screenshot`} className="flex flex-col gap-2">
            <h3 id={`${id}-screenshot`} className="m-0 text-sm font-semibold">
              {t("help.report.screenshot.title")}
            </h3>
            {screenshot === null ? (
              <div>
                <Button variant="outline" size="sm" onClick={props.onTakeScreenshot}>
                  {t("help.report.screenshot.take")}
                </Button>
              </div>
            ) : (
              <>
                <img
                  src={screenshot}
                  alt={t("help.report.screenshot.alt")}
                  className="max-h-48 w-fit max-w-full rounded-sm border border-border"
                />
                <p className="m-0 text-sm text-muted-foreground">
                  {t("help.report.screenshot.attach")}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={props.onSaveScreenshot}>
                    {t("help.report.screenshot.save")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={props.onRemoveScreenshot}>
                    {t("help.report.screenshot.remove")}
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
        {/* Outside the scrolling part: what became of the last action is always in view. */}
        <p role="status" className="m-0 min-h-5 text-sm">
          {status === null ? "" : t(`help.report.status.${status}`)}
        </p>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" disabled={empty} onClick={props.onClear}>
            {t("help.report.clear")}
          </Button>
          <Button variant="outline" disabled={empty || info === null} onClick={props.onCopy}>
            {t("help.report.copy")}
          </Button>
          {info?.mail === true ? (
            <Button variant="outline" disabled={empty} onClick={() => props.onOpen("mail")}>
              {t("help.report.mail")}
            </Button>
          ) : null}
          <Button disabled={empty} onClick={() => props.onOpen("issue")}>
            {t("help.report.issue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Props of {@link ReportProblem}. */
export type ReportProblemProps = {
  readonly api: Pick<
    AppApi,
    "getReportInfo" | "openReport" | "captureWindow" | "saveWindowCapture" | "discardWindowCapture"
  >;
  readonly copyText: (text: string) => Promise<unknown>;
  /** Where the message is kept until it's sent or cleared: the person's preferences. */
  readonly preferences: PreferencesStore;
};

/** Two animation frames: the dialog gone from the window before the screenshot is taken. */
const nextPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

/**
 * Help › Report a Problem (5.23, OL-10): registers its command, and shows its dialog with the
 * message kept in the person's preferences, so it survives the dialog closing and the app
 * restarting until they clear it. Mounted with the app, so it's there with no site open.
 */
export function ReportProblem({ api, copyText, preferences }: ReportProblemProps) {
  const registry = useCommandRegistry();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ReportInfo | null>(null);
  const [text, setText] = useState(() => preferences.getState().preferences.reportDraft);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<ReportStatus | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keep = (next: string) => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      pending.current = null;
      preferences.change({ reportDraft: next });
    }, KEEP_AFTER_MS);
  };
  const keepNow = (next: string) => {
    if (pending.current !== null) clearTimeout(pending.current);
    pending.current = null;
    preferences.change({ reportDraft: next });
  };

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.reportProblem,
        label: t("command.reportProblem"),
        menu: "help",
        run: () => {
          setStatus(null);
          setOpen(true);
          api
            .getReportInfo()
            .then(setInfo, (error: unknown) => reportFailure("report.info", error));
        },
      }),
    [registry, api],
  );

  const close = () => {
    keepNow(text);
    setOpen(false);
    setScreenshot(null);
    void api.discardWindowCapture().catch(() => undefined);
  };

  return (
    <ReportProblemDialog
      open={open && !capturing}
      onOpenChange={(next) => {
        if (!next && !capturing) close();
      }}
      info={info}
      text={text}
      onTextChange={(next) => {
        setText(next);
        keep(next);
      }}
      screenshot={screenshot}
      status={status}
      onCopy={() => {
        if (info === null) return;
        void copyText(reportText(text, info)).then(
          () => setStatus("copied"),
          (error: unknown) => reportFailure("report.copy", error),
        );
      }}
      onOpen={(route) => {
        keepNow(text);
        void api.openReport(route, text).then(
          (opened) =>
            setStatus(
              opened === "opened"
                ? route === "issue"
                  ? "opened-issue"
                  : "opened-mail"
                : "open-failed",
            ),
          () => setStatus("open-failed"),
        );
      }}
      onTakeScreenshot={() => {
        // The window as the person sees it, without this dialog over it.
        setCapturing(true);
        void nextPaint()
          .then(() => api.captureWindow())
          .then(
            (taken) => {
              if (taken.status === "captured") setScreenshot(taken.preview);
              setStatus(taken.status === "captured" ? "captured" : "capture-failed");
            },
            () => setStatus("capture-failed"),
          )
          .finally(() => setCapturing(false));
      }}
      onSaveScreenshot={() => {
        void api.saveWindowCapture().then(
          (saved) => {
            if (saved === "saved") setStatus("saved");
            else if (saved !== "cancelled") setStatus("save-failed");
          },
          () => setStatus("save-failed"),
        );
      }}
      onRemoveScreenshot={() => {
        setScreenshot(null);
        setStatus(null);
        void api.discardWindowCapture().catch(() => undefined);
      }}
      onClear={() => {
        setText("");
        setStatus(null);
        keepNow("");
      }}
    />
  );
}
