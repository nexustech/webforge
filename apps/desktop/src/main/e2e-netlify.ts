/**
 * The E2E tests' stand-in for Netlify's API (4.2): the address in `WEBFORGE_E2E_NETLIFY_API`, which
 * only an app run from its build folder honours, as `WEBFORGE_E2E_BUNDLE` and its kind are. A
 * packaged app always talks to Netlify itself, whatever its environment says. `undefined` means
 * Netlify's own API.
 */
export function netlifyApiFor(packaged: boolean, env = process.env): string | undefined {
  if (packaged) return undefined;
  const address = env.WEBFORGE_E2E_NETLIFY_API?.trim();
  return address === undefined || address === "" ? undefined : address;
}
