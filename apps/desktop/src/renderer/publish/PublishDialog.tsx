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
import {
  type FileTransferDestination,
  type FileTransferTrust,
  PUBLISH_DESTINATIONS_MAX,
  type PublishDestination,
} from "@webforge/model";
import { useEffect, useState } from "react";
import type {
  ConnectionResult,
  DestinationsFailure,
  ListedDestination,
  PublishApi,
} from "../../shared/ipc/publish.js";
import {
  connectionMessage,
  FileTransferDestinationDialog,
  type FileTransferSaved,
} from "./FileTransferDestinationDialog.js";

/** The person's words for why the destinations couldn't be read or changed. */
function failureMessage(reason: DestinationsFailure): string {
  return reason === "full"
    ? t("publish.destinations.failed.full", { max: PUBLISH_DESTINATIONS_MAX })
    : t(`publish.destinations.failed.${reason}`);
}

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
  readonly publish: PublishDialogApi;
  /** The opening of the site this window was loaded for (R6). */
  readonly sessionId: () => string;
  /** Says what went wrong, in the window's toasts. */
  readonly notify: (message: string) => void;
  /** A destination was saved: Site Settings may take its web address. */
  readonly onSaved: (destination: PublishDestination) => void;
  readonly onClose: () => void;
};

/** A destination being added (none yet) or edited. */
type Editing = { readonly listed: ListedDestination | undefined };

/** Each destination's last test, by its id: running, or what it found. */
type Tests = Readonly<Record<string, ConnectionResult | "testing">>;

/**
 * Publish (F-PB-1, 4.4a): the site's publish destinations, several allowed, each with its name,
 * host and folder, and whether this computer has its password. Add one, edit it, test it or
 * remove it; 4.3's form adds and edits them. 4.5 adds publishing to one.
 */
export function PublishDialog({
  open,
  publish,
  sessionId,
  notify,
  onSaved,
  onClose,
}: PublishDialogProps) {
  const [listed, setListed] = useState<readonly ListedDestination[] | undefined>();
  const [editing, setEditing] = useState<Editing | undefined>();
  const [removing, setRemoving] = useState<ListedDestination | undefined>();
  const [tests, setTests] = useState<Tests>({});
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
  }, [open, version, publish, sessionId, notify]);

  const testSaved = async (
    id: string,
    settings: FileTransferDestination,
    trust: FileTransferTrust,
  ): Promise<ConnectionResult> => {
    const result = await publish.testSavedDestination(sessionId(), id, settings, trust);
    return "status" in result ? { ok: false, code: "failed" } : result;
  };

  const test = async ({ destination, trust }: ListedDestination) => {
    if (destination.kind !== "file-transfer") return;
    setTests((all) => ({ ...all, [destination.id]: "testing" }));
    const result = await testSaved(destination.id, destination.settings, trust);
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

  const remove = async ({ destination }: ListedDestination) => {
    setRemoving(undefined);
    const result = await publish.removeDestination(sessionId(), destination.id);
    if (result.status === "failed") notify(failureMessage(result.reason));
    reload();
  };

  const edited = editing?.listed;
  const editedSettings =
    edited?.destination.kind === "file-transfer" ? edited.destination.settings : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("publish.destinations.title")}</DialogTitle>
            <DialogDescription>{t("publish.destinations.description")}</DialogDescription>
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
                  onTest={() => {
                    test(each).catch(() =>
                      setTests((all) => ({
                        ...all,
                        [each.destination.id]: { ok: false, code: "failed" },
                      })),
                    );
                  }}
                  onEdit={() => setEditing({ listed: each })}
                  onRemove={() => setRemoving(each)}
                />
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={listed === undefined || listed.length >= PUBLISH_DESTINATIONS_MAX}
              onClick={() => setEditing({ listed: undefined })}
            >
              {t("publish.destinations.add")}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              {t("publish.destinations.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Drawn only while open, so each opening starts afresh: no key or trust from the last. */}
      {editing !== undefined && (
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
  onTest,
  onEdit,
  onRemove,
}: {
  readonly listed: ListedDestination;
  readonly test: ConnectionResult | "testing" | undefined;
  readonly onTest: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}) {
  const { name } = destination;
  const fileTransfer = destination.kind === "file-transfer";
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="font-medium">{name}</p>
        <p className="break-all text-muted-foreground">
          {destination.kind === "file-transfer"
            ? t("publish.destinations.where", {
                host: destination.settings.host,
                folder: destination.settings.folder,
              })
            : t("publish.destinations.netlify")}
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
      {/* 4.5 puts Publish here, as each destination's first action. */}
      <div className="flex flex-wrap gap-2">
        {fileTransfer && (
          <>
            <Button
              size="sm"
              variant="outline"
              aria-label={t("publish.destinations.test.label", { name })}
              disabled={signIn !== "saved" || test === "testing"}
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
