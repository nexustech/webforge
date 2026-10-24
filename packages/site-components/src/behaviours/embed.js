// Click-to-load embeds (F-CM-4, B7, C8): a video or map from another site loads only when the
// visitor asks. Until then the page shows a placeholder and asks nothing of YouTube, Vimeo or the
// map's site; the click is the visitor's consent for that one embed. This script shows each
// placeholder's button and, on a click, puts the player or map in its place. Without it, the
// placeholder's link opens the video or map on its own site.
//
// A visitor who accepted everything in the consent banner (B7, 3.8) gets every embed at once. The
// banner marks the page with data-wf-consent-all on <html> (for a visitor who accepted before)
// and fires "webforge:consent-all" on the document when they accept now.
(() => {
  // The only sites an embed may load from (EMBED_HOSTS in embed.ts; a test keeps them alike), so
  // a changed page can't make this script load another one.
  const HOSTS = [
    "www.youtube-nocookie.com",
    "player.vimeo.com",
    "www.google.com",
    "www.openstreetmap.org",
  ];
  const PLAYERS = ["www.youtube-nocookie.com", "player.vimeo.com"];

  /**
   * @param {HTMLElement} embed
   * @param {boolean} play Whether the visitor pressed play, rather than accepted all embeds.
   */
  const load = (embed, play) => {
    const placeholder = embed.querySelector("[data-wf-embed-placeholder]");
    if (placeholder === null) {
      return;
    }
    let url;
    try {
      url = new URL(embed.dataset.src ?? "");
    } catch {
      return;
    }
    if (url.protocol !== "https:" || !HOSTS.includes(url.hostname)) {
      return;
    }
    // The visitor pressed play: start it, rather than ask for a second click.
    if (play && PLAYERS.includes(url.hostname)) {
      url.searchParams.set("autoplay", "1");
    }
    const frame = document.createElement("iframe");
    frame.src = url.href;
    frame.title = embed.dataset.title ?? "";
    frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    frame.allowFullscreen = true;
    // YouTube's player needs to know which site embeds it; nothing more of the address is sent.
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    // Inline: the site's stylesheet holds only the classes its pages use.
    frame.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0";
    placeholder.replaceWith(frame);
    embed.toggleAttribute("data-loaded", true);
    if (play) {
      frame.focus();
    }
  };

  const embeds = [...document.querySelectorAll("[data-wf-embed]")].filter(
    (embed) => embed instanceof HTMLElement,
  );
  const loadAll = () => {
    for (const embed of embeds) {
      load(/** @type {HTMLElement} */ (embed), false);
    }
  };

  for (const embed of embeds) {
    const controls = embed.querySelector("[data-wf-embed-controls]");
    const button = embed.querySelector("[data-wf-embed-load]");
    if (!(controls instanceof HTMLElement) || button === null) {
      continue;
    }
    controls.hidden = false;
    button.addEventListener("click", () => load(/** @type {HTMLElement} */ (embed), true));
  }

  document.addEventListener("webforge:consent-all", loadAll);
  if (document.documentElement.hasAttribute("data-wf-consent-all")) {
    loadAll();
  }
})();
