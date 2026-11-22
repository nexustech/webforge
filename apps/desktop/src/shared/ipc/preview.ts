import { z } from "zod";
import { DEVICE_SIZE } from "./prefs.js";
import { sessionIdSchema } from "./project.js";
import { type SiteContent, siteContentSchema } from "./site.js";

/**
 * A page's file in the preview, as the build names it (`index.html`, `services/cakes.html`): never
 * absolute, never a step up, so it only ever names a page of the preview.
 */
const pagePathSchema = z
  .string()
  .min(6)
  .max(1024)
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[^\\:?#]+\.html$/);

/** A page's file in the preview, as the build names it. */
export type PreviewPage = z.infer<typeof pagePathSchema>;

/**
 * The preview's address for a phone (F-PV-1): on the computer's local network, or none when the
 * computer isn't on one.
 */
const phoneAddressSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("ready"), url: z.url({ protocol: /^http$/ }).max(2048) }),
  z.strictObject({ status: z.literal("offline") }),
]);

/** The preview's address for a phone. */
export type PhoneAddress = z.infer<typeof phoneAddressSchema>;

/** What a page is saved as (5.22): a picture of all of it, or a PDF. */
const pageFileKindSchema = z.enum(["png", "pdf"]);

/** What a page is saved as. */
export type PageFileKind = z.infer<typeof pageFileKindSchema>;

/** The page to save (5.22): its file, its name for the file's, and the device width it's drawn at. */
const pageToSaveSchema = z.strictObject({
  page: pagePathSchema,
  /** The page's title, which the save dialog offers as the file's name. */
  name: z.string().max(200),
  width: z.number().int().min(DEVICE_SIZE.min).max(DEVICE_SIZE.max),
  kind: pageFileKindSchema,
});

/** The page to save as a picture or a PDF. */
type PageToSave = z.infer<typeof pageToSaveSchema>;

/** Outcome of saving a page as a picture or a PDF (5.22). */
const savePageResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("saved"),
    /** The file's name, never its full path. */
    fileName: z.string().min(1),
    /** A picture of a page longer than one can hold: it stops short of the page's end. */
    cut: z.boolean(),
  }),
  z.strictObject({ status: z.literal("canceled") }),
  z.strictObject({
    status: z.literal("failed"),
    /**
     * The page couldn't be built or drawn; or the file couldn't be written: no permission there,
     * a full disk, or another reason.
     */
    reason: z.enum(["draw", "not-allowed", "disk-full", "write"]),
  }),
]);

/** Outcome of saving a page as a picture or a PDF. */
export type SavePageResult = z.infer<typeof savePageResultSchema>;

/**
 * IPC channels of the `preview` domain (`preview:*`, 3.2). Each one's arguments are checked; each
 * that sends the site names the opening it is for (`sessionId`, #663), whose Media it builds with.
 */
export const previewChannels = {
  /**
   * Starts the preview of the site, if it isn't running, at `page`, and opens it in the default
   * browser. `failed` when the browser couldn't be opened or the server couldn't start.
   */
  previewOpen: {
    channel: "preview:open",
    request: z.tuple([sessionIdSchema, siteContentSchema, pagePathSchema]),
    response: z.enum(["opened", "failed"]),
  },
  /**
   * The address of the page the preview opens next in the browser, for the opening `sessionId` (an
   * AI app's openPreview, #1255): on this computer, with the preview's secret base. `null` if it
   * doesn't open, or not within a while (the person may be asked first about code to trust).
   */
  previewNextOpened: {
    channel: "preview:next-opened",
    request: z.tuple([sessionIdSchema]),
    response: z
      .url({ protocol: /^http$/ })
      .max(2048)
      .nullable(),
  },
  /**
   * Opens a version's site, read as it was, at `page` in the default browser (Version History's
   * Preview, 4.6): apart from the live preview, which the editor's changes never reach it from.
   */
  previewVersion: {
    channel: "preview:version",
    request: z.tuple([sessionIdSchema, siteContentSchema, pagePathSchema]),
    response: z.enum(["opened", "failed"]),
  },
  /** The site changed: the browsers showing the preview get the change. Nothing while it's closed. */
  previewUpdate: {
    channel: "preview:update",
    request: z.tuple([sessionIdSchema, siteContentSchema]),
    response: z.null(),
  },
  /** The editor shows `page`: the browsers showing the preview go there. */
  previewShow: {
    channel: "preview:show",
    request: z.tuple([pagePathSchema]),
    response: z.null(),
  },
  /**
   * Starts the preview, if it isn't running, and makes it reachable on the local network: its
   * address for a phone, at `page`, to show as a QR code.
   */
  previewPhone: {
    channel: "preview:phone",
    request: z.tuple([sessionIdSchema, siteContentSchema, pagePathSchema]),
    response: phoneAddressSchema,
  },
  /** Stops the preview's listener on the local network; the desktop preview goes on. */
  previewStopPhone: {
    channel: "preview:stop-phone",
    request: z.tuple([]),
    response: z.null(),
  },
  /**
   * Saves a page of the site as it is now, as Preview builds it, as a picture of all of it or a
   * PDF (5.22): main asks where, draws it and writes the file. Nothing is written when the person
   * cancels.
   */
  previewSavePage: {
    channel: "preview:save-page",
    request: z.tuple([sessionIdSchema, siteContentSchema, pageToSaveSchema]),
    response: savePageResultSchema,
  },
} as const;

/** Messages the main process sends to the renderer in the `preview` domain. */
export const previewEvents = {
  /**
   * The preview's listener on the local network stopped by itself: no phone used it for a while,
   * or the computer left that network (S9). A phone needs a new address now.
   */
  phoneStopped: { channel: "preview:phone-stopped", args: z.tuple([]) },
} as const;

/** `window.webforge.preview`: the preview server (3.2, F-PV-1). */
export interface PreviewApi {
  /** Opens the preview of the site opened as `sessionId`, at `page`, in the default browser. */
  open(sessionId: string, site: SiteContent, page: PreviewPage): Promise<"opened" | "failed">;
  /** The address of the page the preview opens next for `sessionId`; `null` if it doesn't. */
  nextOpened(sessionId: string): Promise<string | null>;
  /** Opens version `site` of the site opened as `sessionId`, at `page`, in the default browser. */
  openVersion(
    sessionId: string,
    site: SiteContent,
    page: PreviewPage,
  ): Promise<"opened" | "failed">;
  /** Tells the preview the site opened as `sessionId` changed. */
  update(sessionId: string, site: SiteContent): Promise<null>;
  /** Tells the preview the editor shows `page`. */
  show(page: PreviewPage): Promise<null>;
  /** The preview's address for a phone on the same network, at `page`. */
  phone(sessionId: string, site: SiteContent, page: PreviewPage): Promise<PhoneAddress>;
  /** Stops the preview on the local network: no phone can open it any more. */
  stopPhone(): Promise<null>;
  /** Saves a page of the site opened as `sessionId` as a picture or a PDF, where the person chooses. */
  savePage(sessionId: string, site: SiteContent, page: PageToSave): Promise<SavePageResult>;
  /**
   * Calls `listener` when the preview on the local network stops by itself, until the returned
   * function is called.
   */
  onPhoneStopped(listener: () => void): () => void;
}
