// A Header joined to the page's first section (HH-1). The page's --wf-header-h follows the
// Header's real height, which its place over the section and the section's room for it read:
// without the script, the CSS has an estimate for the Header's layout. It's measured at the top of
// the page only, so a Header that shrinks once scrolled leaves the section as it was.
//
// A joined Header that stays at the top takes the page's colours once the page has scrolled 80 px,
// as sticky.js marks it (data-scrolled). The section's reversed colours, which the Header has as
// its data-theme, come off then and come back at the top.
(() => {
  const THRESHOLD = 80;
  const root = document.documentElement;
  for (const header of document.querySelectorAll("[data-wf-joined]")) {
    if (!(header instanceof HTMLElement)) {
      continue;
    }
    const theme = header.getAttribute("data-theme");
    const sticky = header.hasAttribute("data-wf-sticky");
    const atTop = () => !sticky || window.scrollY <= THRESHOLD;
    const measure = () => {
      if (atTop()) root.style.setProperty("--wf-header-h", `${header.offsetHeight}px`);
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
})();
