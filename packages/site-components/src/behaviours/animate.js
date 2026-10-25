// Entrance animations (F-DS-5, G8). A section or element with an entrance has data-wf-entrance and
// classes that draw it hidden (faded, moved or shrunk) only once this script has marked the page
// with data-wf-animate and only until it has data-wf-shown. Without the script, in print, for
// search engines and for visitors who prefer less motion, everything shows as it is.
//
// The script runs after the page is first drawn (it is deferred), so what is already in view is
// marked shown before the page is marked: it never disappears to move in again. The rest moves in
// as it scrolls into view, once, as soon as any of it shows: then even the last line of a page
// comes in at the bottom. Once it has moved in, it gets data-wf-done, which ends its delay, so
// later changes to it don't wait.
//
// What is in view is measured once the site's stylesheet has loaded: a deferred script can run
// before it (WebKit does, reading a slow disk), when the page is drawn unstyled and short. If the
// stylesheet never loads, nothing is hidden.
(() => {
  const targets = [...document.querySelectorAll("[data-wf-entrance]")].filter(
    (target) => target instanceof HTMLElement,
  );
  if (targets.length === 0) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true) return;
  if (typeof IntersectionObserver !== "function") return;

  const start = () => {
    /** Shows `target`, moving it in if `moving`, else at once (in view as the page loads, printed). */
    const show = (/** @type {Element} */ target, /** @type {boolean} */ moving) => {
      const done = () => target.toggleAttribute("data-wf-done", true);
      if (moving) {
        target.addEventListener("transitionend", (event) => {
          if (event.target === target) done();
        });
        // In case no transition ends (the browser skipped it): its longest delay and run, and more.
        setTimeout(done, 2000);
      } else {
        done();
      }
      target.toggleAttribute("data-wf-shown", true);
    };
    const height = window.innerHeight || document.documentElement.clientHeight;
    const width = window.innerWidth || document.documentElement.clientWidth;
    const waiting = targets.filter((target) => {
      const rect = target.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width;
      if (inView) show(target, false);
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
          show(entry.target, true);
          observer.unobserve(entry.target);
        }
      },
      // As soon as any of it is in view: a margin into the view would leave what ends the page,
      // never that far up, hidden for good.
      { threshold: 0 },
    );
    for (const target of waiting) observer.observe(target);
    // Printed, the page shows everything.
    window.addEventListener("beforeprint", () => {
      for (const target of targets) show(target, false);
    });
  };

  const loading = [...document.querySelectorAll('link[rel="stylesheet"]')].filter(
    (link) => link instanceof HTMLLinkElement && link.sheet === null,
  );
  let unloaded = loading.length;
  if (unloaded === 0) start();
  for (const link of loading) {
    link.addEventListener("load", () => {
      unloaded -= 1;
      if (unloaded === 0) start();
    });
  }
})();
