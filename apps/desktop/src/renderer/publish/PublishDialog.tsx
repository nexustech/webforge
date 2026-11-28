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
  DialogCancel,
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
import { plural, t } from "@webforge/i18n";
import {
  type FileTransferDestination,
  type FileTransferTrust,
  PUBLISH_DESTINATIONS_MAX,
  type PublishDestination,
} from "@webforge/model";
import { ChevronDownIcon, EyeOffIcon } from "lucide-react";
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
  FileTransferDestinationForm,
  type FileTransferSaved,
} from "./FileTransferDestinationForm.js";
import { FirstDestination } from "./FirstDestination.js";
import {
  type NetlifyAccount,
  type NetlifyDestinationApi,
  NetlifyDestinationForm,
  type NetlifyFailure,
  type NetlifySaved,
  type NetlifySite,
  netlifyFailureMessage,
} from "./NetlifyDestinationForm.js";

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

/**
 * How many elements aren't published in what the dialog publishes (#1512), the outermost only, and
 * **Show**, which selects the first: none for a saved version, whose elements aren't in the open
 * site.
 */
type Unpublished = { readonly count: number; readonly show?: (() => void) | undefined };

export type PublishDialogProps = {
  readonly open: boolean;
  /** What won't be on the website (#1512): said under the description while there's any. */
  readonly unpublished?: Unpublished | undefined;
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
  /** The site's web address in Site Settings, which a new host destination starts with (#1014). */
  readonly webAddress?: (() => string | undefined) | undefined;
  /** A destination was saved: Site Settings may take its web address. */
  readonly onSaved: (destination: PublishDestination) => void;
  /** The site's destinations, each time the dialog reads them: as it opens, and after a change. */
  readonly onListed?: ((destinations: readonly PublishDestination[]) => void) | undefined;
  /** Publishes the site to `destination` (4.5); the dialog closes as it starts. */
  readonly onPublish: (destination: PublishDestination) => void;
  readonly onClose: () => void;
};

/** Publish's Add a Destination button, where the focus goes back to after a new one's form. */
const ADD_BUTTON = "[data-destination-add]";

/**
 * Where the focus goes back to as a destination's form goes (#1456): the first of `marks` found
 * and enabled, once the list has been read `after` times (a Save reads it again).
 */
type ReturnTo = { readonly marks: readonly string[]; readonly after: number };

/** A destination being added (none yet) or edited, and of which kind. */
type Editing = {
  readonly kind: PublishDestination["kind"];
  readonly listed: ListedDestination | undefined;
};

/** Each destination's last test, by its id: running, or what it found. */
type Tests = Readonly<Record<string, ConnectionResult | "testing">>;

/**
 * What won't be on the website (#1512): how many elements aren't published, and **Show**, which
 * closes the dialog and selects the first. A saved version's has no **Show**.
 */
function UnpublishedLine({
  unpublished,
  version,
  onShow,
}: {
  readonly unpublished: Unpublished;
  readonly version: boolean;
  readonly onShow: () => void;
}) {
  const { count, show } = unpublished;
  return (
    <div
      data-publish-unpublished=""
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <EyeOffIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        {plural(version ? "publish.unpublished.version" : "publish.unpublished", count)}
      </p>
      {show === undefined ? null : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onShow();
            show();
          }}
        >
          {t("publish.unpublished.show")}
        </Button>
      )}
    </div>
  );
}

/** What the dialog's focus can start on: its buttons, links and fields, as the dialog's own. */
const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Starts the dialog's focus where it started before the line about what isn't published (#1512):
 * on the first thing past it, so Enter as it opens never closes it with **Show**. Without the line,
 * the dialog's own first focus.
 */
function focusPastUnpublished(event: Event): void {
  const content = event.target;
  if (!(content instanceof HTMLElement)) return;
  if (content.querySelector("[data-publish-unpublished]") === null) return;
  const first = [...content.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
    (element) => element.closest("[data-publish-unpublished]") === null,
  );
  if (first === undefined) return;
  event.preventDefault();
  first.focus();
}

/**
 * Publish (F-PB-1, 4.4a): the site's publish destinations, several allowed, each with its name,
 * host and folder, and whether this computer has its password. Add one, edit it, test it or
 * remove it; 4.3's form adds and edits them. Publish, each one's first action, publishes the site
 * there (4.5) once this computer has its password; or, from Version History, Republish publishes
 * a saved version there (4.6b).
 */
export function PublishDialog({
  open,
  unpublished,
  republishing,
  publish,
  netlify,
  sessionId,
  notify,
  webAddress,
  onSaved,
  onListed,
  onPublish,
  onClose,
}: PublishDialogProps) {
  // `undefined` while it's read; "unreadable" when it couldn't be, which shows neither the first-run
  // cards nor Add, so a site's destinations aren't added again behind the error (#1014).
  const [listed, setListed] = useState<readonly ListedDestination[] | "unreadable" | undefined>();
  const [editing, setEditing] = useState<Editing | undefined>();
  // Where the focus goes back to as the form goes (#1456), and how many times the list was read.
  const returnTo = useRef<ReturnTo | undefined>(undefined);
  const reads = useRef(0);
  const content = useRef<HTMLDivElement>(null);
  const [removing, setRemoving] = useState<ListedDestination | undefined>();
  const [tests, setTests] = useState<Tests>({});
  // A Netlify save under way, which a second Save leaves be; and the site the last one made, which
  // a retry with the same sign-in and name uses rather than making another on the account.
  const netlifySaving = useRef(false);
  const madeSite = useRef<{ readonly key: string; readonly site: NetlifySite }>(undefined);
  // Raised to read the list again, after a change.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((last) => last + 1);

  /** Draws `next`'s form in place of the list, the focus to come back to `from` after it. */
  const edit = (next: Editing, from: string) => {
    returnTo.current = { marks: [from, ADD_BUTTON], after: 0 };
    setEditing(next);
  };
  /** Back to the list after Back. */
  const leave = () => {
    madeSite.current = undefined;
    setEditing(undefined);
  };
  /** Back to the list after `saved` is saved: the focus to its row, once the list is read again. */
  const leaveSaved = (saved: PublishDestination) => {
    returnTo.current = {
      marks: [`[data-destination-edit="${saved.id}"]`, ADD_BUTTON],
      after: reads.current + 1,
    };
    setEditing(undefined);
    reload();
  };

  // Back on the list, the focus returns to what opened the form (the row's Edit, the card, or Add),
  // or after a Save to the saved row. After the commit, so the form's going, which drops the focus
  // it had, can't undo it; and again as the list is read, until it's there.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tried again as the list is read.
  useEffect(() => {
    const target = returnTo.current;
    if (editing !== undefined || target === undefined || reads.current < target.after) {
      return undefined;
    }
    const later = setTimeout(() => {
      for (const mark of target.marks) {
        const found = content.current?.querySelector<HTMLElement>(mark);
        if (found === null || found === undefined || found.matches(":disabled")) continue;
        found.focus();
        if (found.ownerDocument.activeElement === found) returnTo.current = undefined;
        return;
      }
    }, 0);
    return () => clearTimeout(later);
  }, [editing, listed]);

  // Read afresh each time the dialog opens, and after each change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `version` reads it again.
  useEffect(() => {
    if (!open) return undefined;
    let current = true;
    publish.destinations(sessionId()).then(
      (result) => {
        if (!current) return;
        reads.current += 1;
        setListed(result.status === "listed" ? result.destinations : "unreadable");
        if (result.status === "listed") {
          onListed?.(result.destinations.map(({ destination }) => destination));
        }
        if (result.status === "failed") notify(failureMessage(result.reason));
      },
      () => {
        if (!current) return;
        setListed("unreadable");
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
      leaveSaved(result.destination);
      onSaved(result.destination);
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
      leaveSaved(result.destination);
      onSaved(result.destination);
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
  const cannotAdd =
    listed === undefined || listed === "unreadable" || listed.length >= PUBLISH_DESTINATIONS_MAX;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
        <DialogContent
          ref={content}
          // One width for the list and a destination's form, so nothing jumps sideways between
          // them (#1456); a column while the form shows, so its fields can scroll.
          className={editing === undefined ? "sm:max-w-2xl" : "flex flex-col sm:max-w-2xl"}
          onOpenAutoFocus={focusPastUnpublished}
          // Closed (from the form too, by Esc or the X), it opens on its list next time, with
          // nothing of the form kept: not as it closes, which would draw the list as it fades.
          onCloseAutoFocus={() => {
            setEditing(undefined);
            returnTo.current = undefined;
            madeSite.current = undefined;
          }}
        >
          {/*
            A destination's form is a step of this dialog (#1456): drawn in place of the list, with
            its own title, and Back to the list. Drawn only while it shows, so each time starts
            afresh: no key or trust from the last.
          */}
          {editing?.kind === "netlify" && netlify !== undefined ? (
            <NetlifyDestinationForm
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
              onBack={leave}
            />
          ) : editing?.kind === "file-transfer" ? (
            <FileTransferDestinationForm
              destination={editedSettings}
              name={edited?.destination.name}
              webAddress={edited === undefined ? webAddress?.() : undefined}
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
              onBack={leave}
            />
          ) : (
            <>
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
              {unpublished === undefined || unpublished.count === 0 ? null : (
                <UnpublishedLine
                  unpublished={unpublished}
                  version={republishing !== undefined}
                  onShow={onClose}
                />
              )}
              {listed === undefined ? (
                <p role="status" className="text-sm text-muted-foreground">
                  {t("publish.destinations.loading")}
                </p>
              ) : listed === "unreadable" ? (
                <p role="status" className="text-sm text-destructive-text">
                  {t("publish.destinations.unreadable")}
                </p>
              ) : listed.length === 0 ? (
                <FirstDestination
                  netlify={netlify !== undefined}
                  onAdd={(kind) =>
                    edit({ kind, listed: undefined }, `[data-first-destination="${kind}"]`)
                  }
                />
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
                      onEdit={() =>
                        edit(
                          { kind: each.destination.kind, listed: each },
                          `[data-destination-edit="${each.destination.id}"]`,
                        )
                      }
                      onRemove={() => setRemoving(each)}
                    />
                  ))}
                </ul>
              )}
              <DialogFooter>
                {listed === "unreadable" || listed?.length === 0 ? null : netlify === undefined ? (
                  <Button
                    variant="outline"
                    disabled={cannotAdd}
                    data-destination-add=""
                    onClick={() => edit({ kind: "file-transfer", listed: undefined }, ADD_BUTTON)}
                  >
                    {t("publish.destinations.addOne")}
                  </Button>
                ) : (
                  // Which kind of destination (4.4b): a web host with a control panel, or Netlify. The
                  // first one is chosen from cards instead (#1014).
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={cannotAdd} data-destination-add="">
                        {t("publish.destinations.add")}
                        <ChevronDownIcon aria-hidden />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          edit({ kind: "file-transfer", listed: undefined }, ADD_BUTTON)
                        }
                      >
                        {t("publish.destinations.add.fileTransfer")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => edit({ kind: "netlify", listed: undefined }, ADD_BUTTON)}
                      >
                        {t("publish.destinations.add.netlify")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <DialogCancel onClick={onClose}>{t("publish.destinations.close")}</DialogCancel>
              </DialogFooter>
            </>
          )}
          {/* Last, so the dialog's own first control still takes the focus as it opens. */}
          <HelpButton topic="publish" className="absolute top-2.5 right-9" />
        </DialogContent>
      </Dialog>
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
              data-destination-edit={destination.id}
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
