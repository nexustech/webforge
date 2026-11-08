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
import type { ConnectionResult } from "../../shared/ipc/publish.js";
import { connectionMessage } from "./FileTransferDestinationDialog.js";
import "../shell/form-messages.js";

/** Why talking to Netlify failed: a publisher's code, worded as Test Connection words it. */
type FailureCode = Extract<ConnectionResult, { ok: false }>["code"];

/** A site of the Netlify account, as the site picker lists it. */
export type NetlifySite = {
  readonly id: string;
  readonly name: string;
  /** Its address on Netlify (`https://shop.netlify.app`), or its own domain. */
  readonly url: string;
  /**
   * Site protection, or visitor access, is on: Netlify reports a deploy live while visitors get
   * its log-in page instead (0.2's live run, ADR 0006 decision 6).
   */
  readonly protected: boolean;
};

/**
 * How the dialog reaches Netlify: through a sign-in the main process holds for it until the
 * destination is saved (`handle`), or the one saved for a destination being edited (`saved`, its
 * id). The token itself never reaches the renderer once it's been sent.
 */
export type NetlifyConnection = { readonly handle: string } | { readonly saved: string };

/** What the dialog asks the main process to do for it (4.2's Netlify IPC). */
export type NetlifyDestinationApi = {
  /** Whether *Sign in with Netlify* can be offered: false until the app has its client ID. */
  readonly canSignIn: boolean;
  /** Signs in, in the person's browser (`oauth`) or with a pasted personal access token. */
  readonly connect: (
    how: { readonly via: "oauth" } | { readonly via: "token"; readonly token: string },
  ) => Promise<
    | { readonly status: "connected"; readonly handle: string }
    | { readonly status: "failed"; readonly code: FailureCode }
  >;
  /** The account's sites. */
  readonly sites: (
    connection: NetlifyConnection,
  ) => Promise<
    | { readonly status: "listed"; readonly sites: readonly NetlifySite[] }
    | { readonly status: "failed"; readonly code: FailureCode }
  >;
};

/**
 * What the dialog saves: the destination's name, the Netlify site (one of the account's, or a new
 * one to create, named or not), and its sign-in: the one just made, by its handle, or the one
 * saved for it.
 */
export type NetlifySaved = {
  readonly name: string;
  readonly site: { readonly id: string; readonly url: string } | { readonly create: string };
  readonly signIn: { readonly netlifyHandle: string } | { readonly keep: true };
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
  | { readonly status: "failed"; readonly code: FailureCode };

/** What signing in is doing. */
type Signing =
  | { readonly status: "idle" }
  | { readonly status: "waiting"; readonly via: "oauth" | "token" }
  | { readonly status: "failed"; readonly code: FailureCode };

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
  const [connection, setConnection] = useState<NetlifyConnection | undefined>(
    editing?.signedIn === true ? { saved: editing.id } : undefined,
  );
  const [sites, setSites] = useState<Sites>({ status: "none" });
  const [signing, setSigning] = useState<Signing>({ status: "idle" });

  // The account's sites, once there's a sign-in to ask with.
  useEffect(() => {
    if (connection === undefined) return undefined;
    let current = true;
    setSites({ status: "loading" });
    netlify.sites(connection).then(
      (result) => {
        if (current) setSites(result);
      },
      () => {
        if (current) setSites({ status: "failed", code: "failed" });
      },
    );
    return () => {
      current = false;
    };
  }, [connection, netlify]);

  const connect = async (how: { via: "oauth" } | { via: "token"; token: string }) => {
    setSigning({ status: "waiting", via: how.via });
    const result = await netlify
      .connect(how)
      .catch(() => ({ status: "failed" as const, code: "failed" as const }));
    if (result.status === "connected") {
      setSigning({ status: "idle" });
      setConnection({ handle: result.handle });
    } else {
      setSigning({ status: "failed", code: result.code });
    }
  };

  const listed = sites.status === "listed" ? sites.sites : [];
  const siteOf = (id: string) => listed.find((site) => site.id === id);

  const spec: FormSpec<NetlifyValues, NetlifySaved> = {
    fields: (values) => fieldsFor(values, sites, editing?.signedIn === true),
    schema: outputSchema,
    toModel: (values) => toOutput(values, connection, siteOf(values.site)),
    after: (values) => ({
      token: (
        <>
          <SignIn
            canSignIn={netlify.canSignIn}
            signing={signing}
            connected={connection !== undefined}
            tokenTyped={values.token.trim() !== ""}
            onSignIn={() => void connect({ via: "oauth" })}
            onConnect={() => void connect({ via: "token", token: values.token.trim() })}
          />
          {/* Until there's a picker to show it under: loading, or why it couldn't. */}
          {sites.status !== "listed" && <SiteStatus sites={sites} chosen={undefined} />}
        </>
      ),
      site: <SiteStatus sites={sites} chosen={siteOf(values.site)} />,
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
      onCancel={onCancel}
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
                label: t("publish.netlify.site.option", { name: site.name, url: site.url }),
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
  connection: NetlifyConnection | undefined,
  chosen: NetlifySite | undefined,
) {
  const site =
    values.site === NEW_SITE
      ? { create: values.newSite.trim() }
      : chosen === undefined
        ? undefined
        : { id: chosen.id, url: chosen.url };
  const name =
    values.name.trim() !== ""
      ? values.name.trim()
      : (chosen?.name ?? (values.newSite.trim() || t("publish.netlify.defaultName")));
  const signIn =
    connection === undefined
      ? undefined
      : "handle" in connection
        ? { netlifyHandle: connection.handle }
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
  onConnect,
}: {
  readonly canSignIn: boolean;
  readonly signing: Signing;
  readonly connected: boolean;
  readonly tokenTyped: boolean;
  readonly onSignIn: () => void;
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
      </div>
      <p role="status" aria-live="polite">
        {waiting && (
          <span>
            {t(
              signing.via === "oauth"
                ? "publish.netlify.waitingBrowser"
                : "publish.netlify.connecting",
            )}
          </span>
        )}
        {signing.status === "failed" && (
          <span className="text-destructive-text">
            {connectionMessage({ ok: false, code: signing.code })}
          </span>
        )}
        {signing.status === "idle" && connected && (
          <span className="text-success">{t("publish.netlify.connected")}</span>
        )}
      </p>
    </div>
  );
}

/** The site picker's state below it: loading, why it failed, or the chosen site's warning. */
function SiteStatus({
  sites,
  chosen,
}: {
  readonly sites: Sites;
  readonly chosen: NetlifySite | undefined;
}) {
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
        {connectionMessage({ ok: false, code: sites.code })}
      </p>
    );
  }
  if (chosen?.protected !== true) return null;
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
