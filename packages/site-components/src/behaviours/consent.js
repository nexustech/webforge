// Google Analytics and its consent banner (3.8, B4, B7). The banner shows until the visitor
// chooses, and the choice is kept in this browser. Google's script loads only once they accept,
// with Consent Mode v2's default denied and then analytics granted; or at once when the site has no
// banner (the owner's choice). Opened from disk (a preview of the export), nothing is ever counted.
// "Accept all" also loads the page's embeds: it marks the page (`data-wf-consent-all`, for a
// returning visitor before the embed script runs) and tells the embed script
// (`webforge:consent-all`). Cookie settings in the Footer reopen the banner: declining after
// accepting stops the counting and removes Google's cookies (#539).
(() => {
  const banner = document.querySelector("[data-wf-consent]");
  if (!(banner instanceof HTMLElement)) {
    return;
  }
  const KEY = "webforge-consent";
  // The page's globals Google's snippet sets: its command queue and the function that fills it.
  const page = /** @type {Window & { dataLayer?: unknown[], gtag?: Function }} */ (window);
  const id = banner.dataset.measurementId ?? "";
  const counts = window.location.protocol !== "file:" && /^G-[A-Z0-9]{4,12}$/.test(id);
  let loaded = false;

  // A browser that keeps nothing (private windows, blocked storage) asks again on each page.
  const stored = () => {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  /** @param {"granted" | "denied"} choice */
  const store = (choice) => {
    try {
      window.localStorage.setItem(KEY, choice);
    } catch {
      // Nothing to keep it in: the choice holds for this page.
    }
  };

  /** @param {boolean} granted */
  const loadAnalytics = (granted) => {
    if (!counts || loaded) {
      return;
    }
    loaded = true;
    const layer = page.dataLayer ?? [];
    page.dataLayer = layer;
    // gtag.js reads its commands as `arguments` objects, so this is the snippet Google gives.
    /** @type {(...command: unknown[]) => void} */
    const gtag = function gtag() {
      // biome-ignore lint/complexity/noArguments: gtag.js expects the arguments object itself.
      layer.push(arguments);
    };
    page.gtag = gtag;
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
    if (granted) {
      gtag("consent", "update", { analytics_storage: "granted" });
    }
    gtag("js", new Date());
    gtag("config", id);
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.append(script);
  };

  const acceptAll = () => {
    document.documentElement.setAttribute("data-wf-consent-all", "");
    document.dispatchEvent(new Event("webforge:consent-all"));
    loadAnalytics(true);
  };

  /**
   * Removes Google Analytics' cookies for this site (`_ga`, `_ga_<id>`), as far as a page may: for
   * this host and each domain above it, where Google sets them.
   */
  const forgetCookies = () => {
    const names = document.cookie
      .split(";")
      .map((part) => part.split("=")[0]?.trim() ?? "")
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));
    const parts = window.location.hostname.split(".");
    const domains = parts.map((_, at) => parts.slice(at).join("."));
    for (const name of names) {
      for (const domain of ["", ...domains]) {
        const scope = domain === "" ? "" : `; domain=${domain}`;
        // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API isn't in every browser a site is opened in.
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${scope}`;
      }
    }
  };

  if (!banner.hasAttribute("data-ask")) {
    loadAnalytics(true);
    return;
  }
  const accept = banner.querySelector("[data-wf-consent-accept]");
  const decline = banner.querySelector("[data-wf-consent-decline]");
  accept?.addEventListener("click", () => {
    store("granted");
    banner.hidden = true;
    acceptAll();
  });
  decline?.addEventListener("click", () => {
    store("denied");
    banner.hidden = true;
    if (loaded) {
      // Declining after accepting (#539): counting stops now, Google's cookies go, and a fresh
      // page, where gtag.js no longer loads, stops the script that was already running.
      page.gtag?.("consent", "update", { analytics_storage: "denied" });
      forgetCookies();
      window.location.reload();
    }
  });
  // Cookie settings in the Footer: the banner again, so the visitor can change their choice (#539).
  for (const open of document.querySelectorAll("[data-wf-consent-open]")) {
    if (!(open instanceof HTMLElement)) continue;
    open.hidden = false;
    open.addEventListener("click", () => {
      banner.hidden = false;
      if (decline instanceof HTMLElement) decline.focus();
    });
  }

  const choice = stored();
  if (choice === "granted") {
    acceptAll();
  } else if (choice !== "denied") {
    banner.hidden = false;
  }
})();
