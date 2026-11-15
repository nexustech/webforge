import type { SiteDocumentChange } from "@webforge/model";
import { z } from "zod";
import type { JsonValue, Manifest } from "./blob-reach.js";
import type { ValidatedProject } from "./schema-check.js";

// What a project store takes and gives (#986, out of `project-store.ts`).

/** One document of the working copy, e.g. a page, the header or the theme. */
export type StoredDocument = {
  /** Stable id, e.g. `page:home` or `layout:header`. */
  readonly id: string;
  /** What the document is, e.g. `page`, `layout` or `theme`. */
  readonly kind: string;
  readonly content: JsonValue;
};

/**
 * A change to the working copy, of a kind `@webforge/model` defines. One
 * {@link ProjectStore.commit} applies a list of them atomically. Put content is stored as JSON;
 * `undefined` properties are dropped, as `JSON.stringify` does.
 */
export type DocumentChange = SiteDocumentChange;

/** A binary blob, such as an image, stored once under the SHA-256 hash of its bytes. */
export type StoredBlob = {
  readonly mime: string;
  readonly data: Uint8Array;
};

/** Who took a version: the user (`manual`) or Webforge (`auto`). */
export type VersionKind = "manual" | "auto";

/**
 * Why a version was saved (storage format 2, for 4.6): the person saved it (`manual`), or Webforge
 * did, once a day, before a restore, before a change to every page, or as the site went live.
 * Only `manual` ones are the person's: pruning never deletes them.
 */
export const VERSION_REASONS = [
  "manual",
  "daily",
  "before-restore",
  "before-site-wide",
  "on-publish",
] as const;

/** See {@link VERSION_REASONS}. */
export type VersionReason = (typeof VERSION_REASONS)[number];

/** Who saves a version for `reason`. */
export const kindOf = (reason: VersionReason): VersionKind =>
  reason === "manual" ? "manual" : "auto";

/**
 * The reason a version gets when only who saved it is known: a format 1 version's, a version 1
 * ZIP's, or one a newer Webforge saved for a reason this one doesn't know. `V1_REASON` in the
 * schema is its SQL twin.
 */
export const reasonOfKind = (kind: VersionKind): VersionReason =>
  kind === "manual" ? "manual" : "daily";

/**
 * Where a version was published, and what the live check found then (ADR 0018 §3): the last time,
 * when it has been republished.
 */
export const versionPublishSchema = z.strictObject({
  /** The site's publish destination (ADR 0018 §2). */
  destinationId: z.string().min(1).max(100),
  /** ISO 8601 timestamp (UTC). */
  publishedAt: z.iso.datetime(),
  /** The live check's answer (`@webforge/publish`'s `Verification`). */
  check: z.enum(["live", "different", "unreachable", "unchecked"]),
  /** The publisher's own name for what went live, such as Netlify's deploy id. */
  deploy: z.string().min(1).max(200).optional(),
});

/** See {@link versionPublishSchema}. */
export type VersionPublish = z.infer<typeof versionPublishSchema>;

/**
 * The editor's mode for a site (M3, 1.10): Design changes the layout, Content edits text and
 * images only. Remembered per site, but UI state: not part of the site, never versioned or undone.
 */
export type SiteEditorMode = "design" | "content";

export const siteEditorModeSchema = z.enum(["design", "content"]);

/** A saved version of the project (snapshot of the working copy). */
export type VersionInfo = {
  readonly id: string;
  readonly name: string;
  /** Who saved it, which follows from why. */
  readonly kind: VersionKind;
  readonly reason: VersionReason;
  /** ISO 8601 timestamp (UTC). */
  readonly createdAt: string;
  /** The site format its documents were saved in: {@link ProjectStore.readVersionSite} migrates. */
  readonly siteFormat: number;
  /** The SHA-256 of its picture, a blob, if it has one. */
  readonly thumbnailHash: string | undefined;
  readonly publishedTo: VersionPublish | undefined;
};

/** What {@link ProjectStore.addVersion} takes: a version as another project has it. */
export type NewVersion = Pick<VersionInfo, "id" | "name" | "reason" | "createdAt">;

/**
 * The working copy's documents as a version holds them, each one's id, kind and blob, from
 * {@link ProjectStore.readManifest}: what a publish builds is saved once it has gone live, from
 * the documents it read when it started (ADR 0018 §3).
 */
export type VersionManifest = Manifest["documents"];

/** What {@link ProjectStore.saveVersion} saves, besides a name and a reason. */
export type SaveVersionOptions = {
  /** Its documents, as {@link ProjectStore.readManifest} read them; the working copy's by default. */
  readonly documents?: VersionManifest;
  /** The SHA-256 of a blob holding its picture. */
  readonly thumbnailHash?: string;
  readonly publishedTo?: VersionPublish;
};

/** What {@link ProjectStore.putAsset} stores: an imported file's original bytes and facts. */
export type NewAsset = {
  /** The id of the site's Media item (`MediaId`). */
  readonly mediaId: string;
  readonly data: Uint8Array;
  readonly mime: string;
  /** Pixel size, for images. */
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  /** The file's name on the user's computer, e.g. `shop.jpg`. Never a path. */
  readonly originalName: string;
};

/** An imported Media item's original, as recorded in the `assets` table. */
export type AssetInfo = {
  readonly mediaId: string;
  /** SHA-256 of the original; {@link ProjectStore.readBlob} returns the bytes. */
  readonly hash: string;
  readonly mime: string;
  readonly width: number | undefined;
  readonly height: number | undefined;
  readonly originalName: string;
};

/** Facts about an open project. */
export type ProjectInfo = ValidatedProject & {
  /** Opened without write access: on request, or because a newer Webforge saved it. */
  readonly readOnly: boolean;
};

/** Options for {@link ProjectStore.open}. */
export type OpenProjectOptions = {
  /** Open without write access, e.g. to look inside a backup. */
  readonly readOnly?: boolean;
};

/** Options for {@link ProjectStore.create}. */
export type CreateProjectOptions = {
  /** Site name, e.g. "Rosa's Bakery". */
  readonly name: string;
};

/**
 * The meta rows a store reads and writes after it opens: the site's own settings outside its
 * document, each checked when read, so a bad value never stops the file opening.
 */
export type MetaKey =
  | "editor_mode"
  | "export_choices"
  | "site_check_ignored"
  | "last_published_at"
  | "publish_destinations";
