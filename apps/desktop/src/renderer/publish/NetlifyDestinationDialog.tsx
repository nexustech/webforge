import {
  Button,
  FormDialog,
  type FormField,
  type FormSchema,
  type FormSpec,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { DESTINATION_NAME_MAX, SECRET_MAX } from "@webforge/model";
import { useEffect, useState } from "react";
import "../shell/form-messages.js";

/**
 * Why a Netlify call did nothing, as 4.2's IPC says (`NetlifyFailure`): its message is
 * `publish.netlify.failed.<reason>`.
 */
export type NetlifyFailure =
  | "not-set-up"
  | "unauthorized"
  | "timeout"
  | "cancelled"
  | "network"
  | "signed-out"
  | "failed";

/** The person's words for `reason`. */
export const netlifyFailureMessage = (reason: NetlifyFailure): string =>
  t(`publish.netlify.failed.${reason}`);

/** A site of the Netlify account, as the site picker lists it (4.2's `NetlifySite`). */
export type NetlifySite = {
  readonly id: string;
  readonly name: string;
  /** Its address on Netlify (`https://shop.netlify.app`) or its own domain; none before a deploy. */
  readonly url?: string | undefined;
};

/**
 * Whose Netlify account the dialog reaches (4.2's `NetlifyAccount`): a sign-in the main process
 * holds until the destination is saved (`handle`), or the one saved for the destination being
 * edited (`saved`, its id). The token itself never reaches the renderer once it's been sent.
 */
export type NetlifyAccount = { readonly handle: string } | { readonly saved: string };

/** A sign-in's outcome: its handle, or why not. */
type SignInResult =
  | { readonly status: "signed-in"; readonly handle: string }
  | { readonly status: "failed"; readonly reason: NetlifyFailure };

/** What the dialog asks the main process to do for it (4.2's `window.webforge.netlify`). */
export type NetlifyDestinationApi = {
  /** Whether *Sign In with Netlify* can be offered: false until the app has its client ID. */
  readonly canSignIn: boolean;
  /** Signs in in the person's browser, through Netlify's page, until approved or cancelled. */
  readonly signIn: () => Promise<SignInResult>;
  /** Stops waiting for the browser: the sign-in answers `cancelled`. */
  readonly cancelSignIn: () => void;
  /** Checks a pasted personal access token, and holds it as a sign-in. */
  readonly signInWithToken: (token: string) => Promise<SignInResult>;
  /**
   * Drops a sign-in the dialog made and won't save, as it's cancelled or closed: main holds it no
   * longer than it needs to (4.2's `forgetSignIn`).
   */
  readonly forgetSignIn?: (handle: string) => void;
  /**
   * Whether site `siteId`'s visitors must log in to Netlify (site protection, or visitor access):
   * Netlify then reports a deploy live while visitors get its log-in page (0.2's live run, ADR 0006
   * decision 6). Asked for the site chosen only; left out until 4.2 part 3 adds it.
   */
  readonly checkAccess?: (
    account: NetlifyAccount,
    siteId: string,
  ) => Promise<
    | { readonly status: "checked"; readonly protected: boolean }
    | { readonly status: "failed"; readonly reason: NetlifyFailure }
  >;
  /** The account's sites. */
  readonly sites: (
    account: NetlifyAccount,
  ) => Promise<
    | { readonly status: "listed"; readonly sites: readonly NetlifySite[] }
    | { readonly status: "failed"; readonly reason: NetlifyFailure }
  >;
};

/**
 * What the dialog saves: the destination's name, the Netlify site (one of the account's, or a new
 * one to create, named or for Netlify to name), and its sign-in: the one just made, by its handle,
 * or the one saved for it.
 */
export type NetlifySaved = {
  readonly name: string;
  readonly site: NetlifySite | { readonly create: string | undefined };
  readonly signIn: { readonly handle: string } | { readonly keep: true };
};

/** The form's values, as the person types them; the token too, which is sent once and forgotten. */
type NetlifyValues = {
  readonly name: string;
  readonly token: string;
  /** A site's id, `new` for a new site, or nothing yet. */
  readonly site: string;
  readonly newSite: string;
};

/** The value of the site picker's last choice, a new site. */
const NEW_SITE = "new";

/** The longest name Netlify takes for a site (its subdomain). */
const SITE_NAME_MAX = 63;

/** Where the dialog is with Netlify. */
type Sites =
  | { readonly status: "none" }
  | { readonly status: "loading" }
  | { readonly status: "listed"; readonly sites: readonly NetlifySite[] }
  | { readonly status: "failed"; readonly reason: NetlifyFailure };

/** What signing in is doing. */
type Signing =
  | { readonly status: "idle" }
  | { readonly status: "waiting"; readonly via: "browser" | "token" }
  | { readonly status: "failed"; readonly reason: NetlifyFailure };

export type NetlifyDestinationDialogProps = {
  readonly open: boolean;
  /** The destination being edited, with its name and site; a new one when left out. */
  readonly editing?: {
    readonly id: string;
    readonly name: string;
    readonly siteId: string | undefined;
    /** Whether this computer has its sign-in. */
    readonly signedIn: boolean;
  };
  readonly netlify: NetlifyDestinationApi;
  readonly onSave: (saved: NetlifySaved) => void;
  readonly onCancel: () => void;
};

/**
 * Add or edit a Netlify destination (4.4b, F-PB-1): sign in, in the person's browser through
 * Netlify's own page, or with a personal access token pasted from Netlify; then choose one of the
 * account's sites, or a new one. A site whose visitors must log in to Netlify gets a warning. The
 * token is sent to the main process once and kept in the keychain for this destination only
 * (4.4a, S2), never in the site's file.
 */
export function NetlifyDestinationDialog({
  open,
  editing,
  netlify,
  onSave,
  onCancel,
}: NetlifyDestinationDialogProps) {
  const [account, setAccount] = useState<NetlifyAccount | undefined>(
    editing?.signedIn === true ? { saved: editing.id } : undefined,
  );
  const [sites, setSites] = useState<Sites>({ status: "none" });
  const [signing, setSigning] = useState<Signing>({ status: "idle" });

  // The account's sites, once there's a sign-in to ask with.
  useEffect(() => {
    if (account === undefined) return undefined;
    let current = true;
    setSites({ status: "loading" });
    netlify.sites(account).then(
      (result) => {
        if (current) setSites(result);
      },
      () => {
        if (current) setSites({ status: "failed", reason: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [account, netlify]);

  const signIn = async (via: "browser" | "token", token = "") => {
    setSigning({ status: "waiting", via });
    const result = await (via === "browser"
      ? netlify.signIn()
      : netlify.signInWithToken(token)
    ).catch(() => ({ status: "failed" as const, reason: "failed" as const }));
    if (result.status === "signed-in") {
      setSigning({ status: "idle" });
      setAccount({ handle: result.handle });
    } else {
      // Cancelled is what the person asked for: nothing to say.
      setSigning(
        result.reason === "cancelled"
          ? { status: "idle" }
          : { status: "failed", reason: result.reason },
      );
    }
  };

  const listed = sites.status === "listed" ? sites.sites : [];
  const siteOf = (id: string) => listed.find((site) => site.id === id);

  const spec: FormSpec<NetlifyValues, NetlifySaved> = {
    fields: (values) => fieldsFor(values, sites, editing?.signedIn === true),
    schema: outputSchema,
    toModel: (values) => toOutput(values, account, siteOf(values.site)),
    after: (values) => ({
      token: (
        <>
          <SignIn
            canSignIn={netlify.canSignIn}
            signing={signing}
            connected={account !== undefined}
            tokenTyped={values.token.trim() !== ""}
            onSignIn={() => void signIn("browser")}
            onCancel={netlify.cancelSignIn}
            onConnect={() => void signIn("token", values.token.trim())}
          />
          {/* Until there's a picker to show it under: loading, or why it couldn't. */}
          {sites.status !== "listed" && <SiteStatus sites={sites} />}
        </>
      ),
      site: (
        <>
          <SiteStatus sites={sites} />
          {account !== undefined && netlify.checkAccess !== undefined && siteOf(values.site) && (
            <VisitorAccess check={netlify.checkAccess} account={account} siteId={values.site} />
          )}
        </>
      ),
    }),
  };

  return (
    <FormDialog
      open={open}
      title={t(editing === undefined ? "publish.netlify.title" : "publish.netlify.editTitle")}
      description={t("publish.netlify.description")}
      confirm={t("publish.netlify.confirm")}
      spec={spec}
      initial={{
        name: editing?.name ?? "",
        token: "",
        site: editing?.siteId ?? "",
        newSite: "",
      }}
      size="lg"
      onSave={(saved) => onSave(saved)}
      onCancel={() => {
        // A sign-in made here and not saved: main lets it go now, not after its 30 minutes.
        if (account !== undefined && "handle" in account) netlify.forgetSignIn?.(account.handle);
        onCancel();
      }}
    />
  );
}

/** The fields: the name, the token, and once there's a sign-in, the site picker. */
function fieldsFor(values: NetlifyValues, sites: Sites, savedSignIn: boolean): FormField[] {
  const picker: FormField[] =
    sites.status === "listed"
      ? [
          {
            kind: "select",
            name: "site",
            label: t("publish.netlify.site"),
            help: t("publish.netlify.site.help"),
            options: [
              // Nothing chosen yet: a select shows its first option, so it says so.
              { value: "", label: t("publish.netlify.site.choose") },
              ...sites.sites.map((site) => ({
                value: site.id,
                label:
                  site.url === undefined
                    ? site.name
                    : t("publish.netlify.site.option", { name: site.name, url: site.url }),
              })),
              { value: NEW_SITE, label: t("publish.netlify.site.new") },
            ],
          },
          ...(values.site === NEW_SITE
            ? [
                {
                  kind: "text",
                  name: "newSite",
                  label: t("publish.netlify.newSite"),
                  help: t("publish.netlify.newSite.help"),
                  maxLength: SITE_NAME_MAX,
                  width: "md",
                } as const,
              ]
            : []),
        ]
      : [];
  return [
    {
      kind: "text",
      name: "name",
      label: t("publish.netlify.name"),
      help: t("publish.netlify.name.help"),
      maxLength: DESTINATION_NAME_MAX,
      width: "md",
    },
    {
      kind: "text",
      inputType: "password",
      name: "token",
      label: t("publish.netlify.token"),
      help: t(savedSignIn ? "publish.netlify.token.saved" : "publish.netlify.token.help"),
      maxLength: SECRET_MAX,
    },
    ...picker,
  ];
}

/** What the values make, before the schema checks it. */
function toOutput(
  values: NetlifyValues,
  account: NetlifyAccount | undefined,
  chosen: NetlifySite | undefined,
) {
  const newName = values.newSite.trim();
  const site: NetlifySaved["site"] | undefined =
    values.site === NEW_SITE ? { create: newName === "" ? undefined : newName } : chosen;
  const name =
    values.name.trim() !== ""
      ? values.name.trim()
      : (chosen?.name ?? (newName || t("publish.netlify.defaultName")));
  const signIn =
    account === undefined
      ? undefined
      : "handle" in account
        ? { handle: account.handle }
        : { keep: true as const };
  return { name, site, signIn };
}

/** Checks there's a sign-in and a site, with the form's words for what's missing. */
const outputSchema: FormSchema<NetlifySaved> = {
  "~standard": {
    validate: (value) => {
      const { name, site, signIn } = value as ReturnType<typeof toOutput>;
      const issues: { path: PropertyKey[]; message: string }[] = [];
      if (signIn === undefined) {
        issues.push({ path: ["token"], message: t("publish.netlify.error.signIn") });
      } else if (site === undefined) {
        issues.push({ path: ["site"], message: t("publish.netlify.error.site") });
      }
      if (signIn === undefined || site === undefined || issues.length > 0) return { issues };
      return { value: { name, site, signIn } };
    },
  },
};

/** Signing in: *Sign in with Netlify* when the app can, *Connect* for a pasted token, and how it went. */
function SignIn({
  canSignIn,
  signing,
  connected,
  tokenTyped,
  onSignIn,
  onCancel,
  onConnect,
}: {
  readonly canSignIn: boolean;
  readonly signing: Signing;
  readonly connected: boolean;
  readonly tokenTyped: boolean;
  readonly onSignIn: () => void;
  /** Stops waiting for the browser. */
  readonly onCancel: () => void;
  readonly onConnect: () => void;
}) {
  const waiting = signing.status === "waiting";
  return (
    <div className="space-y-2 pt-1 text-sm">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={waiting || !tokenTyped} onClick={onConnect}>
          {t("publish.netlify.connect")}
        </Button>
        {canSignIn && (
          <Button type="button" size="sm" variant="outline" disabled={waiting} onClick={onSignIn}>
            {t("publish.netlify.signIn")}
          </Button>
        )}
        {waiting && signing.via === "browser" && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t("publish.netlify.cancelSignIn")}
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite">
        {waiting && (
          <span>
            {t(
              signing.via === "browser"
                ? "publish.netlify.waitingBrowser"
                : "publish.netlify.connecting",
            )}
          </span>
        )}
        {signing.status === "failed" && (
          <span className="text-destructive-text">{netlifyFailureMessage(signing.reason)}</span>
        )}
        {signing.status === "idle" && connected && (
          <span className="text-success">{t("publish.netlify.connected")}</span>
        )}
      </p>
    </div>
  );
}

/** The site picker's state: loading, or why it failed. */
function SiteStatus({ sites }: { readonly sites: Sites }) {
  if (sites.status === "loading") {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {t("publish.netlify.loadingSites")}
      </p>
    );
  }
  if (sites.status === "failed") {
    return (
      <p role="alert" className="text-sm text-destructive-text">
        {netlifyFailureMessage(sites.reason)}
      </p>
    );
  }
  return null;
}

/**
 * The chosen site's visitor-access warning: checked when it's chosen, and shown only when its
 * visitors must log in to Netlify. A check that fails says nothing: it's a warning, not a block.
 */
function VisitorAccess({
  check,
  account,
  siteId,
}: {
  readonly check: NonNullable<NetlifyDestinationApi["checkAccess"]>;
  readonly account: NetlifyAccount;
  readonly siteId: string;
}) {
  const [checked, setChecked] = useState<{
    readonly siteId: string;
    readonly protected: boolean;
  }>();
  useEffect(() => {
    let current = true;
    check(account, siteId).then(
      (result) => {
        if (current && result.status === "checked") {
          setChecked({ siteId, protected: result.protected });
        }
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [check, account, siteId]);
  if (checked?.siteId !== siteId || !checked.protected) return null;
  return (
    <div
      role="alert"
      className="space-y-1 rounded-md border border-warning bg-warning/10 p-3 text-sm"
    >
      <p className="font-medium">{t("publish.netlify.protected.title")}</p>
      <p>{t("publish.netlify.protected.body")}</p>
    </div>
  );
}
