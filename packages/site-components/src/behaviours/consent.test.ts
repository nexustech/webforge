import type { NodeDoc, SiteAnalytics } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary } from "../catalogue/index.js";
import { consentBannerHtml } from "../consent-banner.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

// The "consent" behaviour (3.8, B4, B7): Google Analytics behind the consent banner, with a Video
// whose embed "Accept all" loads, the scripts in webforge.js's order.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

const video: NodeDoc = {
  type: "Video",
  props: { id: "v", title: "Our bakery", address: "https://youtu.be/aqz-KE-bpKQ" },
};
const ANALYTICS: SiteAnalytics = { measurementId: "G-ABC123DEF4", consentBanner: true };
const footer: NodeDoc = { type: "Footer", props: { id: "footer", text: "© Rosa's Bakery" } };
const GTAG = "https://www.googletagmanager.com/gtag/js?id=G-ABC123DEF4";

/**
 * A page at `url` with the banner for `analytics`, a Video and the Footer (with Cookie settings
 * when the banner asks, as the export writes it), a `stored` choice and `cookies` from an earlier
 * visit, and the consent and embed scripts run on it. Reloading the page is recorded, not done.
 */
function page(
  options: {
    readonly analytics?: SiteAnalytics;
    readonly url?: string;
    readonly stored?: string;
    readonly cookies?: readonly string[];
  } = {},
) {
  const happy = new Window({
    url: options.url ?? "https://rosas-bakery.example/",
    settings: { disableIframePageLoading: true },
  });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis & {
    dataLayer?: unknown[];
    gtag?: unknown;
  };
  const { document } = window;
  if (options.stored !== undefined) window.localStorage.setItem("webforge-consent", options.stored);
  for (const cookie of options.cookies ?? []) document.cookie = cookie;
  const reload = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
  const analytics = options.analytics ?? ANALYTICS;
  const context = {
    ...EDITOR_RENDER_CONTEXT,
    ...(analytics.consentBanner ? { cookieSettings: true as const } : {}),
  };
  document.body.innerHTML = `${renderNodesToHtml([video, footer], siteLibrary, context)}${consentBannerHtml(analytics)}`;
  for (const name of ["consent", "embed"] as const) {
    new Function("window", "document", "HTMLElement", "Event", BEHAVIOUR_SCRIPTS[name] ?? "")(
      window,
      document,
      window.HTMLElement,
      window.Event,
    );
  }
  const banner = document.querySelector<HTMLElement>("[data-wf-consent]");
  const button = (name: "accept" | "decline") =>
    banner?.querySelector<HTMLButtonElement>(`[data-wf-consent-${name}]`) ?? null;
  const gtag = () =>
    [...document.querySelectorAll<HTMLScriptElement>("script")].map((script) => script.src);
  /** The commands Google's script reads, each as an array. */
  const commands = () =>
    (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
  const settings = document.querySelector<HTMLButtonElement>("[data-wf-consent-open]");
  return { window, document, banner, button, gtag, commands, settings, reload };
}

describe("the consent behaviour (3.8, B4, B7)", () => {
  it("asks first, and loads nothing from Google or the video's site until the visitor accepts", () => {
    const { document, banner, gtag, window } = page();

    expect(banner?.hidden).toBe(false);
    expect(gtag()).toEqual([]);
    expect(window.dataLayer).toBeUndefined();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("on Accept all, counts the visit with analytics granted, loads the embeds and remembers", () => {
    const { document, banner, button, gtag, commands, window } = page();

    button("accept")?.click();

    expect(banner?.hidden).toBe(true);
    expect(gtag()).toEqual([GTAG]);
    // Consent Mode v2: everything denied by default, then analytics granted.
    expect(commands().slice(0, 2)).toEqual([
      [
        "consent",
        "default",
        {
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          analytics_storage: "denied",
        },
      ],
      ["consent", "update", { analytics_storage: "granted" }],
    ]);
    expect(commands().at(-1)).toEqual(["config", "G-ABC123DEF4"]);
    expect(document.documentElement.hasAttribute("data-wf-consent-all")).toBe(true);
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
    );
    expect(window.localStorage.getItem("webforge-consent")).toBe("granted");
  });

  it("on Decline, counts nothing, loads no embed and remembers", () => {
    const { document, banner, button, gtag, window } = page();

    button("decline")?.click();

    expect(banner?.hidden).toBe(true);
    expect(gtag()).toEqual([]);
    expect(document.querySelector("iframe")).toBeNull();
    expect(window.localStorage.getItem("webforge-consent")).toBe("denied");
  });

  it("doesn't ask a returning visitor again: one who accepted is counted and sees the embeds", () => {
    const accepted = page({ stored: "granted" });
    expect(accepted.banner?.hidden).toBe(true);
    expect(accepted.gtag()).toEqual([GTAG]);
    // The embed script, run after, loads the video for them.
    expect(accepted.document.querySelector("iframe")).not.toBeNull();

    const declined = page({ stored: "denied" });
    expect(declined.banner?.hidden).toBe(true);
    expect(declined.gtag()).toEqual([]);
  });

  it("counts at once, without cookies, when the owner turned the banner off, and leaves the embeds", () => {
    const { document, banner, gtag, commands } = page({
      analytics: { ...ANALYTICS, consentBanner: false },
    });

    expect(banner?.hidden).toBe(true);
    expect(banner?.querySelector("button")).toBeNull();
    expect(gtag()).toEqual([GTAG]);
    // Analytics storage stays denied: no visitor chose otherwise (B4, amended; #650).
    expect(commands()[0]).toEqual([
      "consent",
      "default",
      expect.objectContaining({ analytics_storage: "denied" }),
    ]);
    expect(
      commands().filter(([command, kind]) => command === "consent" && kind === "update"),
    ).toEqual([]);
    expect(commands().at(-1)).toEqual(["config", "G-ABC123DEF4"]);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("reads only the banner the export wrote, after the Footer, not an element of the page (#650)", () => {
    const happy = new Window({ url: "https://rosas-bakery.example/" });
    windows.push(happy);
    const window = happy as unknown as typeof globalThis & { dataLayer?: unknown[] };
    const { document } = window;
    // Written by hand, as Advanced attributes no longer can (S3).
    document.body.innerHTML = `<main><h1 data-wf-consent data-measurement-id="G-ATTACKER1">Hi</h1></main><div data-wf-consent data-measurement-id="G-ATTACKER2"></div>${consentBannerHtml(ANALYTICS)}`;
    new Function("window", "document", "HTMLElement", "Event", BEHAVIOUR_SCRIPTS.consent ?? "")(
      window,
      document,
      window.HTMLElement,
      window.Event,
    );

    expect(window.dataLayer).toBeUndefined();
    expect(document.querySelectorAll("script")).toHaveLength(0);
    expect(document.querySelector<HTMLElement>("[data-ask]")?.hidden).toBe(false);
  });

  it("never counts a page opened from disk, though the banner still works there", () => {
    const { document, banner, button, gtag, window } = page({ url: "file:///C:/site/index.html" });
    expect(banner?.hidden).toBe(false);

    button("accept")?.click();

    expect(gtag()).toEqual([]);
    expect(window.dataLayer).toBeUndefined();
    // Accept all still loads the embeds: the preview shows what a visitor sees.
    expect(document.querySelector("iframe")).not.toBeNull();
    const off = page({
      url: "file:///C:/site/index.html",
      analytics: { ...ANALYTICS, consentBanner: false },
    });
    expect(off.gtag()).toEqual([]);
  });

  it("loads nothing for an ID that isn't a Measurement ID", () => {
    const { button, gtag } = page({
      analytics: { measurementId: '"><script>', consentBanner: true },
    });

    button("accept")?.click();

    expect(gtag()).toEqual([]);
  });
});

describe("changing the choice: Cookie settings in the Footer (#539)", () => {
  it("shows Cookie settings, which reopens the banner, its first button focused", () => {
    const { document, banner, button, settings } = page({ stored: "granted" });
    expect(banner?.hidden).toBe(true);
    expect(settings?.hidden).toBe(false);

    settings?.click();

    expect(banner?.hidden).toBe(false);
    expect(document.activeElement).toBe(button("decline"));
  });

  it("on Decline after accepting, stops counting, removes Google's cookies and starts a fresh page", () => {
    const { document, banner, button, settings, commands, reload, window } = page({
      stored: "granted",
      cookies: [
        "_ga=GA1.1.123.456; path=/",
        "_ga_ABC123DEF4=GS1.1.789; path=/",
        "basket=2; path=/",
      ],
    });

    settings?.click();
    button("decline")?.click();

    expect(banner?.hidden).toBe(true);
    expect(window.localStorage.getItem("webforge-consent")).toBe("denied");
    expect(commands().at(-1)).toEqual(["consent", "update", { analytics_storage: "denied" }]);
    // Google's cookies go; the site's own stay.
    expect(document.cookie).toBe("basket=2");
    // gtag.js keeps running once loaded: the fresh page doesn't load it.
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("on Accept after declining, counts from then on and loads the embeds, without a reload", () => {
    const { document, button, settings, gtag, reload, window } = page({ stored: "denied" });
    expect(gtag()).toEqual([]);

    settings?.click();
    button("accept")?.click();

    expect(window.localStorage.getItem("webforge-consent")).toBe("granted");
    expect(gtag()).toEqual([GTAG]);
    expect(document.querySelector("iframe")).not.toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads nothing when the visitor declines again, never having been counted", () => {
    const { button, settings, reload } = page({ stored: "denied" });

    settings?.click();
    button("decline")?.click();

    expect(reload).not.toHaveBeenCalled();
  });

  it("has no Cookie settings without the banner, which the owner turned off", () => {
    const { settings } = page({ analytics: { ...ANALYTICS, consentBanner: false } });

    expect(settings).toBeNull();
  });
});

describe("the consent banner (3.8)", () => {
  it("is a named region, hidden until the script shows it, with the person's text if they wrote one", () => {
    const html = consentBannerHtml({ ...ANALYTICS, consentMessage: "Cookies? Yes or no." });

    expect(html).toMatch(
      /^<section data-wf-consent="" data-measurement-id="G-ABC123DEF4" data-ask=""/,
    );
    expect(html).toContain('aria-label="Cookies"');
    expect(html).toContain(" hidden=");
    expect(html).toContain('<p class="text-sm">Cookies? Yes or no.</p>');
    // An empty text of the person's, or only spaces, is the standard one (#539).
    for (const consentMessage of ["", "   "]) {
      expect(consentBannerHtml({ ...ANALYTICS, consentMessage })).toContain(
        "We&#x27;d like to use cookies",
      );
    }
    expect(consentBannerHtml(ANALYTICS)).toContain(
      "We&#x27;d like to use cookies to count visits and see which pages are popular. Is that all right?",
    );
  });
});
