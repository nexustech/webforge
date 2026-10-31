import {
  diffManifest,
  type Manifest,
  manifestOf,
  type PublishedFiles,
  type PublishedSite,
  readManifest,
} from "./manifest.js";
import {
  type BuildOutput,
  PublishError,
  type PublishEvent,
  throwIfCancelled,
} from "./publisher.js";

/**
 * The hidden file on the host that lists what Webforge published there, with each file's digest
 * (08): later publishes, from this computer or another, upload only what changed and remove only
 * files Webforge put there.
 */
export const MANIFEST_FILE = ".webforge-publish.json";

/**
 * The site's folder on a host, as a file-transfer publisher (FTP, FTPS, SFTP) reaches it over one
 * connection. Paths are relative to the folder and `/`-separated.
 */
export interface RemoteFolder {
  /** The file at `path`, or `undefined` if there is none. */
  read(path: string): Promise<Uint8Array | undefined>;
  /**
   * Writes `data` to `path`, making the folders it needs. The bytes go to a hidden file beside it
   * first, which then replaces it, so a visitor never gets a half-written page.
   */
  write(path: string, data: Uint8Array): Promise<void>;
  /** Removes the file at `path`; one that is already gone is fine. */
  remove(path: string): Promise<void>;
}

/** The hidden file a {@link RemoteFolder} writes `path`'s bytes to before they replace it. */
export function uploadPathFor(path: string): string {
  const slash = path.lastIndexOf("/");
  return `${path.slice(0, slash + 1)}.${path.slice(slash + 1)}.webforge-upload`;
}

/** What the host's manifest says was published; a missing or damaged one counts as nothing. */
async function previousManifest(folder: RemoteFolder): Promise<PublishedFiles | null> {
  const data = await folder.read(MANIFEST_FILE);
  if (data === undefined) return null;
  try {
    return readManifest(JSON.parse(new TextDecoder().decode(data)));
  } catch {
    return null;
  }
}

/**
 * Who is publishing to a folder, and how (4.3): the site, as its manifest records it, the address
 * the site is visited at, for the published event, and whether the person agreed to replace
 * another site published there (A8, asked by 4.5's flow).
 */
export type FolderPublish = {
  readonly site: PublishedSite;
  readonly url: string;
  readonly replaceOtherSite?: boolean;
  /** The publish's time, for the manifest; now when left out. */
  readonly now?: () => Date;
};

/**
 * The digest a pending manifest gives a file that may or may not have arrived: it matches no
 * file's content, so the next publish sends the file again, or removes it if the site dropped it.
 */
const UNCONFIRMED = "0".repeat(40);

const encodeManifest = (manifest: Manifest) =>
  new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);

/**
 * Publishes `build` to `folder` (08): only new and changed files are uploaded, assets first and
 * `index.html` last, then the files the site no longer has are removed, pages before assets.
 * Cancelling stops before the next file: the files already sent are whole, and the pages the
 * live site has still find their assets, so it stays usable.
 *
 * A folder whose manifest names another project stops with `other-site` before anything is
 * written, unless the person agreed to replace it (A8). A version 1 manifest names no site, so
 * it could be any site's: it gets the same question (review). Only the 0.3 spike wrote them.
 */
export async function* publishToFolder(
  folder: RemoteFolder,
  build: BuildOutput,
  signal: AbortSignal,
  publishing: FolderPublish,
): AsyncGenerator<PublishEvent> {
  const { site, url } = publishing;
  yield { type: "preparing" };
  const previous = await previousManifest(folder);
  if (
    previous !== null &&
    previous.site?.projectId !== site.projectId &&
    publishing.replaceOtherSite !== true
  ) {
    throw new PublishError("other-site", "The folder has another site published there");
  }
  const publishedAt = (publishing.now?.() ?? new Date()).toISOString();
  const next = manifestOf(build.files, site, publishedAt);
  const diff = diffManifest(previous, next);

  // Files the host never had: listed before they go, so that if the publish stops part-way and
  // the site drops one of them before the next, that publish still removes it from the host.
  const added = diff.upload.filter((path) => previous?.files[path] === undefined);
  if (added.length > 0) {
    const pending: Manifest = { ...next, files: { ...previous?.files } };
    for (const path of added) pending.files[path] = UNCONFIRMED;
    await folder.write(MANIFEST_FILE, encodeManifest(pending));
  }

  for (const [done, path] of diff.upload.entries()) {
    throwIfCancelled(signal);
    yield { type: "uploading", path, done, total: diff.upload.length };
    const data = build.files.get(path);
    if (data !== undefined) await folder.write(path, data);
  }

  if (diff.remove.length > 0) {
    // The new files are all there; until the old ones are gone the manifest lists them too, so a
    // publish cancelled from here still removes them next time.
    const pending: Manifest = { ...next, files: { ...next.files } };
    for (const path of diff.remove) {
      const digest = previous?.files[path];
      if (digest !== undefined) pending.files[path] = digest;
    }
    await folder.write(MANIFEST_FILE, encodeManifest(pending));
    for (const path of diff.remove) {
      throwIfCancelled(signal);
      await folder.remove(path);
    }
  }
  await folder.write(MANIFEST_FILE, encodeManifest(next));

  yield {
    type: "published",
    url,
    uploaded: diff.upload.length,
    unchanged: diff.unchanged.length,
    removed: diff.remove.length,
  };
}
