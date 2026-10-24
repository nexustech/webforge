// Sticky header (F-DS-6): once the page has scrolled 80 px, the header gets data-scrolled, which
// its scroll style shows (shrink, a solid background, a shadow). Anchor targets aren't hidden under
// it: the page's scroll padding follows the header's height as it changes. Without the script the
// header is simply sticky, and its own class gives the page a fixed scroll padding.
(() => {
  const THRESHOLD = 80;
  for (const header of document.querySelectorAll("[data-wf-sticky]")) {
    if (!(header instanceof HTMLElement)) {
      continue;
    }
    const root = document.documentElement;
    const scrolled = () => {
      header.toggleAttribute("data-scrolled", window.scrollY > THRESHOLD);
    };
    const pad = () => {
      root.style.scrollPaddingTop = `${header.offsetHeight}px`;
    };
    window.addEventListener("scroll", scrolled, { passive: true });
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(pad).observe(header);
    }
    scrolled();
    pad();
  }
})();
