import { eachElement } from "@webforge/model";
import {
  cssResources,
  type ExternalResource,
  htmlResources,
  isAllowed,
  scriptResources,
} from "../external.js";
import { elementPlace, exportedPlaces } from "../fields.js";
import type { CheckRule, Finding, FindingPlace, SiteCodePart } from "../types.js";

/** How each part of the site's own code is read for the files it loads. */
const SITE_CODE_PARTS: readonly (readonly [SiteCodePart, (code: string) => ExternalResource[]])[] =
  [
    ["head", htmlResources],
    ["bodyEnd", htmlResources],
    ["css", cssResources],
    ["js", scriptResources],
  ];

/**
 * A file the site's own code loads from another website (C8, 3.9): a script, a stylesheet, a font,
 * an image, a sound or video, or a frame, in a Custom Code element or in Settings' Custom Code. The
 * exported site would depend on that website, and wouldn't work from disk or offline: *Must fix*,
 * unless Settings allow its address. Each finding names the address (`url`) and what it is
 * (`kind`).
 */
export const externalResourcesRule: CheckRule = {
  id: "externalResources",
  level: "must",
  check: ({ site }) => {
    const found: Finding[] = [];
    const allowed = site.settings.allowedExternalUrls;
    const report = (place: FindingPlace, at: string, resources: readonly ExternalResource[]) => {
      for (const { url, kind } of resources) {
        if (isAllowed(url, allowed)) continue;
        found.push({ key: `${at}/${url}`, place, values: { url, kind } });
      }
    };
    const exported = exportedPlaces(site);
    eachElement(
      site,
      (node, on) => {
        if (!exported(on) || node.type !== "CustomCode" || typeof node.props.code !== "string") {
          return;
        }
        report(
          elementPlace({ on, node }),
          `${on}/${node.props.id}`,
          htmlResources(node.props.code),
        );
      },
      { skipHidden: true },
    );
    for (const [part, read] of SITE_CODE_PARTS) {
      report({ kind: "code", part }, `code/${part}`, read(site.code[part]));
    }
    return found;
  },
};
