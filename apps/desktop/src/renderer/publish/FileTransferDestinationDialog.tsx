import {
  Button,
  FormDialog,
  type FormField,
  type FormSchema,
  type FormSpec,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  DEFAULT_PORTS,
  FILE_TRANSFER_USER_MAX,
  type FileTransferDestination,
  type FileTransferProtocol,
  type FileTransferSignIn,
  FOLDER_MAX,
  fileTransferDestinationSchema,
  HOST_MAX,
  SECRET_MAX,
} from "@webforge/model";
import { useState } from "react";
import type { ConnectionResult, KeyFileResult, PublishApi } from "../../shared/ipc/publish.js";
import "../shell/form-messages.js";

/** Control panels whose usual settings the form fills in (research 08: host presets). */
const PRESETS = ["cpanel", "plesk", "other"] as const;
type Preset = (typeof PRESETS)[number];

/** Where each control panel serves a site from, from the FTP user's root. */
const PRESET_FOLDER: Readonly<Record<Exclude<Preset, "other">, string>> = {
  cpanel: "/public_html",
  plesk: "/httpdocs",
};

/** The form's values, as the person types them; secrets too, which the site never keeps. */
export type FileTransferValues = {
  readonly preset: Preset;
  readonly protocol: FileTransferProtocol;
  readonly host: string;
  readonly port: string;
  readonly user: string;
  readonly signIn: "password" | "key";
  readonly password: string;
  readonly passphrase: string;
  readonly folder: string;
  readonly url: string;
};

/** What the dialog saves: the destination's settings, and how it signs in, kept apart (4.4). */
export type FileTransferSaved = {
  readonly destination: FileTransferDestination;
  readonly signIn: FileTransferSignIn;
};

/** A key file the person chose. */
type KeyFile = Extract<KeyFileResult, { status: "chosen" }>;

/** What the person chose, trusted and accepted beside the fields. */
type Extra = {
  readonly keyFile: KeyFile | undefined;
  readonly hostKey: string | undefined;
  readonly plainFtpWarned: boolean;
};

/** The values a new destination starts from: cPanel's, over FTPS. */
const NEW_VALUES: FileTransferValues = {
  preset: "cpanel",
  protocol: "ftps",
  host: "",
  port: "",
  user: "",
  signIn: "password",
  password: "",
  passphrase: "",
  folder: PRESET_FOLDER.cpanel,
  url: "",
};

/** The form's values for `destination`, with its password or passphrase when it is known. */
export function valuesOf(
  destination: FileTransferDestination | undefined,
  signIn?: FileTransferSignIn,
): FileTransferValues {
  if (destination === undefined) return NEW_VALUES;
  const preset =
    (Object.entries(PRESET_FOLDER) as [Preset, string][]).find(
      ([, folder]) => folder === destination.folder,
    )?.[0] ?? "other";
  return {
    preset,
    protocol: destination.protocol,
    host: destination.host,
    port: destination.port === undefined ? "" : String(destination.port),
    user: destination.user,
    signIn: destination.protocol === "sftp" ? destination.signIn : "password",
    password: signIn !== undefined && "password" in signIn ? signIn.password : "",
    passphrase: signIn !== undefined && "passphrase" in signIn ? (signIn.passphrase ?? "") : "",
    folder: destination.folder,
    url: destination.url ?? "",
  };
}

/** What the values, the key file and what the person trusted make, before any check. */
function toOutput(values: FileTransferValues, extra: Extra) {
  const port = values.port.trim() === "" ? undefined : Number(values.port);
  const common = {
    host: values.host.trim(),
    ...(port === undefined ? {} : { port }),
    user: values.user.trim(),
    folder: values.folder.trim(),
    ...(values.url.trim() === "" ? {} : { url: values.url.trim() }),
  };
  const destination =
    values.protocol === "sftp"
      ? {
          protocol: "sftp" as const,
          ...common,
          signIn: values.signIn,
          ...(extra.hostKey === undefined ? {} : { hostKey: extra.hostKey }),
        }
      : {
          protocol: values.protocol,
          ...common,
          ...(values.protocol === "ftp" && extra.plainFtpWarned
            ? { plainFtpWarned: true as const }
            : {}),
        };
  const signIn =
    values.protocol === "sftp" && values.signIn === "key"
      ? {
          privateKey: extra.keyFile?.privateKey ?? "",
          ...(values.passphrase === "" ? {} : { passphrase: values.passphrase }),
        }
      : { password: values.password };
  return { destination, signIn };
}

/** The form's own words for a value in the wrong form, by the destination's field. */
const MESSAGES = {
  host: "publish.fileTransfer.error.host",
  folder: "publish.fileTransfer.error.folder",
} as const;

/**
 * The model's destination schema, with the form's words, and the sign-in checked by how the
 * destination signs in: a password, or a key file and, when it needs one, its passphrase.
 */
function outputSchema(keyFile: KeyFile | undefined): FormSchema<FileTransferSaved> {
  return {
    "~standard": {
      validate: (value) => {
        const { destination, signIn } = value as ReturnType<typeof toOutput>;
        const issues: { path: PropertyKey[]; message: string }[] = [];
        const parsed = fileTransferDestinationSchema.safeParse(destination);
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const field = String(issue.path[0]);
            const own = Object.hasOwn(MESSAGES, field)
              ? MESSAGES[field as keyof typeof MESSAGES]
              : undefined;
            issues.push({
              path: ["destination", ...issue.path],
              message:
                issue.code === "invalid_format" && own !== undefined ? t(own) : issue.message,
            });
          }
        }
        const problem =
          "password" in signIn
            ? signIn.password === ""
              ? (["password", "publish.fileTransfer.error.password"] as const)
              : undefined
            : signIn.privateKey === ""
              ? (["privateKey", "publish.fileTransfer.error.key"] as const)
              : keyFile?.encrypted === true && signIn.passphrase === undefined
                ? (["passphrase", "publish.fileTransfer.error.passphrase"] as const)
                : undefined;
        if (problem !== undefined)
          issues.push({ path: ["signIn", problem[0]], message: t(problem[1]) });
        if (!parsed.success || issues.length > 0) return { issues };
        return { value: { destination: parsed.data, signIn: signIn as FileTransferSignIn } };
      },
    },
  };
}

/** The fields, as the protocol and the way it signs in ask. */
function fieldsFor(values: FileTransferValues, keyFile: KeyFile | undefined): FormField[] {
  const sftp = values.protocol === "sftp";
  const withKey = sftp && values.signIn === "key";
  const secret = { kind: "text", inputType: "password", maxLength: SECRET_MAX } as const;
  const signInFields: FormField[] = withKey
    ? keyFile?.encrypted === true
      ? [
          {
            ...secret,
            name: "passphrase",
            label: t("publish.fileTransfer.passphrase"),
            path: "signIn.passphrase",
          },
        ]
      : []
    : [
        {
          ...secret,
          name: "password",
          label: t("publish.fileTransfer.password"),
          help: t("publish.fileTransfer.password.help"),
          path: "signIn.password",
        },
      ];
  return [
    {
      kind: "select",
      name: "preset",
      label: t("publish.fileTransfer.preset"),
      help: t("publish.fileTransfer.preset.help"),
      options: PRESETS.map((value) => ({
        value,
        label: t(`publish.fileTransfer.preset.${value}`),
      })),
    },
    {
      kind: "select",
      name: "protocol",
      label: t("publish.fileTransfer.protocol"),
      path: "destination.protocol",
      options: (["ftps", "sftp", "ftp"] as const).map((value) => ({
        value,
        label: t(`publish.fileTransfer.protocol.${value}`),
      })),
    },
    {
      kind: "text",
      name: "host",
      label: t("publish.fileTransfer.host"),
      placeholder: t("publish.fileTransfer.host.placeholder"),
      path: "destination.host",
      maxLength: HOST_MAX,
      width: "md",
    },
    {
      kind: "number",
      name: "port",
      label: t("publish.fileTransfer.port"),
      help: t("publish.fileTransfer.port.help", { port: DEFAULT_PORTS[values.protocol] }),
      path: "destination.port",
      min: 1,
      max: 65_535,
      width: "sm",
    },
    {
      kind: "text",
      name: "user",
      label: t("publish.fileTransfer.user"),
      path: "destination.user",
      maxLength: FILE_TRANSFER_USER_MAX,
      width: "md",
    },
    ...(sftp
      ? [
          {
            kind: "choice",
            name: "signIn",
            label: t("publish.fileTransfer.signIn"),
            path: "signIn.privateKey",
            options: (["password", "key"] as const).map((value) => ({
              value,
              label: t(`publish.fileTransfer.signIn.${value}`),
            })),
          } as const,
        ]
      : []),
    ...signInFields,
    {
      kind: "text",
      name: "folder",
      label: t("publish.fileTransfer.folder"),
      help: t("publish.fileTransfer.folder.help"),
      path: "destination.folder",
      maxLength: FOLDER_MAX,
    },
    {
      kind: "text",
      name: "url",
      label: t("publish.fileTransfer.url"),
      help: t("publish.fileTransfer.url.help"),
      inputType: "url",
      path: "destination.url",
    },
  ];
}

/**
 * A choice of control panel fills in its folder, unless the person typed one of their own, and
 * moves plain FTP back to FTPS, which each of them offers (B5).
 */
function adjust(next: FileTransferValues, previous: FileTransferValues): FileTransferValues {
  if (next.preset === previous.preset || next.preset === "other") return next;
  const typed = previous.folder.trim();
  const ownFolder = typed !== "" && !Object.values(PRESET_FOLDER).includes(typed);
  return {
    ...next,
    folder: ownFolder ? next.folder : PRESET_FOLDER[next.preset],
    protocol: next.protocol === "ftp" ? "ftps" : next.protocol,
  };
}

/**
 * Where Test connection is, for the connection it ran on (`at`): running, its result, or an SFTP
 * host's key for the person to trust, the first time or after it changed.
 */
type TestState =
  | { readonly status: "testing"; readonly at: string }
  | { readonly status: "done"; readonly at: string; readonly result: ConnectionResult }
  | {
      readonly status: "host-key";
      readonly at: string;
      readonly hostKey: string;
      readonly changed: boolean;
    };

/**
 * The connection `values` describe, which a test or a trusted host key is for: another protocol,
 * host or port is another connection, untested and untrusted.
 */
const connectionOf = (values: FileTransferValues) =>
  `${values.protocol}://${values.host.trim()}:${values.port.trim()}`;

export type FileTransferDestinationDialogProps = {
  readonly open: boolean;
  /** The destination to edit; a new one when left out. */
  readonly destination?: FileTransferDestination | undefined;
  /** Its sign-in, when the keychain has it (4.4). */
  readonly signIn?: FileTransferSignIn | undefined;
  /** Test connection, the host key and the key file, through the main process. */
  readonly publish: PublishApi;
  readonly onSave: (saved: FileTransferSaved) => void;
  readonly onCancel: () => void;
};

/**
 * An FTP, FTPS or SFTP publish destination (4.3, F-PB-1, B5): a control panel's usual settings,
 * the connection (FTPS first; plain FTP after a warning shown once per destination), the host,
 * the user and the password or private key, the folder and the web address, and Test connection.
 * An SFTP host's key is trusted the first time its connection is tested. The settings and the
 * sign-in are saved apart: the site keeps only the settings (4.4).
 */
export function FileTransferDestinationDialog({
  open,
  destination,
  signIn,
  publish,
  onSave,
  onCancel,
}: FileTransferDestinationDialogProps) {
  const [keyFile, setKeyFile] = useState<KeyFile | undefined>(
    signIn !== undefined && "privateKey" in signIn
      ? {
          status: "chosen",
          name: "",
          privateKey: signIn.privateKey,
          encrypted: signIn.passphrase !== undefined,
        }
      : undefined,
  );
  const [keyProblem, setKeyProblem] = useState<string | undefined>();
  // The SFTP host key trusted, for the connection it was trusted on.
  const [trusted, setTrusted] = useState<
    { readonly at: string; readonly hostKey: string } | undefined
  >(
    destination?.protocol === "sftp" && destination.hostKey !== undefined
      ? { at: connectionOf(valuesOf(destination)), hostKey: destination.hostKey }
      : undefined,
  );
  const [plainFtpWarned, setPlainFtpWarned] = useState(
    destination?.protocol === "ftp" && destination.plainFtpWarned === true,
  );
  const [test, setTest] = useState<TestState | undefined>();

  /** What the person chose, trusted and accepted, for these values' connection. */
  const extraFor = (values: FileTransferValues): Extra => ({
    keyFile,
    plainFtpWarned,
    hostKey: trusted?.at === connectionOf(values) ? trusted.hostKey : undefined,
  });

  const runTest = async (values: FileTransferValues, hostKey = extraFor(values).hostKey) => {
    const at = connectionOf(values);
    const output = toOutput(values, { ...extraFor(values), hostKey });
    setTest({ status: "testing", at });
    const parsed = fileTransferDestinationSchema.safeParse(output.destination);
    if (!parsed.success) {
      setTest({ status: "done", at, result: { ok: false, code: "failed" } });
      return;
    }
    const tested = parsed.data;
    if (tested.protocol === "sftp" && hostKey === undefined) {
      const read = await publish.readHostKey(tested.host, tested.port);
      setTest(
        read.status === "read"
          ? { status: "host-key", at, hostKey: read.hostKey, changed: false }
          : { status: "done", at, result: { ok: false, code: read.code } },
      );
      return;
    }
    const result = await publish.testConnection(tested, output.signIn as FileTransferSignIn);
    // A trusted SFTP key the host no longer presents: show the new one, to trust or not.
    if (!result.ok && result.code === "untrusted-host" && tested.protocol === "sftp") {
      const read = await publish.readHostKey(tested.host, tested.port);
      if (read.status === "read" && read.hostKey !== hostKey) {
        setTest({ status: "host-key", at, hostKey: read.hostKey, changed: true });
        return;
      }
    }
    setTest({ status: "done", at, result });
  };

  const chooseKey = async () => {
    const chosen = await publish.chooseKeyFile();
    if (chosen.status === "cancelled") return;
    if (chosen.status === "chosen") {
      setKeyFile(chosen);
      setKeyProblem(undefined);
      return;
    }
    setKeyProblem(
      t(
        chosen.reason === "too-large"
          ? "publish.keyFile.tooLarge"
          : chosen.reason === "not-a-key"
            ? "publish.keyFile.notAKey"
            : "publish.keyFile.unreadable",
      ),
    );
  };

  const spec: FormSpec<FileTransferValues, FileTransferSaved> = {
    fields: (values) => fieldsFor(values, keyFile),
    schema: outputSchema(keyFile),
    toModel: (values) => toOutput(values, extraFor(values)),
    adjust,
    check: (values) => [
      ...(values.protocol === "ftp" && !plainFtpWarned
        ? [{ path: ["destination", "protocol"], message: t("publish.fileTransfer.error.plainFtp") }]
        : []),
      ...(values.protocol === "sftp" && extraFor(values).hostKey === undefined
        ? [{ path: ["destination", "host"], message: t("publish.fileTransfer.error.hostKey") }]
        : []),
    ],
    after: (values) => ({
      protocol:
        values.protocol === "ftp" && !plainFtpWarned ? (
          <PlainFtpWarning onAccept={() => setPlainFtpWarned(true)} />
        ) : undefined,
      signIn:
        values.protocol === "sftp" && values.signIn === "key" ? (
          <KeyFileRow keyFile={keyFile} problem={keyProblem} onChoose={() => void chooseKey()} />
        ) : undefined,
      url: (
        <TestConnection
          // Only a test of the connection as it is now.
          state={test?.at === connectionOf(values) ? test : undefined}
          onTest={() => void runTest(values)}
          onTrust={(hostKey) => {
            setTrusted({ at: connectionOf(values), hostKey });
            void runTest(values, hostKey);
          }}
        />
      ),
    }),
  };

  return (
    <FormDialog
      open={open}
      title={t("publish.fileTransfer.title")}
      description={t("publish.fileTransfer.description")}
      confirm={t("publish.fileTransfer.confirm")}
      spec={spec}
      initial={valuesOf(destination, signIn)}
      size="lg"
      onSave={(saved) => onSave(saved)}
      onCancel={onCancel}
    />
  );
}

/** Plain FTP's warning (B5), until the person accepts it for this destination. */
function PlainFtpWarning({ onAccept }: { readonly onAccept: () => void }) {
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-warning bg-warning/10 p-3 text-sm"
    >
      <p className="font-medium">{t("publish.plainFtp.title")}</p>
      <p>{t("publish.plainFtp.body")}</p>
      <Button type="button" size="sm" variant="outline" onClick={onAccept}>
        {t("publish.plainFtp.accept")}
      </Button>
    </div>
  );
}

/** The private key file: which one, or why the one chosen can't be used, and a button to choose. */
function KeyFileRow({
  keyFile,
  problem,
  onChoose,
}: {
  readonly keyFile: KeyFile | undefined;
  readonly problem: string | undefined;
  readonly onChoose: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Button type="button" size="sm" variant="outline" onClick={onChoose}>
        {t("publish.keyFile.choose")}
      </Button>
      <span
        role={problem === undefined ? undefined : "alert"}
        className={problem === undefined ? "text-muted-foreground" : "text-destructive-text"}
      >
        {problem ??
          (keyFile === undefined
            ? t("publish.keyFile.none")
            : t("publish.keyFile.chosen", { name: keyFile.name }))}
      </span>
    </div>
  );
}

/** Test connection: its button, what it found, and an SFTP host's key to trust. */
function TestConnection({
  state,
  onTest,
  onTrust,
}: {
  readonly state: TestState | undefined;
  readonly onTest: () => void;
  readonly onTrust: (hostKey: string) => void;
}) {
  return (
    <div className="space-y-2 pt-2 text-sm">
      <Button type="button" size="sm" disabled={state?.status === "testing"} onClick={onTest}>
        {t("publish.test.button")}
      </Button>
      <div role="status" aria-live="polite">
        {state?.status === "testing" && <p>{t("publish.test.testing")}</p>}
        {state?.status === "done" && (
          <p className={state.result.ok ? "text-success" : "text-destructive-text"}>
            {state.result.ok ? t("publish.test.ok") : t(`publish.test.${state.result.code}`)}
          </p>
        )}
      </div>
      {state?.status === "host-key" && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="font-medium">
            {t(state.changed ? "publish.hostKey.changedTitle" : "publish.hostKey.title")}
          </p>
          <p className="break-all">
            {t(state.changed ? "publish.hostKey.changedBody" : "publish.hostKey.body", {
              hostKey: state.hostKey,
            })}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => onTrust(state.hostKey)}>
            {t("publish.hostKey.trust")}
          </Button>
        </div>
      )}
    </div>
  );
}
