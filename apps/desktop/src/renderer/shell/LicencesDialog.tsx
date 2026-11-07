import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
  toast,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { AppApi, Notice } from "../../shared/ipc/app.js";
import { reportFailure } from "../log.js";
import { useCommandRegistry } from "./command-context.js";
import { COMMAND_IDS } from "./command-ids.js";

/** What the screen asks the main process for: the app's notices, and Chromium's licences. */
export type LicencesApi = Pick<AppApi, "listLicences" | "openChromiumLicences">;

/** The packages once listed, while they're read, or that they couldn't be. */
type Listing =
  | { readonly status: "loading" | "failed" }
  | {
      readonly status: "listed";
      readonly packages: readonly Notice[];
    };

/** Whether `notice` is one the person is looking for: `query` in its name or its licence. */
const matches = (notice: Notice, query: string) => {
  const wanted = query.trim().toLowerCase();
  return (
    wanted === "" ||
    notice.name.toLowerCase().includes(wanted) ||
    notice.licence.toLowerCase().includes(wanted)
  );
};

export type LicencesDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly licences: LicencesApi;
};

/**
 * Help → Open-Source Licences (5.3, C1): every package {appName} ships, each with its version and
 * licence, its licence's own text shown when opened, found by name or licence; and Chromium's
 * Licences, which opens Electron's list of Chromium's in the browser. Read afresh each time it
 * opens.
 */
export function LicencesDialog({ open, onOpenChange, licences }: LicencesDialogProps) {
  const [listing, setListing] = useState<Listing>({ status: "loading" });
  const [query, setQuery] = useState("");
  const searchId = useId();

  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    setListing({ status: "loading" });
    licences.listLicences().then(
      (result) => {
        if (current) setListing(result);
      },
      (error: unknown) => {
        reportFailure("licences.list", error);
        if (current) setListing({ status: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [open, licences]);

  const openChromium = () => {
    licences.openChromiumLicences().then(
      (opened) => {
        if (!opened) toast.error(t("licences.chromiumFailed"));
      },
      (error: unknown) => {
        reportFailure("licences.chromium", error);
        toast.error(t("licences.chromiumFailed"));
      },
    );
  };

  const shown =
    listing.status === "listed" ? listing.packages.filter((each) => matches(each, query)) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("licences.title")}</DialogTitle>
          <DialogDescription>{t("licences.description")}</DialogDescription>
        </DialogHeader>
        {listing.status !== "listed" ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t(listing.status === "loading" ? "licences.loading" : "licences.failed")}
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <label htmlFor={searchId} className="text-sm font-medium">
                {t("licences.search")}
              </label>
              <input
                id={searchId}
                type="search"
                className={fieldControlClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <p role="status" className="text-xs text-muted-foreground">
              {t("licences.count", { shown: shown.length, total: listing.packages.length })}
            </p>
            {/* A plain scroller, as Version History's: the dialog keeps its height on screen. */}
            <ul
              aria-label={t("licences.list")}
              className="min-h-0 flex-1 divide-y overflow-y-auto rounded-md border"
            >
              {shown.map((notice) => (
                <NoticeRow key={`${notice.name}@${notice.version}`} notice={notice} />
              ))}
            </ul>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={openChromium}>
            {t("licences.chromium")}
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("licences.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One package: its name, version and licence, and its licence's text once opened. */
function NoticeRow({ notice }: { readonly notice: Notice }) {
  // Drawn only once opened: all of them together run to hundreds of kilobytes.
  const [opened, setOpened] = useState(false);
  return (
    <li>
      <details className="group" onToggle={(event) => setOpened(event.currentTarget.open)}>
        <summary className="flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm hover:bg-hover">
          <ChevronRightIcon
            aria-hidden
            className="size-3.5 shrink-0 self-center text-muted-foreground transition-transform group-open:rotate-90"
          />
          <span className="min-w-0 flex-1 break-all">
            <span className="font-medium">{notice.name}</span>{" "}
            <span className="text-muted-foreground">{notice.version}</span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{notice.licence}</span>
        </summary>
        {opened ? (
          <div className="space-y-2 px-3 pb-3">
            {notice.homepage === undefined ? null : (
              <p className="m-0 break-all text-xs text-muted-foreground">{notice.homepage}</p>
            )}
            <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap rounded-sm bg-muted p-2 text-xs">
              {notice.text ?? t("licences.noText", { licence: notice.licence })}
            </pre>
          </div>
        ) : null}
      </details>
    </li>
  );
}

/**
 * Help → Open-Source Licences: registers its command, and draws {@link LicencesDialog} when it
 * runs. About {appName} opens it too.
 */
export function OpenSourceLicences({ licences }: { readonly licences: LicencesApi }) {
  const registry = useCommandRegistry();
  const [open, setOpen] = useState(false);

  useEffect(
    () =>
      registry.register({
        id: COMMAND_IDS.licences,
        label: t("command.licences"),
        menu: "help",
        run: () => setOpen(true),
      }),
    [registry],
  );

  return <LicencesDialog open={open} onOpenChange={setOpen} licences={licences} />;
}
