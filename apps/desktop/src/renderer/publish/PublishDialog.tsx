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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  type FileTransferDestination,
  type FileTransferTrust,
  PUBLISH_DESTINATIONS_MAX,
  type PublishDestination,
} from "@webforge/model";
import { useEffect, useRef, useState } from "react";
import type {
  ConnectionResult,
  DestinationsFailure,
  ListedDestination,
  PublishApi,
} from "../../shared/ipc/publish.js";
import { HelpButton } from "../help/index.js";
import {
  connectionMessage,
  FileTransferDestinationDialog,
  type FileTransferSaved,
} from "./FileTransferDestinationDialog.js";
import {
  type NetlifyAccount,
  type NetlifyDestinationApi,
  NetlifyDestinationDialog,
  type NetlifyFailure,
  type NetlifySaved,
  type NetlifySite,
  netlifyFailureMessage,
} from "./NetlifyDestinationDialog.js";

/** The person's words for why the destinations couldn't be read or changed. */
function failureMessage(reason: DestinationsFailure): string {
  return reason === "full"
    ? t("publish.destinations.failed.full", { max: PUBLISH_DESTINATIONS_MAX })
    : t(`publish.destinations.failed.${reason}`);
}

/** What saving a destination gives: as {@link PublishApi}'s `saveDestination` does. */
type SaveResult = Awaited<ReturnType<PublishApi["saveDestination"]>>;

/**
 * What the main process does for Netlify destinations (4.4b, 4.2's IPC): signing in and the
 * account's sites, as the Netlify dialog asks; a new site made; and a destination saved with the
 * sign-in it made, or the one saved for it.
 */
export type NetlifyPublishApi = NetlifyDestinationApi & {
  /** Makes a Netlify site in `account`, named `name` if it's free, else as Netlify names it. */
  readonly createSite: (
    account: NetlifyAccount,
    name: string | undefined,
  ) => Promise<
    | { readonly status: "created"; readonly site: NetlifySite }
    | { readonly status: "failed"; readonly reason: NetlifyFailure }
  >;
  /** Test connection for saved destination `id`: its sign-in still reaches its site. */
  readonly testSaved: (id: string) => Promise<ConnectionResult>;
  /** Saves a Netlify destination for `site`, with the sign-in just made or the one it has. */
  readonly save: (
    draft: { readonly id?: string; readonly name: string; readonly site: NetlifySite },
    signIn: NetlifySaved["signIn"],
  ) => Promise<SaveResult>;
};

/** What the main process does for the dialog: the site's destinations, and their tests. */
export type PublishDialogApi = Pick<
  PublishApi,
  | "destinations"
  | "saveDestination"
  | "removeDestination"
  | "testSavedDestination"
  | "testConnection"
  | "readHostKey"
  | "chooseKeyFile"
>;

export type PublishDialogProps = {
  readonly open: boolean;
  /**
   * The name of the saved version the destinations republish (4.6b), shown in the title, each
   * one's Publish becoming Republish; the open site is published when left out.
   */
  readonly republishing?: string;
  readonly publish: PublishDialogApi;
  /** Netlify destinations (4.4b): offered in Add Destination when given. */
  readonly netlify?: NetlifyPublishApi;
  /** The opening of the site this window was loaded for (R6). */
  readonly sessionId: () => string;
  /** Says what went wrong, in the window's toasts. */
  readonly notify: (message: string) => void;
  /** A destination was saved: Site Settings may take its web address. */
  readonly onSaved: (destination: PublishDestination) => void;
  /** The site's destinations, each time the dialog reads them: as it opens, and after a change. */
  readonly onListed?: ((destinations: readonly PublishDestination[]) => void) | undefined;
  /** Publishes the site to `destination` (4.5); the dialog closes as it starts. */
  readonly onPublish: (destination: PublishDestination) => void;
  readonly onClose: () => void;
};

/** A destination being added (none yet) or edited, and of which kind. */
type Editing = {
  readonly kind: PublishDestination["kind"];
  readonly listed: ListedDestination | undefined;
};

/** Each destination's last test, by its id: running, or what it found. */
type Tests = Readonly<Record<string, ConnectionResult | "testing">>;

/**
 * Publish (F-PB-1, 4.4a): the site's publish destinations, several allowed, each with its name,
 * host and folder, and whether this computer has its password. Add one, edit it, test it or
 * remove it; 4.3's form adds and edits them. Publish, each one's first action, publishes the site
 * there (4.5) once this computer has its password; or, from Version History, Republish publishes
 * a saved version there (4.6b).
 */
export function PublishDialog({
  open,
  republishing,
  publish,
  netlify,
  sessionId,
  notify,
  onSaved,
  onListed,
  onPublish,
  onClose,
}: PublishDialogProps) {
  const [listed, setListed] = useState<readonly ListedDestination[] | undefined>();
  const [editing, setEditing] = useState<Editing | undefined>();
  const [removing, setRemoving] = useState<ListedDestination | undefined>();
  const [tests, setTests] = useState<Tests>({});
  // A Netlify save under way, which a second Save leaves be; and the site the last one made, which
  // a retry with the same sign-in and name uses rather than making another on the account.
  const netlifySaving = useRef(false);
  const madeSite = useRef<{ readonly key: string; readonly site: NetlifySite }>(undefined);
  // Raised to read the list again, after a change.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((last) => last + 1);

  // Read afresh each time the dialog opens, and after each change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `version` reads it again.
  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    publish.destinations(sessionId()).then(
      (result) => {
        if (!current) return;
        setListed(result.status === "listed" ? result.destinations : []);
        if (result.status === "listed") {
          onListed?.(result.destinations.map(({ destination }) => destination));
        }
        if (result.status === "failed") notify(failureMessage(result.reason));
      },
      () => {
        if (!current) return;
        setListed([]);
        notify(failureMessage("unknown"));
      },
    );
    return () => {
      current = false;
    };
  }, [open, version, publish, sessionId, notify, onListed]);

  const testSaved = async (
    id: string,
    settings: FileTransferDestination,
    trust: FileTransferTrust,
  ): Promise<ConnectionResult> => {
    const result = await publish.testSavedDestination(sessionId(), id, settings, trust);
    return "status" in result ? { ok: false, code: "failed" } : result;
  };

  /** A Netlify destination's test: its sign-in still works, and its site is still there. */
  const testNetlify = (id: string): Promise<ConnectionResult> =>
    netlify === undefined ? Promise.resolve({ ok: false, code: "failed" }) : netlify.testSaved(id);

  const test = async ({ destination, trust }: ListedDestination) => {
    setTests((all) => ({ ...all, [destination.id]: "testing" }));
    const result =
      destination.kind === "file-transfer"
        ? await testSaved(destination.id, destination.settings, trust)
        : await testNetlify(destination.id);
    setTests((all) => ({ ...all, [destination.id]: result }));
  };

  const save = async (saved: FileTransferSaved) => {
    const id = editing?.listed?.destination.id;
    const result = await publish.saveDestination(
      sessionId(),
      { ...(id === undefined ? {} : { id }), name: saved.name, settings: saved.destination },
      saved.signIn,
      saved.trust,
    );
    if (result.status === "saved") {
      setEditing(undefined);
      onSaved(result.destination);
      reload();
      return;
    }
    notify(
      result.status === "sign-in-needed"
        ? t("publish.destinations.signInNeeded")
        : failureMessage(result.reason),
    );
  };

  /** Saves a Netlify destination, making its new site first when it asks for one. */
  const saveNetlify = (saved: NetlifySaved) => {
    if (netlify === undefined || netlifySaving.current) return;
    netlifySaving.current = true;
    saveNetlifyNow(netlify, saved)
      .catch(() => notify(failureMessage("unknown")))
      .finally(() => {
        netlifySaving.current = false;
      });
  };

  const saveNetlifyNow = async (calls: NetlifyPublishApi, saved: NetlifySaved) => {
    const id = editing?.listed?.destination.id;
    const account: NetlifyAccount =
      "handle" in saved.signIn ? { handle: saved.signIn.handle } : { saved: id ?? "" };
    let site: NetlifySite;
    let name = saved.name;
    if ("create" in saved.site) {
      const key = JSON.stringify([account, saved.site.create ?? null]);
      let made = madeSite.current?.key === key ? madeSite.current.site : undefined;
      if (made === undefined) {
        const created = await calls.createSite(account, saved.site.create);
        if (created.status === "failed") {
          notify(netlifyFailureMessage(created.reason));
          return;
        }
        made = created.site;
        madeSite.current = { key, site: made };
      }
      site = made;
      // Left unnamed, as the new site was: listed by the name Netlify gave it.
      if (saved.site.create === undefined && name === t("publish.netlify.defaultName")) {
        name = made.name;
      }
    } else {
      site = saved.site;
    }
    const result = await calls.save(
      { ...(id === undefined ? {} : { id }), name, site },
      saved.signIn,
    );
    if (result.status === "saved") {
      madeSite.current = undefined;
      setEditing(undefined);
      onSaved(result.destination);
      reload();
      return;
    }
    notify(
      result.status === "sign-in-needed"
        ? t("publish.destinations.signInNeeded")
        : failureMessage(result.reason),
    );
  };

  const remove = async ({ destination }: ListedDestination) => {
    setRemoving(undefined);
    const result = await publish.removeDestination(sessionId(), destination.id);
    if (result.status === "failed") notify(failureMessage(result.reason));
    reload();
  };

  const edited = editing?.listed;
  const editedSettings =
    edited?.destination.kind === "file-transfer" ? edited.destination.settings : undefined;
  const editedNetlify = edited?.destination.kind === "netlify" ? edited.destination : undefined;
  const cannotAdd = listed === undefined || listed.length >= PUBLISH_DESTINATIONS_MAX;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {republishing === undefined
                ? t("publish.destinations.title")
                : t("publish.republish.title", { name: republishing })}
            </DialogTitle>
            <DialogDescription>
              {republishing === undefined
                ? t("publish.destinations.description")
                : t("publish.republish.description")}
            </DialogDescription>
          </DialogHeader>
          {listed === undefined ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("publish.destinations.loading")}
            </p>
          ) : listed.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("publish.destinations.empty")}
            </p>
          ) : (
            <ul className="space-y-2">
              {listed.map((each) => (
                <DestinationRow
                  key={each.destination.id}
                  listed={each}
                  test={tests[each.destination.id]}
                  republish={republishing !== undefined}
                  onTest={() => {
                    test(each).catch(() =>
                      setTests((all) => ({
                        ...all,
                        [each.destination.id]: { ok: false, code: "failed" },
                      })),
                    );
                  }}
                  onPublish={() => onPublish(each.destination)}
                  canEdit={each.destination.kind !== "netlify" || netlify !== undefined}
                  onEdit={() => setEditing({ kind: each.destination.kind, listed: each })}
                  onRemove={() => setRemoving(each)}
                />
              ))}
            </ul>
          )}
          <DialogFooter>
            {netlify === undefined ? (
              <Button
                variant="outline"
                disabled={cannotAdd}
                onClick={() => setEditing({ kind: "file-transfer", listed: undefined })}
              >
                {t("publish.destinations.add")}
              </Button>
            ) : (
              // Which kind of destination (4.4b): a web host over FTP, FTPS or SFTP, or Netlify.
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={cannotAdd}>
                    {t("publish.destinations.add")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => setEditing({ kind: "file-transfer", listed: undefined })}
                  >
                    {t("publish.destinations.add.fileTransfer")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setEditing({ kind: "netlify", listed: undefined })}
                  >
                    {t("publish.destinations.add.netlify")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="secondary" onClick={onClose}>
              {t("publish.destinations.close")}
            </Button>
          </DialogFooter>
          {/* Last, so the dialog's own first control still takes the focus as it opens. */}
          <HelpButton topic="publish" className="absolute top-2.5 right-9" />
        </DialogContent>
      </Dialog>
      {/* Drawn only while open, so each opening starts afresh: no key or trust from the last. */}
      {editing?.kind === "netlify" && netlify !== undefined && (
        <NetlifyDestinationDialog
          open
          {...(editedNetlify === undefined || edited === undefined
            ? {}
            : {
                editing: {
                  id: editedNetlify.id,
                  name: editedNetlify.name,
                  siteId: editedNetlify.siteId,
                  signedIn: edited.signIn === "saved",
                },
              })}
          netlify={netlify}
          onSave={saveNetlify}
          onCancel={() => {
            madeSite.current = undefined;
            setEditing(undefined);
          }}
        />
      )}
      {editing?.kind === "file-transfer" && (
        <FileTransferDestinationDialog
          open
          destination={editedSettings}
          name={edited?.destination.name}
          savedSignIn={edited?.signIn === "saved"}
          trust={edited?.trust}
          publish={publish}
          testSaved={
            edited === undefined
              ? undefined
              : (settings, trust) => testSaved(edited.destination.id, settings, trust)
          }
          onSave={(saved) => {
            save(saved).catch(() => notify(failureMessage("unknown")));
          }}
          onCancel={() => setEditing(undefined)}
        />
      )}
      <AlertDialog
        open={removing !== undefined}
        onOpenChange={(next) => (next ? undefined : setRemoving(undefined))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("publish.destinations.removeTitle", { name: removing?.destination.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("publish.destinations.removeBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("publish.destinations.removeCancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing !== undefined) {
                  remove(removing).catch(() => notify(failureMessage("unknown")));
                }
              }}
            >
              {t("publish.destinations.removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** One destination: its name, where it is, whether its password is here, and its actions. */
function DestinationRow({
  listed: { destination, signIn },
  test,
  republish,
  canEdit,
  onPublish,
  onTest,
  onEdit,
  onRemove,
}: {
  readonly listed: ListedDestination;
  readonly test: ConnectionResult | "testing" | undefined;
  /** Its first action republishes a saved version, rather than publishing the site (4.6b). */
  readonly republish: boolean;
  /** Whether it can be published, tested and edited here: a Netlify one needs 4.2's IPC. */
  readonly canEdit: boolean;
  readonly onPublish: () => void;
  readonly onTest: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  const { name } = destination;
  // A Netlify destination is published to once it has its site (4.4b).
  const ready =
    signIn === "saved" && (destination.kind !== "netlify" || destination.siteId !== undefined);
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0 flex-1 basis-64 space-y-1 text-sm">
        <p className="font-medium">{name}</p>
        <p className="break-all text-muted-foreground">
          {destination.kind === "file-transfer"
            ? t("publish.destinations.where", {
                host: destination.settings.host,
                folder: destination.settings.folder,
              })
            : destination.url === undefined
              ? t("publish.destinations.netlify")
              : t("publish.destinations.netlifySite", { url: destination.url })}
        </p>
        {signIn !== "saved" && (
          <p className="text-muted-foreground">
            {t(
              signIn === "changed"
                ? "publish.destinations.signIn.changed"
                : "publish.destinations.signIn.none",
            )}
          </p>
        )}
        <p role="status" aria-live="polite">
          {test === "testing" && t("publish.destinations.testing")}
          {test !== undefined && test !== "testing" && (
            <span className={test.ok ? "text-success" : "text-destructive-text"}>
              {connectionMessage(test)}
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <Button
              size="sm"
              aria-label={
                republish
                  ? t("publish.republish.button.label", { name })
                  : t("publish.run.publish.label", { name })
              }
              disabled={!ready}
              onClick={onPublish}
            >
              {republish ? t("publish.republish.button") : t("publish.run.publish")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={t("publish.destinations.test.label", { name })}
              disabled={!ready || test === "testing"}
              onClick={onTest}
            >
              {t("publish.destinations.test")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-label={t("publish.destinations.edit.label", { name })}
              onClick={onEdit}
            >
              {t("publish.destinations.edit")}
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("publish.destinations.remove.label", { name })}
          onClick={onRemove}
        >
          {t("publish.destinations.remove")}
        </Button>
      </div>
    </li>
  );
}
