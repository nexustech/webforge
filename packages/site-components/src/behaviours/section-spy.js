// Section in view (5.10, GA10): on a page whose menu links to its own sections, as a one-page site's
// does, the menu shows where the visitor is. The link to the section in view gets
// aria-current="location", which the menu draws as it draws the current page's link, in the row on
// wide screens and in the menu on small ones; a dropdown holding it looks current too.
//
// A section is in view once its top has passed a line just under the header: the page's scroll
// padding, which a sticky Header sets, so it is where a jump from the menu brings that section. At
// the bottom of the page the last section is, even one too short to reach the line. Links to the
// page itself (aria-current="page") are left as they are. Without the script, or without
// IntersectionObserver, nothing is marked.
(() => {
  if (typeof IntersectionObserver !== "function") {
    return;
  }
  /** `url` without its hash, the same however the page's file is named: `/`, `index.html`, `.html`. */
  const pageOf = (/** @type {URL} */ url) => {
    const path = url.pathname.replace(/(?:^|\/)index\.html$/, "/").replace(/\.html$/, "");
    return `${url.origin === "null" ? url.protocol : url.origin}${path}${url.search}`;
  };
  const here = pageOf(new URL(window.location.href));

  /**
   * The menu's links to each section of this page, by section.
   * @type {Map<Element, HTMLAnchorElement[]>}
   */
  const links = new Map();
  for (const link of document.querySelectorAll(".site-header nav a[href*='#']")) {
    if (!(link instanceof HTMLAnchorElement) || link.getAttribute("aria-current") === "page") {
      continue;
    }
    const url = new URL(link.href, window.location.href);
    if (url.hash.length < 2 || pageOf(url) !== here) {
      continue;
    }
    const section = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (section === null) {
      continue;
    }
    links.set(section, [...(links.get(section) ?? []), link]);
  }
  if (links.size === 0) {
    return;
  }
  const sections = [...links.keys()].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );

  /**
   * The sections across the line under the header, as the observer last said.
   * @type {Set<Element>}
   */
  const crossing = new Set();
  /**
   * The section marked now, if any.
   * @type {Element | undefined}
   */
  let marked;
  const mark = (/** @type {Element | undefined} */ section) => {
    if (section === marked) {
      return;
    }
    for (const link of (marked && links.get(marked)) ?? []) link.removeAttribute("aria-current");
    for (const link of (section && links.get(section)) ?? []) {
      link.setAttribute("aria-current", "location");
    }
    marked = section;
  };
  /** Where the line under the header is, from the top of the window. */
  const lineAt = () =>
    Number.parseFloat(window.getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const update = () => {
    const root = document.documentElement;
    const bottom = window.innerHeight + window.scrollY >= root.scrollHeight - 2;
    if (bottom && window.scrollY > 0) {
      mark(sections.at(-1));
      return;
    }
    // The last of them in the page's order: a short section inside a taller one is the nearer.
    const across = sections.filter((section) => crossing.has(section));
    if (across.length > 0) {
      mark(across.at(-1));
    } else if (sections[0] !== undefined && sections[0].getBoundingClientRect().top > lineAt()) {
      // Above the first section (the page's top), nothing is in view yet.
      mark(undefined);
    }
  };

  /** @type {IntersectionObserver | undefined} */
  let observer;
  const watch = () => {
    observer?.disconnect();
    crossing.clear();
    const line = Math.round(lineAt());
    // A band one pixel tall at the line: the sections across it.
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target);
          else crossing.delete(entry.target);
        }
        update();
      },
      { rootMargin: `-${line}px 0px -${Math.max(0, window.innerHeight - line - 1)}px 0px` },
    );
    for (const section of sections) observer.observe(section);
  };
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", watch);
  // A sticky header that shrinks moves the line (sticky.js sets the scroll padding).
  const header = document.querySelector(".site-header");
  if (header !== null && typeof ResizeObserver === "function") {
    new ResizeObserver(() => watch()).observe(header);
  }
  watch();
})();
