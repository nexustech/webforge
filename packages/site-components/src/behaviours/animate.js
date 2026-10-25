// Entrance animations (F-DS-5, G8). A section or element with an entrance has data-wf-entrance and
// classes that draw it hidden (faded, moved or shrunk) only once this script has marked the page
// with data-wf-animate and only until it has data-wf-shown. Without the script, in print, for
// search engines and for visitors who prefer less motion, everything shows as it is.
//
// The script runs after the page is first drawn (it is deferred), so what is already in view is
// marked shown before the page is marked: it never disappears to move in again. The rest moves in
// as it scrolls into view, once.
(() => {
  const targets = [...document.querySelectorAll("[data-wf-entrance]")].filter(
    (target) => target instanceof HTMLElement,
  );
  if (targets.length === 0) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true) return;
  if (typeof IntersectionObserver !== "function") return;

  const show = (/** @type {Element} */ target) => target.toggleAttribute("data-wf-shown", true);
  const height = window.innerHeight || document.documentElement.clientHeight;
  const width = window.innerWidth || document.documentElement.clientWidth;
  const waiting = targets.filter((target) => {
    const rect = target.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
    if (inView) show(target);
    return !inView;
  });

  const root = document.documentElement;
  // An element sliding in from the side mustn't widen the page while it waits. `clip`, unlike
  // `hidden`, makes no scroll container, so the sticky header still sticks.
  root.style.overflowX = "clip";
  root.toggleAttribute("data-wf-animate", true);

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        show(entry.target);
        observer.unobserve(entry.target);
      }
    },
    // A little way into the view, so it is seen moving in.
    { rootMargin: "0px 0px -10% 0px" },
  );
  for (const target of waiting) observer.observe(target);
  // Printed, the page shows everything.
  window.addEventListener("beforeprint", () => {
    for (const target of targets) show(target);
  });
})();
