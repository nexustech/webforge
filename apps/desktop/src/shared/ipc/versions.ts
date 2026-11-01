import { siteDocSchema } from "@webforge/model";
import { z } from "zod";
import type { ProjectResult } from "./project.js";
import { projectResultSchema, sessionIdSchema } from "./project.js";

/** The longest name the person can give a version (Save version…, 4.6). */
export const VERSION_NAME_MAX = 100;

/**
 * Why a version was saved (ADR 0020): by the person (`manual`), or by Webforge on the site's first
 * opening of the day, before a restore, before a site-wide change, or as a publish went live.
 */
const versionReasonSchema = z.enum([
  "manual",
  "daily",
  "before-restore",
  "before-site-wide",
  "on-publish",
]);

/** Why a version was saved. */
export type VersionReason = z.infer<typeof versionReasonSchema>;

/**
 * The reasons the renderer asks main to save a version for: the person's own, and the automatic
 * ones it takes before a restore and before a site-wide change (ADR 0018 §3). Main saves the daily
 * one itself, and 4.5's publish the one it goes live with.
 */
const requestedReasonSchema = z.enum(["manual", "before-restore", "before-site-wide"]);

/** A version as Version History lists it. */
const versionSummarySchema = z.strictObject({
  id: z.uuid(),
  /** The person's name for it; empty for one Webforge saved, which the panel names by `reason`. */
  name: z.string().max(VERSION_NAME_MAX),
  reason: versionReasonSchema,
  /** When it was saved: ISO 8601, UTC. */
  createdAt: z.iso.datetime(),
  /** Its picture's hash, a JPEG of the canvas, served as `webforge-media://original/<hash>`. */
  thumbnailHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  /** What it alone keeps in the file: what deleting it would free. */
  bytes: z.int().nonnegative(),
});

/** A version as Version History lists it. */
export type VersionSummary = z.infer<typeof versionSummarySchema>;

/** Why a call about the open site's versions did nothing. */
const failureSchema = z.strictObject({
  status: z.literal("failed"),
  /**
   * No site is open, another opened since the renderer loaded (`stale-session`), the site is from
   * a newer Webforge (`read-only`), or something else went wrong.
   */
  reason: z.enum(["no-site", "stale-session", "read-only", "unknown"]),
});

const listResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("ok"),
    /** Newest first. */
    versions: z.array(versionSummarySchema),
    /** What all the versions keep that the site itself doesn't. */
    bytes: z.int().nonnegative(),
  }),
  failureSchema,
]);

/** The open site's versions. */
export type ListVersionsResult = z.infer<typeof listResultSchema>;

const saveResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("saved"), version: versionSummarySchema }),
  failureSchema,
]);

/** Outcome of saving a version. */
export type SaveVersionResult = z.infer<typeof saveResultSchema>;

const deleteResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("deleted") }),
  /** There is no such version, or no longer. */
  z.strictObject({ status: z.literal("not-found") }),
  failureSchema,
]);

/** Outcome of deleting a version. */
export type DeleteVersionResult = z.infer<typeof deleteResultSchema>;

const readSiteResultSchema = z.discriminatedUnion("status", [
  /** The version's site, migrated to this Webforge's site format. */
  z.strictObject({ status: z.literal("ok"), site: siteDocSchema }),
  z.strictObject({ status: z.literal("not-found") }),
  /** Its documents don't make a valid site, or use a newer site format. */
  z.strictObject({
    status: z.literal("unreadable"),
    reason: z.enum(["invalid", "newer-format"]),
  }),
  failureSchema,
]);

/** A version's site, to preview or restore it. */
export type ReadVersionSiteResult = z.infer<typeof readSiteResultSchema>;

/** IPC channels of the `versions` domain (`versions:*`), on the open site (F-SITE-4, 4.6). */
export const versionsChannels = {
  /** The open site's versions, and the space they take. */
  listVersions: {
    channel: "versions:list",
    request: z.tuple([sessionIdSchema]),
    response: listResultSchema,
  },
  /**
   * Saves the site as it is in its file as a version, with a picture of the canvas. The renderer
   * saves its last changes first (ADR 0018 §3). An automatic one deletes the oldest automatic
   * versions past the person's Versions kept.
   */
  saveVersion: {
    channel: "versions:save",
    request: z.tuple([
      sessionIdSchema,
      z.strictObject({
        name: z.string().trim().max(VERSION_NAME_MAX),
        reason: requestedReasonSchema,
      }),
    ]),
    response: saveResultSchema,
  },
  /** Deletes a version. */
  deleteVersion: {
    channel: "versions:delete",
    request: z.tuple([sessionIdSchema, z.uuid()]),
    response: deleteResultSchema,
  },
  /** A version's site, to preview or restore it in the editor. */
  readVersionSite: {
    channel: "versions:read-site",
    request: z.tuple([sessionIdSchema, z.uuid()]),
    response: readSiteResultSchema,
  },
  /**
   * Opens a version as a new site where the person chooses (P5): its pages, Media and choices,
   * with no publish destinations (ADR 0018 §2). It replaces the open site, as New Site does.
   */
  openVersionAsNewSite: {
    channel: "versions:open-as-new-site",
    request: z.tuple([sessionIdSchema, z.uuid()]),
    response: projectResultSchema,
  },
} as const;

/** `window.webforge.versions`: Version History (F-SITE-4, 4.6). */
export interface VersionsApi {
  /** The open site's versions, newest first, and the space they take. */
  list(sessionId: string): Promise<ListVersionsResult>;
  /** Saves the site's file as it is as a version; save the editor's last changes first. */
  save(
    sessionId: string,
    version: { readonly name: string; readonly reason: z.infer<typeof requestedReasonSchema> },
  ): Promise<SaveVersionResult>;
  /** Deletes version `id`. */
  delete(sessionId: string, id: string): Promise<DeleteVersionResult>;
  /** Version `id`'s site, to preview or restore it. */
  readSite(sessionId: string, id: string): Promise<ReadVersionSiteResult>;
  /** Opens version `id` as a new site, which replaces the open one. */
  openAsNewSite(sessionId: string, id: string): Promise<ProjectResult>;
}
