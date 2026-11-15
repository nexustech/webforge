import type { StoreApi } from "zustand/vanilla";
import type { PublishRequests } from "./publish-requests.js";
import { defineService } from "./services.js";

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
