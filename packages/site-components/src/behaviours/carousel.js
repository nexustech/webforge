// Carousels (2.10, G9). Without the script a carousel is a strip of slides that swipes and scrolls
// by itself, its slides snapping into place. The script shows the previous and next buttons (which
// go round from the last slide to the first), moves with the arrow keys while the focus is in the
// carousel, names each slide "2 of 5" for screen readers and says which one shows after a move.
// Where several slides show at once (logos), the buttons move by what's in view, the last page
// full rather than one logo alone, and say which slides show ("5 to 8 of 10").
// One set to play automatically moves on every few seconds, with a button to stop it that comes
// first (WCAG 2.2.2); it pauses while the pointer or the focus is in it, and never plays when the
// visitor prefers reduced motion.
(() => {
  /** How long the strip goes without scrolling before it counts as at rest, in ms. */
  const REST = 150;
  /**
   * How long a move's scroll may take to get where it's going, in ms. After that the strip is put
   * back where the current slide starts, if it isn't there (a resize moved the slides, or WebKit
   * dropped a smooth scroll that another interrupted), and its rests count again. WebKit took over
   * a second for one slide on a busy machine.
   */
  const ARRIVE = 3000;
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
    /** How many slides show at once: one, or several logos. */
    const inView = () => {
      const [first, second] = slides;
      if (first === undefined || second === undefined) return 1;
      const step = second.offsetLeft - first.offsetLeft;
      const gap = step - first.offsetWidth;
      return step > 0 ? Math.max(1, Math.round((track.clientWidth + gap) / step)) : 1;
    };
    /**
     * What shows from slide `index`: "2 of 5", or "5 to 8 of 10" when several do; from the last
     * place the strip can stop, everything to the end.
     */
    const showing = (/** @type {number} */ index, /** @type {boolean} */ atEnd) => {
      const count = inView();
      if (count === 1) return position(index);
      return (root.dataset.slidesOf ?? "{from} to {to} of {total}")
        .replace("{from}", String(index + 1))
        .replace("{to}", String(atEnd ? total : Math.min(index + count, total)))
        .replace("{total}", String(total));
    };
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

    /**
     * The last slide a move can start at: the last whose place the strip can scroll to, so the
     * last page is full (several logos at once). Every slide when the strip can't tell (no layout).
     */
    const lastStart = () => {
      const first = slides[0];
      if (first === undefined) return 0;
      const furthest = track.scrollWidth - track.clientWidth;
      let last = 0;
      slides.forEach((slide, index) => {
        if (slide.offsetLeft - first.offsetLeft <= furthest + 1) last = index;
      });
      return furthest <= 0 && track.scrollWidth === 0 ? total - 1 : last;
    };

    let current = 0;
    /** Set while the strip is scrolling: it then says where it came to rest (see below). */
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let resting;
    /**
     * Where a move is scrolling the strip to, until it gets there, is scrolled by hand, or has had
     * `ARRIVE` ms to get there.
     */
    /** @type {number | null} */
    let heading = null;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let arriving;
    /**
     * Moves `pages` pages of what's in view on (back if negative): the last page full, and round
     * past either end. `announce` says what shows if asked.
     */
    const move = (/** @type {number} */ pages, /** @type {boolean} */ announce) => {
      const count = inView();
      const last = lastStart();
      let target = current + pages * count;
      if (target > last) target = current >= last ? 0 : last;
      if (target < 0) target = current <= 0 ? last : 0;
      current = target;
      // A scroll before this move may still be about to say where it rested: this move decides.
      clearTimeout(resting);
      const first = slides[0];
      const slide = slides[current];
      if (first !== undefined && slide !== undefined) {
        // The strip's CSS sets how: smoothly, or at once for a visitor who prefers less motion.
        const left = slide.offsetLeft - first.offsetLeft;
        // Already there (logos that all fit, say), it doesn't scroll, so nothing would arrive.
        heading = Math.abs(left - track.scrollLeft) > 1 ? left : null;
        clearTimeout(arriving);
        if (heading !== null) {
          arriving = setTimeout(() => {
            heading = null;
            const start = (slides[current]?.offsetLeft ?? 0) - first.offsetLeft;
            if (Math.abs(track.scrollLeft - start) > 1) track.scrollTo({ left: start });
          }, ARRIVE);
        }
        track.scrollTo({ left });
      }
      root.dataset.current = String(current);
      if (announce && status !== null) {
        status.textContent = showing(current, current === last);
      }
    };
    // A swipe or a scroll by hand moves the current slide too: the one nearest the start, once the
    // strip has come to rest. Not while it moves: a smooth scroll the buttons started may still be
    // passing other slides, as a quick run of presses would leave it (in Firefox, #330), and the
    // buttons' own moves already say where it is going. Nor on the way to where a move sends it:
    // WebKit fires a smooth scroll's events far apart, so a pause in them isn't a rest (#334).
    track.addEventListener(
      "scroll",
      () => {
        clearTimeout(resting);
        resting = setTimeout(() => {
          const first = slides[0];
          if (first === undefined) return;
          const left = track.scrollLeft;
          if (heading !== null) {
            // Arrived, the current slide is the move's already.
            if (Math.abs(left - heading) <= 1) heading = null;
            return;
          }
          let nearest = 0;
          slides.forEach((slide, index) => {
            const offset = slide.offsetLeft - first.offsetLeft;
            const best = (slides[nearest]?.offsetLeft ?? 0) - first.offsetLeft;
            if (Math.abs(offset - left) < Math.abs(best - left)) nearest = index;
          });
          current = nearest;
          root.dataset.current = String(current);
        }, REST);
      },
      { passive: true },
    );
    // Scrolled by hand (a swipe, the wheel, the scroll bar, the keyboard, or the focus moving to a
    // slide's link), the strip goes where it's taken, not where the last move was sending it.
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown", "focusin"]) {
      track.addEventListener(
        type,
        () => {
          heading = null;
        },
        { passive: true },
      );
    }
    root.querySelector("[data-wf-carousel-previous]")?.addEventListener("click", () => {
      move(-1, true);
    });
    root.querySelector("[data-wf-carousel-next]")?.addEventListener("click", () => {
      move(1, true);
    });
    root.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // With a modifier the keys are the browser's or the system's (Alt+Left goes back).
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      move(event.key === "ArrowLeft" ? -1 : 1, true);
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
        timer = setInterval(() => move(1, false), interval);
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
