import { z } from "zod";
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

/** IPC channels of the `preview` domain (`preview:*`, 3.2). Each one's arguments are checked. */
export const previewChannels = {
  /**
   * Starts the preview of the site, if it isn't running, at `page`, and opens it in the default
   * browser. `failed` when the browser couldn't be opened or the server couldn't start.
   */
  previewOpen: {
    channel: "preview:open",
    request: z.tuple([siteContentSchema, pagePathSchema]),
    response: z.enum(["opened", "failed"]),
  },
  /** The site changed: the browsers showing the preview get the change. Nothing while it's closed. */
  previewUpdate: {
    channel: "preview:update",
    request: z.tuple([siteContentSchema]),
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
    request: z.tuple([siteContentSchema, pagePathSchema]),
    response: phoneAddressSchema,
  },
} as const;

/** `window.webforge.preview`: the preview server (3.2, F-PV-1). */
export interface PreviewApi {
  /** Opens the site's preview at `page` in the default browser. */
  open(site: SiteContent, page: PreviewPage): Promise<"opened" | "failed">;
  /** Tells the preview the site changed. */
  update(site: SiteContent): Promise<null>;
  /** Tells the preview the editor shows `page`. */
  show(page: PreviewPage): Promise<null>;
  /** The preview's address for a phone on the same network, at `page`. */
  phone(site: SiteContent, page: PreviewPage): Promise<PhoneAddress>;
}
