import { z } from "zod";
import type { FormService } from "./settings.js";

/**
 * Why a form has nowhere to send (2.8, 3.7): no form service in Site Settings, Netlify Forms (which
 * its publisher adds, 4.2), an address that isn't `https://`, or a Newsletter without its form
 * address. The form still draws, without an `action`; Site Check and the export report it.
 */
export type FormUnset = "noService" | "netlify" | "insecure" | "noAddress";

/** An `https://` address on a domain. */
const HTTPS_ADDRESS = z.url({ protocol: /^https$/, hostname: z.regexes.domain });

/**
 * `value` as an address a form may post to: `https://` only, so a visitor's details never travel
 * unencrypted, and never a `javascript:` address. `undefined` for anything else. The one check for
 * the Newsletter's address and a custom form service's.
 */
export function httpsAddress(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const address = value.trim();
  return HTTPS_ADDRESS.safeParse(address).success ? address : undefined;
}

/**
 * Why a form posting to Site Settings' `service` (the Contact form, a Form) can't send, or
 * `undefined` when it can.
 */
export function formServiceUnset(service: FormService | undefined): FormUnset | undefined {
  switch (service?.kind) {
    case undefined:
      return "noService";
    case "netlify":
      return "netlify";
    case "custom":
      return httpsAddress(service.url) === undefined ? "insecure" : undefined;
    default:
      return undefined;
  }
}

/** Why a Newsletter posting to its own form `address` can't send, or `undefined` when it can. */
export function newsletterUnset(address: unknown): FormUnset | undefined {
  if (typeof address !== "string" || address.trim() === "") return "noAddress";
  return httpsAddress(address) === undefined ? "insecure" : undefined;
}

/**
 * The hidden field each form service reads its thank-you page's address from (3.7, B3), for the
 * services that take one on their free plans: Web3Forms (an `https://` address on the site's own
 * domain) and FormSubmit. Formspree's is a setting of its paid plans, and a custom endpoint's
 * conventions are its own: theirs show the service's own thank-you page.
 */
export const THANKS_FIELD: Readonly<Partial<Record<FormService["kind"], string>>> = {
  web3forms: "redirect",
  formsubmit: "_next",
};

/** The thank-you page's path in the export (3.7): the site's own page there, or one made for it. */
export const THANKS_PATH = "thank-you";
