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
  Check,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorText,
  TextInput,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useState } from "react";
import { AI_APP_NAME_MAX, type McpApi, type McpStatus } from "../../shared/ipc/mcp.js";

/** How often the dialog asks for the apps' status while open, so *Connected* follows them. */
export const STATUS_EVERY_MS = 2_000;

export type AiAppsDialogProps = {
  readonly open: boolean;
  readonly mcp: McpApi;
  /** Copies text, as the window's clipboard does. */
  readonly copyText: (text: string) => Promise<unknown>;
  /** Copies the key: out of clipboard history, and cleared from the clipboard in a minute. */
  readonly copySecret: (secret: string) => Promise<unknown>;
  /** Says what went wrong, in the window's toasts. */
  readonly notify: (message: string) => void;
  readonly onClose: () => void;
};

type AppStatus = McpStatus["apps"][number];

/** An app's status in words. */
const statusText = (app: AppStatus) =>
  app.connected
    ? t("aiApps.status.connected")
    : app.claimed
      ? t("aiApps.status.idle")
      : t("aiApps.status.waiting");

/** A pairing just made: shown once, then gone. */
type Shown = { readonly name: string; readonly key: string; readonly address: string };

/**
 * AI apps (F-AI-1, 4.9): whether they may connect, the paired ones with whether each is connected
 * now, *Add AI app* and *Remove*. Each acts at once: removing an app cuts it off. A new app's key
 * is shown once, to copy into the app, and never again.
 */
export function AiAppsDialog({
  open,
  mcp,
  copyText,
  copySecret,
  notify,
  onClose,
}: AiAppsDialogProps) {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | undefined>(undefined);
  const [shown, setShown] = useState<Shown | null>(null);
  const [copied, setCopied] = useState<"key" | "address" | null>(null);
  const [removing, setRemoving] = useState<AppStatus | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const refresh = () => {
      mcp.status().then(
        (next: McpStatus | undefined) => {
          if (live) setStatus(next ?? null);
        },
        () => {
          if (live) notify(t("aiApps.failed"));
        },
      );
    };
    refresh();
    const timer = setInterval(refresh, STATUS_EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [open, mcp, notify]);

  const act = (work: Promise<McpStatus>) => work.then(setStatus, () => notify(t("aiApps.failed")));

  const add = async () => {
    const result = await mcp.add(adding ?? "").catch(() => null);
    if (result === null) return notify(t("aiApps.failed"));
    if (result.status !== "paired") return setAddError(t(`aiApps.add.failed.${result.status}`));
    setAdding(null);
    setAddError(undefined);
    setShown({ name: result.app.name, key: result.key, address: result.address });
    await act(mcp.status());
  };

  const copy = (what: "key" | "address", text: string) => {
    const copying = what === "key" ? copySecret(text) : copyText(text);
    void copying.then(
      () => setCopied(what),
      () => notify(t("aiApps.failed")),
    );
  };

  const closeShown = () => {
    // The key goes with the dialog's state: it is never shown again.
    setShown(null);
    setCopied(null);
  };

  const enabled = status?.enabled ?? false;
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("aiApps.title")}</DialogTitle>
          <DialogDescription>{t("aiApps.description")}</DialogDescription>
        </DialogHeader>
        {status === null ? null : (
          <div className="flex flex-col gap-4">
            <Check
              label={t("aiApps.enabled")}
              hint={t("aiApps.enabledHint")}
              checked={enabled}
              onChange={(checked) => void act(mcp.setEnabled(checked))}
            />
            {status.moved ? <p className="text-sm">{t("aiApps.moved")}</p> : null}
            {shown !== null ? (
              <section aria-label={t("aiApps.key.title", { name: shown.name })}>
                <h3 className="font-medium">{t("aiApps.key.title", { name: shown.name })}</h3>
                <p className="text-sm">{t("aiApps.key.once", { name: shown.name })}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
                  <dt>{t("aiApps.key.address")}</dt>
                  <dd className="break-all font-mono">{shown.address}</dd>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy("address", shown.address)}
                  >
                    {copied === "address" ? t("aiApps.key.copied") : t("aiApps.key.copyAddress")}
                  </Button>
                  <dt>{t("aiApps.key.key")}</dt>
                  <dd className="break-all font-mono">{shown.key}</dd>
                  <Button variant="outline" size="sm" onClick={() => copy("key", shown.key)}>
                    {copied === "key" ? t("aiApps.key.copied") : t("aiApps.key.copyKey")}
                  </Button>
                </dl>
                {/* Empty, it takes no room: the screenshots of a key not yet copied stay as they were. */}
                <p role="status" className={copied === "key" ? "mt-2 text-sm" : "text-sm"}>
                  {copied === "key" ? t("aiApps.key.cleared") : null}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t("aiApps.key.how")}</p>
                <Button className="mt-2" onClick={closeShown}>
                  {t("aiApps.key.done")}
                </Button>
              </section>
            ) : adding !== null ? (
              <section aria-label={t("aiApps.add")} className="flex flex-col gap-2">
                <TextInput
                  label={t("aiApps.add.name")}
                  hint={t("aiApps.add.nameHint")}
                  value={adding}
                  maxLength={AI_APP_NAME_MAX}
                  onChange={(name) => {
                    setAdding(name);
                    setAddError(undefined);
                  }}
                />
                <ErrorText message={addError} />
                <p className="text-sm">{t("aiApps.add.shared")}</p>
                <div className="flex gap-2">
                  <Button onClick={() => void add()}>{t("aiApps.add.confirm")}</Button>
                  <Button variant="outline" onClick={() => setAdding(null)}>
                    {t("aiApps.cancel")}
                  </Button>
                </div>
              </section>
            ) : (
              <Button className="self-start" disabled={!enabled} onClick={() => setAdding("")}>
                {t("aiApps.add")}
              </Button>
            )}
            <section aria-label={t("aiApps.list")}>
              {status.apps.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("aiApps.none")}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {status.apps.map((app) => (
                    <li key={app.id} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="font-medium">{app.name}</span>{" "}
                        <span className="text-sm text-muted-foreground">{statusText(app)}</span>
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setRemoving(app)}>
                        {t("aiApps.remove", { name: app.name })}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => (next ? undefined : setRemoving(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("aiApps.removeTitle", { name: removing?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("aiApps.removeDescription", { name: removing?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("aiApps.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing !== null) void act(mcp.remove(removing.id));
                setRemoving(null);
              }}
            >
              {t("aiApps.removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
