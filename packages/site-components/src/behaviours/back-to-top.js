// Back-to-top button (F-CM-9, 2.9b). Without the script it is a link to the top of the page, always
// there. With it, it shows once the visitor has scrolled a screen down, and takes them back to the
// top: smoothly, unless they prefer less motion. The page itself then takes the focus, so the next
// Tab starts again from the top and screen readers read on from there. It shows and hides the
// button's nav, its landmark, with it.
(() => {
  const nav = document.querySelector("[data-wf-back-to-top]");
  if (!(nav instanceof HTMLElement)) {
    return;
  }
  const show = () => {
    nav.hidden = window.scrollY < window.innerHeight;
  };
  nav.addEventListener("click", (event) => {
    event.preventDefault();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    const page = document.body;
    page.tabIndex = -1;
    page.focus({ preventScroll: true });
    page.addEventListener("blur", () => page.removeAttribute("tabindex"), { once: true });
  });
  window.addEventListener("scroll", show, { passive: true });
  show();
})();
