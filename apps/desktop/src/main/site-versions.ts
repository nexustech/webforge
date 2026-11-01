import { SiteFormatError, siteDocSchema } from "@webforge/model";
import {
  ProjectFileError,
  type ProjectStore,
  ReadOnlyProjectError,
  type SitePackage,
  sitePackageOf,
  type VersionInfo,
  type VersionReason,
} from "@webforge/storage";
import type {
  DeleteVersionResult,
  ListVersionsResult,
  ReadVersionSiteResult,
  SaveVersionResult,
  VersionSummary,
} from "../shared/ipc/versions.js";
import { logFailure } from "./log.js";
import type { SiteStore, StaleReason } from "./site-store.js";

// The open site's versions (F-SITE-4, 4.6): each call on the opening it was made for (R6), through
// the gate's shared side, as the site's other operations are (A13).

/** A version as the renderer is told of it, with what it alone keeps. */
function summaryOf(version: VersionInfo, bytes: ReadonlyMap<string, number>): VersionSummary {
  return {
    id: version.id,
    name: version.name,
    reason: version.reason,
    createdAt: version.createdAt,
    ...(version.thumbnailHash === undefined ? {} : { thumbnailHash: version.thumbnailHash }),
    bytes: bytes.get(version.id) ?? 0,
  };
}

const failed = (reason: StaleReason | "read-only" | "unknown") =>
  ({ status: "failed", reason }) as const;

/** The open site's versions, newest first, and what they keep. */
export function listVersions(site: SiteStore): Promise<ListVersionsResult> {
  return site.withStore<ListVersionsResult>(
    "shared",
    (store) => {
      const space = store.versionSpace();
      const bytes = new Map(space.versions.map(({ id, bytes: own }) => [id, own]));
      return {
        status: "ok",
        versions: store.listVersions().map((version) => summaryOf(version, bytes)),
        bytes: space.bytes,
      };
    },
    failed,
  );
}

/** What {@link saveVersion} saves. */
export type VersionToSave = {
  readonly name: string;
  readonly reason: VersionReason;
  /** A JPEG of the canvas, if one could be taken. */
  readonly thumbnail: Uint8Array | undefined;
  /** How many automatic versions to keep: older ones are deleted once an automatic one is saved. */
  readonly kept: number;
};

/**
 * Saves the site as its file holds it as a version, with its picture (P3). An automatic version
 * then deletes the oldest automatic ones past `kept`; the person's own are never deleted.
 */
export function saveVersion(site: SiteStore, version: VersionToSave): Promise<SaveVersionResult> {
  return site.withStore<SaveVersionResult>(
    "shared",
    (store) => {
      try {
        const saved = saveVersionIn(store, version);
        return { status: "saved", version: summaryOf(saved, new Map()) };
      } catch (error) {
        if (error instanceof ReadOnlyProjectError) return failed("read-only");
        logFailure("Webforge could not save a version of a site", error);
        return failed("unknown");
      }
    },
    failed,
  );
}

/** {@link saveVersion} in `store`, which the caller holds. */
export function saveVersionIn(store: ProjectStore, version: VersionToSave): VersionInfo {
  const thumbnailHash =
    version.thumbnail === undefined ? undefined : store.putBlob(version.thumbnail, "image/jpeg");
  const saved = store.saveVersion(version.name, version.reason, {
    ...(thumbnailHash === undefined ? {} : { thumbnailHash }),
  });
  if (saved.kind === "auto") store.pruneAutoVersions(version.kept);
  return saved;
}

/** Deletes version `id`; the space it alone kept is given back as the site closes. */
export function deleteVersion(site: SiteStore, id: string): Promise<DeleteVersionResult> {
  return site.withStore<DeleteVersionResult>(
    "shared",
    (store) => {
      try {
        return store.deleteVersion(id) ? { status: "deleted" } : { status: "not-found" };
      } catch (error) {
        if (error instanceof ReadOnlyProjectError) return failed("read-only");
        logFailure("Webforge could not delete a version of a site", error);
        return failed("unknown");
      }
    },
    failed,
  );
}

/** Version `id`'s site in `store`, migrated, or why not. */
function versionSiteIn(
  store: ProjectStore,
  id: string,
): Exclude<ReadVersionSiteResult, { status: "failed" }> {
  try {
    const read = store.readVersionSite(id);
    if (read === undefined) return { status: "not-found" };
    const checked = siteDocSchema.safeParse(read);
    return checked.success
      ? { status: "ok", site: checked.data }
      : { status: "unreadable", reason: "invalid" };
  } catch (error) {
    if (error instanceof SiteFormatError || error instanceof ProjectFileError) {
      logFailure("Webforge could not read a version of a site", error);
      return {
        status: "unreadable",
        reason: error instanceof SiteFormatError ? error.code : "invalid",
      };
    }
    throw error;
  }
}

/** Version `id`'s site, migrated to this Webforge's site format, to preview or restore it. */
export function readVersionSite(site: SiteStore, id: string): Promise<ReadVersionSiteResult> {
  return site.withStore<ReadVersionSiteResult>(
    "shared",
    (store) => versionSiteIn(store, id),
    failed,
  );
}

/** A version as a site of its own, or why it can't be read. */
export type VersionPackageResult =
  | { readonly pack: SitePackage }
  | Exclude<ReadVersionSiteResult, { status: "ok" }>;

/** Version `id` as a site of its own, with what it reaches, to open as a new site (P5). */
export function versionPackage(site: SiteStore, id: string): Promise<VersionPackageResult> {
  return site.withStore<VersionPackageResult>(
    "shared",
    (store) => {
      const read = versionSiteIn(store, id);
      return read.status === "ok" ? { pack: sitePackageOf(store, read.site) } : read;
    },
    failed,
  );
}
