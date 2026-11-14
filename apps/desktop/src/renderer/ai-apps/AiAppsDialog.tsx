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
  AI_CLIENTS,
  type AiClientId,
  clientOf,
  DEFAULT_CLIENT,
} from "../../shared/ai-clients/index.js";
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

/** Which kind of app is added: one of `AI_CLIENTS` (#980), each with its own setup. */
type Kind = AiClientId;

const isKind = (value: string): value is Kind => AI_CLIENTS.some((client) => client.id === value);

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

/**
 * A row of the pairing's list: what it is, its value and a button that copies it. The button is in
 * the `dd` with the value, as a list holds only terms and values; `contents` keeps both in the
 * list's grid columns.
 */
function CopyRow({
  label,
  value,
  copyLabel,
  onCopy,
}: {
  readonly label: string;
  readonly value: string;
  readonly copyLabel: string;
  readonly onCopy: () => void;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="contents">
        <code className="break-all font-mono">{value}</code>
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copyLabel}
        </Button>
      </dd>
    </>
  );
}

/**
 * A just-paired app's setup, as its kind has it (#980): its steps, what to copy, its install and
 * what that came to, or where the key goes and what an app that doesn't check costs.
 */
function ShownSetup({
  shown,
  copied,
  installed,
  onCopy,
  onInstall,
}: {
  readonly shown: Shown;
  readonly copied: "key" | "address" | "command" | null;
  readonly installed: McpInstallResult["status"] | null;
  readonly onCopy: (what: "key" | "address" | "command", text: string) => void;
  readonly onInstall: () => void;
}) {
  const client = clientOf(shown.kind);
  const extra = client.copy;
  // The address, as a value of its own: the generic app's only; another copies what it makes of it.
  const what = extra?.value(shown.address) === shown.address ? "address" : "command";
  return (
    <>
      {client.steps === undefined ? null : (
        <>
          <h4 className="mt-2 text-sm font-medium">{client.steps.title()}</h4>
          <ol className="list-decimal pl-5 text-sm">
            {client.steps.items().map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      )}
      <dl className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
        {extra === undefined ? null : (
          <CopyRow
            label={extra.label()}
            value={extra.value(shown.address)}
            copyLabel={copied === what ? t("aiApps.key.copied") : extra.copyLabel()}
            onCopy={() => onCopy(what, extra.value(shown.address))}
          />
        )}
        <CopyRow
          label={t("aiApps.key.key")}
          value={shown.key}
          copyLabel={copied === "key" ? t("aiApps.key.copied") : t("aiApps.key.copyKey")}
          onCopy={() => onCopy("key", shown.key)}
        />
      </dl>
      {/* Empty, it takes no room: the screenshots of a key not yet copied stay as they were. */}
      <p role="status" className={copied === "key" ? "mt-2 text-sm" : "text-sm"}>
        {copied === "key" ? t("aiApps.key.cleared") : null}
      </p>
      {client.install === undefined ? null : (
        <>
          <Button className="mt-2" variant="outline" onClick={onInstall}>
            {client.install.label()}
          </Button>
          <p role="status" className={installed === null ? "text-sm" : "mt-2 text-sm"}>
            {installed === null ? null : client.install.said(installed, shown.name)}
          </p>
        </>
      )}
      {client.note === undefined ? null : (
        <p className="mt-2 text-sm text-muted-foreground">{client.note()}</p>
      )}
      {/* An app that doesn't check it's Webforge it talks to sends its key to whatever answers. */}
      {client.verifiesServer ? null : <p className="mt-2 text-sm">{t("aiApps.key.risk")}</p>}
    </>
  );
}

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
  // Shown for as long as the dialog stays open, though main forgets it once it's been seen (S27).
  const [moved, setMoved] = useState(false);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [addError, setAddError] = useState<string | undefined>(undefined);
  const [shown, setShown] = useState<Shown | null>(null);
  const [copied, setCopied] = useState<"key" | "address" | "command" | null>(null);
  const [removing, setRemoving] = useState<AppStatus | null>(null);
  const [installed, setInstalled] = useState<McpInstallResult["status"] | null>(null);
  const whichId = useId();
  // Opened again: no *moved* note from last time, from its first frame (#990).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMoved(false);
  }

  useEffect(() => {
    if (!open) return;
    let live = true;
    const refresh = () => {
      mcp.status().then(
        (next: McpStatus | undefined) => {
          if (!live) return;
          setStatus(next ?? null);
          if (next?.moved === true) {
            setMoved(true);
            void mcp.seenMoved().catch(() => undefined);
          }
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
    const result = await mcp.add(adding.name, adding.kind).catch(() => null);
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

  const copy = (what: "key" | "address" | "command", text: string) => {
    const copying = what === "key" ? copySecret(text) : copyText(text);
    void copying.then(
      () => setCopied(what),
      () => notify(t("aiApps.failed")),
    );
  };

  /**
   * Switches the kind of app being added, offering its name for it: a name the person typed stays,
   * and one offered for another kind is replaced.
   */
  const choose = (kind: Kind) => {
    setAdding((current) => {
      const name = current?.name ?? "";
      const offered = name === "" || AI_CLIENTS.some((each) => each.defaultName() === name);
      return { kind, name: offered ? clientOf(kind).defaultName() : name };
    });
    setAddError(undefined);
  };

  const install = (id: string) => {
    void mcp.install(id).then(
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
            {moved ? <p className="text-sm">{t("aiApps.moved")}</p> : null}
            {shown !== null ? (
              <section aria-label={t("aiApps.key.title", { name: shown.name })}>
                <h3 className="font-medium">{t("aiApps.key.title", { name: shown.name })}</h3>
                <p className="text-sm">{t("aiApps.key.once", { name: shown.name })}</p>
                <ShownSetup
                  shown={shown}
                  copied={copied}
                  installed={installed}
                  onCopy={copy}
                  onInstall={() => install(shown.id)}
                />
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
                  className="grid w-full grid-cols-2"
                  value={adding.kind}
                  onValueChange={(next) => {
                    if (isKind(next)) choose(next);
                  }}
                >
                  {AI_CLIENTS.map((client) => (
                    <ToggleGroupItem key={client.id} value={client.id}>
                      {client.label()}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="text-sm text-muted-foreground">{clientOf(adding.kind).hint()}</p>
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
              <Button
                className="self-start"
                disabled={!enabled}
                onClick={() => choose(DEFAULT_CLIENT)}
              >
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
