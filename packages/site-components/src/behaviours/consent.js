// Google Analytics and its consent banner (3.8, B4, B7). The banner shows until the visitor
// chooses, and the choice is kept in this browser. Google's script loads only once they accept,
// with Consent Mode v2's default denied and then analytics granted; or at once when the site has no
// banner (the owner's choice). Opened from disk (a preview of the export), nothing is ever counted.
// "Accept all" also loads the page's embeds: it marks the page (`data-wf-consent-all`, for a
// returning visitor before the embed script runs) and tells the embed script
// (`webforge:consent-all`).
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

  if (!banner.hasAttribute("data-ask")) {
    loadAnalytics(true);
    return;
  }
  const choice = stored();
  if (choice === "granted") {
    acceptAll();
    return;
  }
  if (choice === "denied") {
    return;
  }
  banner.hidden = false;
  banner.querySelector("[data-wf-consent-accept]")?.addEventListener("click", () => {
    store("granted");
    banner.hidden = true;
    acceptAll();
  });
  banner.querySelector("[data-wf-consent-decline]")?.addEventListener("click", () => {
    store("denied");
    banner.hidden = true;
  });
})();
