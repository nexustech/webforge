// A Header joined to the page's first section (HH-1). The page's --wf-header-h follows the
// Header's real height, which its place over the section and the section's room for it read:
// without the script, the CSS has an estimate for the Header's layout. It's measured at the top of
// the page only, so a Header that shrinks once scrolled leaves the section as it was. A Header with
// its own band over a first section that fills the window (HH-4, data-wf-height) is measured too.
//
// That section (data-wf-fills) is the window's height less what's above it (#1489): the page's
// --wf-above-h is where it starts, below the Header's band and any Announcement bar. It's measured
// again as the Header or a bar changes size, as when a bar is closed or hidden after its last day,
// whichever script runs first, and at the top of the page only, as the Header's height is.
//
// A joined Header that stays at the top takes the page's colours once the page has scrolled 80 px,
// as sticky.js marks it (data-scrolled). The section's reversed colours, which the Header has as
// its data-theme, come off then and come back at the top.
(() => {
  const THRESHOLD = 80;
  const root = document.documentElement;
  const headers = [...document.querySelectorAll("[data-wf-joined], [data-wf-height]")].filter(
    (header) => header instanceof HTMLElement,
  );
  const fills = document.querySelector("[data-wf-fills]");
  const anySticky = headers.some((header) => header.hasAttribute("data-wf-sticky"));
  const above = () => {
    if (!(fills instanceof HTMLElement) || (anySticky && window.scrollY > THRESHOLD)) return;
    const top = fills.getBoundingClientRect().top + window.scrollY;
    root.style.setProperty("--wf-above-h", `${Math.max(0, Math.round(top))}px`);
  };
  const watch = typeof ResizeObserver === "function" ? new ResizeObserver(() => above()) : null;
  for (const bar of document.querySelectorAll("[data-wf-announcement]")) watch?.observe(bar);
  for (const header of headers) {
    const theme = header.getAttribute("data-theme");
    const sticky = header.hasAttribute("data-wf-sticky");
    const atTop = () => !sticky || window.scrollY <= THRESHOLD;
    const measure = () => {
      if (atTop()) root.style.setProperty("--wf-header-h", `${header.offsetHeight}px`);
      above();
    };
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(measure).observe(header);
    }
    measure();
    if (!sticky) {
      continue;
    }
    const scrolled = () => {
      if (theme !== null) {
        if (atTop()) header.setAttribute("data-theme", theme);
        else header.removeAttribute("data-theme");
      }
      // Back at the top, as it may have changed size while scrolled (the window resized).
      measure();
    };
    window.addEventListener("scroll", scrolled, { passive: true });
    scrolled();
  }
  above();
})();
