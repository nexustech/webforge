import {
  createSite,
  type MediaId,
  type MediaMeta,
  type NodeDoc,
  type SiteDoc,
} from "@webforge/model";
import { CATALOGUE } from "@webforge/site-components/catalogue-data";
import type { CheckRule } from "./types.js";

/** A site whose home page holds `home`; `changes` replace parts of it. */
export function siteWith(home: NodeDoc[] = [], changes: Partial<SiteDoc> = {}): SiteDoc {
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
    homeDoc: { root: { props: {} }, content: home },
  });
  return { ...site, ...changes };
}

/** An element of `type` with `props`. */
export const element = (
  type: string,
  id: string,
  props: Record<string, unknown> = {},
): NodeDoc => ({
  type,
  props: { id, ...props },
});

/** An image in Media. */
export function image(id: string, changes: Partial<MediaMeta> = {}): MediaMeta {
  return {
    id: id as MediaId,
    kind: "image",
    hash: "a".repeat(64),
    name: id,
    fileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    alt: "Loaves on the counter",
    ...changes,
  } as MediaMeta;
}

/** A document in Media of `size` bytes. */
export function file(id: string, size: number): MediaMeta {
  return {
    id: id as MediaId,
    kind: "file",
    hash: "b".repeat(64),
    name: id,
    fileName: `${id}.pdf`,
    mimeType: "application/pdf",
    size,
  };
}

/** What `rule` finds in `site`, built from Webforge's catalogue. */
export const findIn = (rule: CheckRule, site: SiteDoc) =>
  rule.check({ site, catalogue: CATALOGUE });
