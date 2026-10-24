// Carousels (2.10, G9). Without the script a carousel is a strip of slides that swipes and scrolls
// by itself, its slides snapping into place. The script shows the previous and next buttons (which
// go round from the last slide to the first), moves with the arrow keys while the focus is in the
// carousel, names each slide "2 of 5" for screen readers and says which one shows after a move.
// One set to play automatically moves on every few seconds, with a button to stop it that comes
// first (WCAG 2.2.2); it pauses while the pointer or the focus is in it, and never plays when the
// visitor prefers reduced motion.
(() => {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

  for (const root of document.querySelectorAll("[data-wf-carousel]")) {
    const track = root.querySelector("[data-wf-carousel-track]");
    const controls = root.querySelector("[data-wf-carousel-controls]");
    const status = root.querySelector("[data-wf-carousel-status]");
    if (!(root instanceof HTMLElement) || !(track instanceof HTMLElement)) {
      continue;
    }
    const slides = [...track.children].filter((slide) => slide instanceof HTMLElement);
    const total = slides.length;
    /** "2 of 5", from the carousel's own wording. */
    const position = (/** @type {number} */ index) =>
      (root.dataset.slideOf ?? "{n} of {total}")
        .replace("{n}", String(index + 1))
        .replace("{total}", String(total));
    slides.forEach((slide, index) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", root.dataset.slideLabel ?? "slide");
      slide.setAttribute("aria-label", position(index));
    });
    if (total < 2) {
      continue;
    }
    if (controls instanceof HTMLElement) {
      controls.hidden = false;
    }

    let current = 0;
    /** The slide the script is scrolling to, and since when: its own scrolling moves nothing. */
    let aim = { index: -1, since: 0 };
    /** Scrolls to slide `index`, going round past either end; `announce` says so if asked. */
    const go = (/** @type {number} */ index, /** @type {boolean} */ announce) => {
      // Past the last slide that fits (several logos show at once), back to the first. A strip
      // that all fits has no end to reach.
      const atEnd =
        track.scrollWidth > track.clientWidth &&
        track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
      current = index >= total || (index > current && atEnd) ? 0 : (index + total) % total;
      const first = slides[0];
      const slide = slides[current];
      if (first !== undefined && slide !== undefined) {
        aim = { index: current, since: Date.now() };
        track.scrollTo({ left: slide.offsetLeft - first.offsetLeft, behavior: "smooth" });
      }
      root.dataset.current = String(current);
      if (announce && status !== null) {
        status.textContent = position(current);
      }
    };
    // A swipe or a scroll by hand moves the current slide too: the one nearest the start.
    track.addEventListener(
      "scroll",
      () => {
        const first = slides[0];
        if (first === undefined) return;
        const left = track.scrollLeft;
        let nearest = 0;
        slides.forEach((slide, index) => {
          const offset = slide.offsetLeft - first.offsetLeft;
          const best = (slides[nearest]?.offsetLeft ?? 0) - first.offsetLeft;
          if (Math.abs(offset - left) < Math.abs(best - left)) nearest = index;
        });
        // On its way to the slide it was sent to (for a second at most, as a swipe can stop it).
        if (aim.index !== -1 && Date.now() - aim.since < 1000) {
          if (nearest === aim.index) aim = { index: -1, since: 0 };
          return;
        }
        aim = { index: -1, since: 0 };
        current = nearest;
        root.dataset.current = String(current);
      },
      { passive: true },
    );
    root.querySelector("[data-wf-carousel-previous]")?.addEventListener("click", () => {
      go(current - 1, true);
    });
    root.querySelector("[data-wf-carousel-next]")?.addEventListener("click", () => {
      go(current + 1, true);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      go(current + (event.key === "ArrowLeft" ? -1 : 1), true);
    });

    const interval = Number(root.dataset.interval);
    const play = root.querySelector("[data-wf-carousel-play]");
    if (!(interval > 0) || !(play instanceof HTMLElement)) {
      continue;
    }
    /** Stopped by its button (or by reduced motion), not just paused while in use. */
    let stopped = reducedMotion;
    let hovered = false;
    let focused = false;
    /** @type {ReturnType<typeof setInterval> | undefined} */
    let timer;
    const update = () => {
      const playing = !stopped && !hovered && !focused;
      root.toggleAttribute("data-playing", !stopped);
      // Moves while playing aren't announced: they'd interrupt whatever is being read.
      status?.setAttribute("aria-live", playing ? "off" : "polite");
      play.setAttribute(
        "aria-label",
        (stopped ? play.dataset.labelStart : play.dataset.labelStop) ?? "",
      );
      if (playing && timer === undefined) {
        timer = setInterval(() => go(current + 1, false), interval);
      } else if (!playing && timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    play.addEventListener("click", () => {
      stopped = !stopped;
      // Started from its own button, it plays though the focus (and the pointer) is on it (APG).
      if (!stopped) {
        focused = false;
        hovered = false;
      }
      update();
    });
    root.addEventListener("mouseenter", () => {
      hovered = true;
      update();
    });
    root.addEventListener("mouseleave", () => {
      hovered = false;
      update();
    });
    root.addEventListener("focusin", () => {
      focused = true;
      update();
    });
    root.addEventListener("focusout", (event) => {
      focused = event.relatedTarget instanceof Node && root.contains(event.relatedTarget);
      update();
    });
    update();
  }
})();
