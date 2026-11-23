import type { StoreApi } from "zustand/vanilla";
import type { CodeTrust } from "./code-trust.js";
import type { FirstTips } from "./first-tips.js";
import type { PublishRequests } from "./publish-requests.js";
import { defineService } from "./services.js";
import type { VersionActions, VersionList } from "./version-history.js";

// The services the window's areas share (#984): each provided by one area, listed in `uses` by
// the areas that use it. The area that provides each says so beside its token.

/**
 * The year the open site was last published in (F-CM-8), `undefined` when it hasn't been: as its
 * versions record it when it opened, then each publish from this window (4.5). Publish provides it.
 */
export const PublishedYear = defineService<StoreApi<number | undefined>>("publishedYear");

/**
 * Whether the open site has a Netlify destination (4.2), for Site Settings' *Netlify Forms*: as
 * the site's file said when it opened, then as Publish lists its destinations. Publish provides it.
 */
export const OnNetlify = defineService<StoreApi<boolean>>("onNetlify");

/**
 * Version History's requests to republish a version, and Publish's word that one went live.
 * Publish provides it.
 */
export const Publishing = defineService<PublishRequests>("publishing");

/**
 * The code trust step (#649): asks before the site's code runs, and keeps what's trusted. Code
 * trust provides it.
 */
export const TrustedCode = defineService<CodeTrust>("trustedCode");

/**
 * Version History's list of the open site's versions and its actions on them (4.6): what AI apps'
 * _While you were away_ restores with (5.36). Version History provides it.
 */
export const VersionHistory = defineService<{
  readonly list: VersionList;
  readonly actions: VersionActions;
}>("versionHistory");

/** Where areas say the person has reached a first-time tip's place (OB-4, 5.4a). Onboarding provides it. */
export const TipPlaces = defineService<FirstTips>("tipPlaces");

/**
 * How many things Site Check lists to fix in the open site: *Must fix* and *Should fix*, ignored
 * ones left out, as its title-bar button counts them (#1009). The export's and Publish's reports
 * say it (#1171). Site Check provides it.
 */
export const SiteCheckToFix = defineService<StoreApi<number>>("siteCheckToFix");

/**
 * What the person ignored in Site Check for the open site (3.6), as the window opened with it, and
 * how to remember a change. Site Check provides it.
 */
export const SiteCheckIgnored = defineService<{
  readonly initial: readonly string[];
  readonly save: (ignored: readonly string[]) => void;
}>("siteCheckIgnored");
