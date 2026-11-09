import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { t } from "@webforge/i18n";
import { BRIDGE_ENV, type BridgeConfig } from "@webforge/mcp-bridge";
import { strToU8, zipSync } from "fflate";

/** The MCPB manifest version written: the one Claude Desktop has taken longest. */
const MANIFEST_VERSION = "0.3";

/**
 * How long an extension's file stays after it's written (S29, #794): long enough for Claude
 * Desktop's install dialog, or for the person to open it from its folder. Its manifest holds the
 * pairing's proof, which is only as secret as the profile folder, so it isn't left there.
 */
export const EXTENSION_KEPT_MS = 10 * 60_000;

/** Where the bridge sits in the extension. */
const BRIDGE_ENTRY = "server/index.mjs";

/** What an app's extension is written for: the pairing, and where Webforge listens. */
export type ExtensionPairing = {
  readonly appId: string;
  /** Webforge's MCP address, `http://127.0.0.1:<port>/mcp`. */
  readonly address: string;
  /** The pairing's server proof: not the key, and no use to a caller of the server. */
  readonly proof: string;
  /** When the app was paired, which makes each pairing's extension a newer version. */
  readonly pairedAt: number;
};

/**
 * The extension's version for a pairing: Webforge's own, with the pairing's time as a pre-release,
 * `1.2.3-pairing.1762500000`. Its name is the same for every pairing, so Claude Desktop takes a
 * pairing's extension for a newer version of the one it has: an app added again replaces the
 * extension of its last pairing, address, app id and proof with it, and never installs beside it.
 */
export function extensionVersion(appVersion: string, pairedAt: number): string {
  const release = /^\d+\.\d+\.\d+/.exec(appVersion)?.[0] ?? "0.0.0";
  return `${release}-pairing.${Math.floor(pairedAt / 1000)}`;
}

/** The bridge's messages to the AI app, in the person's language. */
const bridgeMessages = (): BridgeConfig["messages"] => ({
  unreachable: t("aiApps.bridge.unreachable"),
  notWebforge: t("aiApps.bridge.notWebforge"),
  keyRefused: t("aiApps.bridge.keyRefused"),
  failed: t("aiApps.bridge.failed"),
});

/** `name` as an MCPB name: lower case, letters, digits and hyphens. */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "extension";

/**
 * The manifest of an app's Claude Desktop extension (ADR 0021): the bridge on Claude Desktop's own
 * Node.js, with the address, the app's id and the server proof in its environment. The key is the
 * one setting, `sensitive`: Claude Desktop masks it, keeps it securely and passes it in
 * `WEBFORGE_KEY`. It is never written into the file.
 */
export function extensionManifest(pairing: ExtensionPairing, appVersion: string) {
  return {
    manifest_version: MANIFEST_VERSION,
    name: slug(t("app.name")),
    display_name: t("app.name"),
    version: extensionVersion(appVersion, pairing.pairedAt),
    description: t("aiApps.extension.description"),
    author: { name: t("app.name") },
    server: {
      type: "node",
      entry_point: BRIDGE_ENTRY,
      mcp_config: {
        command: "node",
        args: [`\${__dirname}/${BRIDGE_ENTRY}`],
        env: {
          [BRIDGE_ENV.address]: pairing.address,
          [BRIDGE_ENV.app]: pairing.appId,
          [BRIDGE_ENV.proof]: pairing.proof,
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Claude Desktop fills in the manifest's own placeholder.
          [BRIDGE_ENV.key]: "${user_config.key}",
          [BRIDGE_ENV.messages]: JSON.stringify(bridgeMessages()),
        },
      },
    },
    user_config: {
      key: {
        type: "string",
        title: t("aiApps.extension.key"),
        description: t("aiApps.extension.keyHint"),
        sensitive: true,
        required: true,
      },
    },
    tools_generated: true,
    compatibility: { platforms: ["win32", "darwin"] },
  };
}

/** What became of opening an extension. */
export type InstallOutcome =
  /** Claude Desktop (or whatever opens `.mcpb` files) was asked to open it. */
  | "opened"
  /** Nothing opened it: it's shown in its folder instead, to open with Claude Desktop. */
  | "shown";

/** What the extensions are written with: where, the bridge, and how a file is opened. */
export type ClaudeExtensionsOptions = {
  /** The folder the extensions are written in, in the person's own profile. */
  readonly dir: string;
  /** The bundled bridge (`webforge-bridge.mjs`). */
  readonly bridgeFile: string;
  /** Webforge's version, the extension's. */
  readonly version: string;
  /** Opens a file with its app (`shell.openPath`): an error message, or "" if it opened. */
  readonly open: (path: string) => Promise<string>;
  /** Shows a file in its folder (`shell.showItemInFolder`). */
  readonly show: (path: string) => void;
  /** Runs `then` after `ms`, without keeping Webforge open for it; a fake in tests. */
  readonly later?: (then: () => void, ms: number) => void;
};

/**
 * The Claude Desktop extensions of paired apps (ADR 0021): each written to `<dir>/<app id>/`, out
 * of other accounts' reach, and opened, so Claude Desktop shows its install dialog. Each is
 * deleted {@link EXTENSION_KEPT_MS} after it's written, and any left when Webforge quit are
 * deleted as it starts (S29, #794).
 */
export function createClaudeExtensions(options: ClaudeExtensionsOptions) {
  const later =
    options.later ??
    ((then: () => void, ms: number) => {
      setTimeout(then, ms).unref();
    });
  /** Each app's latest extension: a newer one isn't deleted by an older one's timer. */
  const latest = new Map<string, object>();
  const removeFolder = (appId: string) =>
    rm(join(options.dir, appId), { recursive: true, force: true });
  return {
    /** Writes `pairing`'s extension and opens it; resolves to the file and what became of it. */
    async install(
      pairing: ExtensionPairing,
    ): Promise<{ readonly file: string; readonly outcome: InstallOutcome }> {
      const manifest = extensionManifest(pairing, options.version);
      const archive = zipSync({
        "manifest.json": strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
        [BRIDGE_ENTRY]: new Uint8Array(await readFile(options.bridgeFile)),
      });
      // The proof is in it: the person's alone, whatever their profile folder lets others do.
      const folder = join(options.dir, pairing.appId);
      await mkdir(folder, { recursive: true, mode: 0o700 });
      const file = join(folder, `${manifest.name}.mcpb`);
      await writeFile(file, archive, { mode: 0o600 });
      // A file written before keeps its mode: set it again.
      await chmod(file, 0o600);
      const written = {};
      latest.set(pairing.appId, written);
      later(() => {
        if (latest.get(pairing.appId) !== written) return;
        latest.delete(pairing.appId);
        void removeFolder(pairing.appId).catch(() => undefined);
      }, EXTENSION_KEPT_MS);
      if ((await options.open(file)) === "") return { file, outcome: "opened" };
      options.show(file);
      return { file, outcome: "shown" };
    },
    /** Deletes app `appId`'s extension: the app was removed. */
    async remove(appId: string): Promise<void> {
      latest.delete(appId);
      await removeFolder(appId);
    },
    /** Deletes every extension left from before: as Webforge starts. */
    async sweep(): Promise<void> {
      await rm(options.dir, { recursive: true, force: true });
    },
  };
}

/** Paired apps' Claude Desktop extensions. */
export type ClaudeExtensions = ReturnType<typeof createClaudeExtensions>;
