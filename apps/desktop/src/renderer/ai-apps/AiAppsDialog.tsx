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
  ToggleGroup,
  ToggleGroupItem,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { useEffect, useId, useState } from "react";
import {
  AI_APP_NAME_MAX,
  type McpApi,
  type McpInstallResult,
  type McpStatus,
} from "../../shared/ipc/mcp.js";

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

/**
 * Which kind of app is added: Claude Desktop, through an extension that checks it's Webforge it
 * talks to; or another app, such as a developer tool, at the address (ADR 0021).
 */
type Kind = "claude" | "other";

/** An app being added: its kind, and the name typed so far. */
type Adding = { readonly kind: Kind; readonly name: string };

/** A pairing just made: shown once, then gone. */
type Shown = {
  readonly id: string;
  readonly kind: Kind;
  readonly name: string;
  readonly key: string;
  readonly address: string;
};

/** What *Install in Claude Desktop* came to, in words. */
const installText = (status: McpInstallResult["status"]) =>
  status === "opened"
    ? t("aiApps.claude.opened")
    : status === "shown"
      ? t("aiApps.claude.shown")
      : status === "off"
        ? t("aiApps.add.failed.off")
        : t("aiApps.claude.failed");

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
  const [adding, setAdding] = useState<Adding | null>(null);
  const [addError, setAddError] = useState<string | undefined>(undefined);
  const [shown, setShown] = useState<Shown | null>(null);
  const [copied, setCopied] = useState<"key" | "address" | null>(null);
  const [removing, setRemoving] = useState<AppStatus | null>(null);
  const [installed, setInstalled] = useState<McpInstallResult["status"] | null>(null);
  const whichId = useId();

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
    if (adding === null) return;
    const result = await mcp.add(adding.name).catch(() => null);
    if (result === null) return notify(t("aiApps.failed"));
    if (result.status !== "paired") return setAddError(t(`aiApps.add.failed.${result.status}`));
    setAdding(null);
    setAddError(undefined);
    setShown({
      id: result.app.id,
      kind: adding.kind,
      name: result.app.name,
      key: result.key,
      address: result.address,
    });
    await act(mcp.status());
  };

  const copy = (what: "key" | "address", text: string) => {
    const copying = what === "key" ? copySecret(text) : copyText(text);
    void copying.then(
      () => setCopied(what),
      () => notify(t("aiApps.failed")),
    );
  };

  /** Switches the kind of app being added, offering Claude Desktop's name for it. */
  const choose = (kind: Kind) => {
    setAdding((current) => {
      const claudeName = t("aiApps.add.claude");
      const name = current?.name ?? "";
      if (kind === "claude") return { kind, name: name === "" ? claudeName : name };
      return { kind, name: name === claudeName ? "" : name };
    });
    setAddError(undefined);
  };

  const install = (id: string) => {
    void mcp.installClaude(id).then(
      (result: McpInstallResult | undefined) => setInstalled(result?.status ?? "failed"),
      () => setInstalled("failed"),
    );
  };

  const closeShown = () => {
    // The key goes with the dialog's state: it is never shown again.
    setShown(null);
    setCopied(null);
    setInstalled(null);
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
                {shown.kind === "claude" ? (
                  <>
                    <h4 className="mt-2 text-sm font-medium">{t("aiApps.claude.steps")}</h4>
                    <ol className="list-decimal pl-5 text-sm">
                      <li>{t("aiApps.claude.step1")}</li>
                      <li>{t("aiApps.claude.step2")}</li>
                      <li>{t("aiApps.claude.step3")}</li>
                    </ol>
                  </>
                ) : null}
                <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
                  {shown.kind === "other" ? (
                    <>
                      <dt>{t("aiApps.key.address")}</dt>
                      <dd className="break-all font-mono">{shown.address}</dd>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copy("address", shown.address)}
                      >
                        {copied === "address"
                          ? t("aiApps.key.copied")
                          : t("aiApps.key.copyAddress")}
                      </Button>
                    </>
                  ) : null}
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
                {shown.kind === "claude" ? (
                  <>
                    <Button className="mt-2" variant="outline" onClick={() => install(shown.id)}>
                      {t("aiApps.claude.install")}
                    </Button>
                    <p role="status" className={installed === null ? "text-sm" : "mt-2 text-sm"}>
                      {installed === null ? null : installText(installed)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">{t("aiApps.key.how")}</p>
                    <p className="mt-2 text-sm">{t("aiApps.key.risk")}</p>
                  </>
                )}
                <Button className="mt-2 block" onClick={closeShown}>
                  {t("aiApps.key.done")}
                </Button>
              </section>
            ) : adding !== null ? (
              <section aria-label={t("aiApps.add")} className="flex flex-col gap-2">
                <p id={whichId} className="text-sm font-medium">
                  {t("aiApps.add.which")}
                </p>
                <ToggleGroup
                  type="single"
                  aria-labelledby={whichId}
                  className="flex w-full"
                  value={adding.kind}
                  onValueChange={(next) => {
                    if (next === "claude" || next === "other") choose(next);
                  }}
                >
                  <ToggleGroupItem value="claude" className="flex-1">
                    {t("aiApps.add.claude")}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="other" className="flex-1">
                    {t("aiApps.add.other")}
                  </ToggleGroupItem>
                </ToggleGroup>
                <p className="text-sm text-muted-foreground">
                  {adding.kind === "claude"
                    ? t("aiApps.add.claudeHint")
                    : t("aiApps.add.otherHint")}
                </p>
                <TextInput
                  label={t("aiApps.add.name")}
                  hint={t("aiApps.add.nameHint")}
                  value={adding.name}
                  maxLength={AI_APP_NAME_MAX}
                  onChange={(name) => {
                    setAdding({ kind: adding.kind, name });
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
              <Button className="self-start" disabled={!enabled} onClick={() => choose("claude")}>
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
