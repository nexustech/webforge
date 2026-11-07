import blank from "../templates/blank/images.json" with { type: "json" };
import cafe from "../templates/cafe/images.json" with { type: "json" };
import consultant from "../templates/consultant/images.json" with { type: "json" };
import personal from "../templates/personal/images.json" with { type: "json" };
import photographer from "../templates/photographer/images.json" with { type: "json" };
import salon from "../templates/salon/images.json" with { type: "json" };
import shop from "../templates/shop/images.json" with { type: "json" };
import trades from "../templates/trades/images.json" with { type: "json" };
import type { TemplateId } from "./template.js";

/** Each template's images, by the hash of their bytes: every template, or this doesn't compile. */
const MANIFESTS: Readonly<Record<TemplateId, readonly { readonly hash: string }[]>> = {
  blank,
  cafe,
  consultant,
  personal,
  photographer,
  salon,
  shop,
  trades,
};

/**
 * The SHA-256 of every picture the shipped templates come with (4.12b, AIB-7): a Media item with
 * one of these is still the template's placeholder, which Site Check's *Pictures from the
 * template* tip lists, so the person (or an AI app) knows which to replace with their own.
 */
export const TEMPLATE_IMAGE_HASHES: ReadonlySet<string> = new Set(
  Object.values(MANIFESTS).flatMap((images) => images.map((image) => image.hash)),
);
