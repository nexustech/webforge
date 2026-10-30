/* webforge.js: behaviours for this site's components. Classic script, no modules. */

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

// Back-to-top button (F-CM-9, 2.9b). Without the script it is a link to the top of the page, always
// there. With it, it shows once the visitor has scrolled a screen down, and takes them back to the
// top: smoothly, unless they prefer less motion. The page itself then takes the focus, so the next
// Tab starts again from the top and screen readers read on from there.
(() => {
  const button = document.querySelector("[data-wf-back-to-top]");
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const show = () => {
    button.hidden = window.scrollY < window.innerHeight;
  };
  button.addEventListener("click", (event) => {
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
  // The only addresses an embed may load: how each player's or map's starts (EMBED_SOURCES in
  // embed.ts; a test keeps them alike), so a changed page can't make this script load another
  // site, or another page of these.
  const SOURCES = [
    "https://www.youtube-nocookie.com/embed/",
    "https://player.vimeo.com/video/",
    "https://www.google.com/maps?",
    "https://www.openstreetmap.org/export/embed.html?",
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
    const href = url.href;
    if (!SOURCES.some((source) => href.startsWith(source))) {
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
    // Accepted with the rest, not asked for: a player or map below the fold waits until the
    // visitor scrolls to it, rather than all of them loading at once.
    if (!play) {
      frame.loading = "lazy";
    }
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

// Forms (3.7, B6): a spam check besides the honeypot. A robot that fills a page's form in sends it
// the moment the page opens; a person takes longer than a few seconds to type anything. A form
// sent sooner than that after the page opened is held, and sent once the few seconds are up: a
// browser that filled it in and sent it at once loses nothing, and the visitor is told it is being
// sent (the form's status line, read out by screen readers). Pressing Send again meanwhile sends it
// once. Without the script, forms send as they are (the honeypot still works).
(() => {
  const opened = Date.now();
  const SOONEST_MS = 3000;
  for (const form of document.querySelectorAll("form.site-form[action]")) {
    if (!(form instanceof HTMLFormElement)) continue;
    let held = false;
    form.addEventListener("submit", (event) => {
      const wait = SOONEST_MS - (Date.now() - opened);
      if (wait <= 0) return;
      event.preventDefault();
      if (held) return;
      held = true;
      const status = form.querySelector("[data-wf-form-status]");
      if (status instanceof HTMLElement) status.textContent = form.dataset.sending ?? "";
      setTimeout(() => {
        if (status instanceof HTMLElement) status.textContent = "";
        form.requestSubmit();
      }, wait);
    });
  }
})();

// Gallery lightboxes (2.7a, G10), and an Image's that opens larger (3.20), with its one picture.
// Without the script each image links to its full-size file. The script opens it large in the
// gallery's <dialog> instead, as a modal: the focus stays in it and the page behind is out of
// reach, Esc, its close button or a click beside it close it, and the focus goes back to the image
// clicked. The previous and next buttons, the arrow keys (Home and End for the first and last) and
// a swipe go through the gallery's images, round past either end; each move says which image shows
// ("3 of 8"). The large image has the image's own sources, as wide as the screen, so a phone loads
// a file its size; only the image shown is loaded.
(() => {
  /** A horizontal swipe at least this long, in CSS pixels, moves to the next or previous image. */
  const SWIPE = 50;

  for (const gallery of document.querySelectorAll("[data-wf-gallery]")) {
    const dialog = gallery.querySelector("dialog[data-wf-lightbox]");
    const image = gallery.querySelector("[data-wf-lightbox-image]");
    const picture = gallery.querySelector("[data-wf-lightbox-picture]");
    const caption = gallery.querySelector("[data-wf-lightbox-caption]");
    const status = gallery.querySelector("[data-wf-lightbox-status]");
    if (!(dialog instanceof HTMLDialogElement) || !(image instanceof HTMLImageElement)) {
      continue;
    }
    const items = [...gallery.querySelectorAll("a[data-wf-lightbox-item]")].filter(
      (item) => item instanceof HTMLAnchorElement,
    );
    const total = items.length;
    let current = 0;
    /** The image clicked, which gets the focus back when the lightbox closes. */
    /** @type {HTMLElement | null} */
    let opener = null;

    // With one image there's nowhere to go.
    for (const button of dialog.querySelectorAll(
      "[data-wf-lightbox-previous], [data-wf-lightbox-next]",
    )) {
      if (button instanceof HTMLElement) button.hidden = total < 2;
    }

    /** Shows image `index` (round past either end). */
    const show = (/** @type {number} */ index) => {
      current = (index + total) % total;
      const item = items[current];
      if (item === undefined) return;
      const thumbnail = item.querySelector("img");
      // The image's own sources (WebP, then JPEG or PNG), as wide as the screen.
      if (picture !== null) {
        for (const old of picture.querySelectorAll("source")) old.remove();
        for (const source of item.querySelectorAll("source")) {
          const copy = source.cloneNode();
          if (copy instanceof HTMLElement) copy.setAttribute("sizes", "100vw");
          picture.insertBefore(copy, image);
        }
      }
      image.srcset = thumbnail?.getAttribute("srcset") ?? "";
      image.sizes = "100vw";
      // The link as written: relative to the page, as the export writes every path.
      image.src = item.getAttribute("href") ?? item.href;
      image.alt = thumbnail?.alt ?? "";
      if (caption !== null) {
        // The image's own caption, not the lightbox's inside an Image's figure (3.20).
        caption.textContent =
          item.closest("figure")?.querySelector(":scope > figcaption")?.textContent ?? "";
      }
      if (status !== null) {
        status.textContent = (dialog.dataset.imageOf ?? "{n} of {total}")
          .replace("{n}", String(current + 1))
          .replace("{total}", String(total));
      }
    };

    items.forEach((item, index) => {
      item.addEventListener("click", (event) => {
        // A click with a modifier opens the file in a new tab or window, as a link does.
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        opener = item;
        show(index);
        if (!dialog.open) dialog.showModal();
      });
    });
    dialog.querySelector("[data-wf-lightbox-previous]")?.addEventListener("click", () => {
      show(current - 1);
    });
    dialog.querySelector("[data-wf-lightbox-next]")?.addEventListener("click", () => {
      show(current + 1);
    });
    /** Where each key goes from image `from`. */
    /** @type {Readonly<Record<string, (from: number) => number>>} */
    const KEYS = {
      ArrowLeft: (from) => from - 1,
      ArrowRight: (from) => from + 1,
      Home: () => 0,
      End: () => total - 1,
    };
    // On the document: after a click Safari leaves the focus on the page, not in the dialog.
    document.addEventListener("keydown", (event) => {
      const to = KEYS[event.key];
      if (!dialog.open || to === undefined) return;
      // With a modifier the keys are the browser's or the system's (Alt+Left goes back).
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      show(to(current));
    });

    // A swipe on a touch screen (or a drag with a pen): left for the next image, right for the
    // previous.
    let start = Number.NaN;
    dialog.addEventListener("pointerdown", (event) => {
      start = event.pointerType === "mouse" ? Number.NaN : event.clientX;
    });
    dialog.addEventListener("pointerup", (event) => {
      const distance = event.clientX - start;
      start = Number.NaN;
      if (Math.abs(distance) >= SWIPE) show(current + (distance < 0 ? 1 : -1));
    });

    dialog.addEventListener("close", () => {
      image.removeAttribute("src");
      image.removeAttribute("srcset");
      opener?.focus();
      opener = null;
    });
  }
})();

// The Header's menu on small screens, and the dropdowns in its navigation: each a <details>, which
// opens and closes with its <summary> without the script too (and with a tap on iOS), and which
// screen readers announce as expanded or collapsed. The script adds what <details> doesn't do:
// one dropdown open at a time; a click outside closes them, as does focus moving on past a
// dropdown and choosing a link in the menu; Escape closes the innermost one open around the focus
// (a dropdown before its menu) and gives its <summary> the focus back.
(() => {
  /** @type {HTMLDetailsElement[]} */
  const menus = [...document.querySelectorAll("details[data-wf-menu]")].filter(
    (element) => element instanceof HTMLDetailsElement,
  );
  /** @type {HTMLDetailsElement[]} */
  const dropdowns = [...document.querySelectorAll("details[data-wf-dropdown]")].filter(
    (element) => element instanceof HTMLDetailsElement,
  );

  for (const dropdown of dropdowns) {
    dropdown.addEventListener("toggle", () => {
      if (!dropdown.open) return;
      for (const other of dropdowns) {
        if (other !== dropdown) other.open = false;
      }
    });
    // Tabbing on past its links closes it, so it doesn't stay drawn over the page.
    dropdown.addEventListener("focusout", (event) => {
      if (!(event.relatedTarget instanceof Node && dropdown.contains(event.relatedTarget))) {
        dropdown.open = false;
      }
    });
  }
  for (const menu of menus) {
    menu.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a") !== null) {
        menu.open = false;
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    // Only while the focus is in one (or nowhere): Escape elsewhere is someone else's.
    const focus = document.activeElement;
    const nowhere = focus === null || focus === document.body;
    // In document order, a dropdown comes after the menu it is in: the last one is innermost.
    const open = [...menus, ...dropdowns]
      .filter((details) => details.open && (nowhere || details.contains(focus)))
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const innermost = open.at(-1);
    if (innermost === undefined) return;
    event.preventDefault();
    innermost.open = false;
    innermost.querySelector("summary")?.focus();
  });

  document.addEventListener("click", (event) => {
    for (const details of [...menus, ...dropdowns]) {
      if (details.open && !(event.target instanceof Node && details.contains(event.target))) {
        details.open = false;
      }
    }
  });
})();

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

// Tabs (2.11, WCAG 2.1 AA). Without the script every panel shows in turn under its label as a
// heading. The script follows WAI-ARIA's tabs pattern: a list of tabs made from the panels'
// labels (copies of the tabs' template button, so they're styled), one panel shown at a time.
// One tab is in the Tab order; Left and Right move between tabs (round past either end), Home and
// End to the first and last, and the tab moved to is shown at once. Each panel is labelled by its
// tab, and its own heading is hidden, as the tab says it.
//
// What's in a panel not shown can still be reached: a panel not chosen is hidden "until found",
// so the browser's find-in-page (where it supports it) shows it and its tab is chosen, and a link
// to something in it (the page opened at #anchor, or a menu link) chooses its tab and scrolls to
// it.
(() => {
  /** The page's #anchor, decoded: as it is when it isn't encoded right ("#100%"). */
  const hashId = () => {
    const hash = window.location.hash.slice(1);
    try {
      return decodeURIComponent(hash);
    } catch {
      return hash;
    }
  };

  /** Makes `tabs` a tab list with its panels. */
  const setUp = (/** @type {Element} */ tabs) => {
    const list = tabs.querySelector(":scope > [data-wf-tabs-list]");
    const template = tabs.querySelector(":scope > template[data-wf-tab-button]");
    if (!(list instanceof HTMLElement) || !(template instanceof HTMLTemplateElement)) return;
    // This tabs' own panels, not those of tabs inside one.
    const panels = /** @type {HTMLElement[]} */ (
      [...tabs.querySelectorAll("[data-wf-tab]")].filter(
        (panel) => panel instanceof HTMLElement && panel.closest("[data-wf-tabs]") === tabs,
      )
    );
    const model = template.content.firstElementChild;
    if (panels.length === 0 || !(model instanceof HTMLElement)) return;

    const buttons = panels.map((panel, index) => {
      const heading = panel.querySelector(":scope > [data-wf-tab-label]");
      const button = /** @type {HTMLElement} */ (model.cloneNode(true));
      button.textContent = heading?.textContent?.trim() || String(index + 1);
      if (panel.id === "") panel.id = `wf-tab-${index}`;
      button.id = `${panel.id}-tab`;
      button.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      // A panel without anything to focus in it can be reached from its tab.
      panel.tabIndex = 0;
      if (heading instanceof HTMLElement) heading.hidden = true;
      list.append(button);
      return button;
    });

    /** Shows panel `index`, its tab selected and the one in the Tab order. */
    const select = (/** @type {number} */ index, /** @type {boolean} */ focus) => {
      buttons.forEach((button, each) => {
        const selected = each === index;
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
        button.classList.toggle("tab-active", selected);
        const panel = panels[each];
        if (panel === undefined) return;
        // Browsers without "until-found" hide it as they would any hidden element.
        if (selected) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "until-found");
      });
      if (focus) buttons[index]?.focus();
    };

    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(index, false));
    });
    // Found by find-in-page in a panel not chosen: its tab is chosen as the browser shows it.
    panels.forEach((panel, index) => {
      panel.addEventListener("beforematch", () => select(index, false));
    });
    /** Chooses the tab of the panel holding the page's #anchor, if one does, and scrolls to it. */
    const followHash = () => {
      const id = hashId();
      const target = id === "" ? null : document.getElementById(id);
      const index = target === null ? -1 : panels.findIndex((panel) => panel.contains(target));
      if (target === null || index < 0) return;
      select(index, false);
      target.scrollIntoView();
    };
    window.addEventListener("hashchange", followHash);
    /** Where each key goes from tab `from`. */
    /** @type {Readonly<Record<string, (from: number) => number>>} */
    const KEYS = {
      ArrowLeft: (from) => (from - 1 + buttons.length) % buttons.length,
      ArrowRight: (from) => (from + 1) % buttons.length,
      Home: () => 0,
      End: () => buttons.length - 1,
    };
    list.addEventListener("keydown", (event) => {
      const to = KEYS[event.key];
      const from = buttons.indexOf(/** @type {HTMLElement} */ (event.target));
      if (to === undefined || from < 0) return;
      // With a modifier the keys are the browser's or the system's (Alt+Left goes back).
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      select(to(from), true);
    });

    list.hidden = false;
    select(0, false);
    followHash();
  };

  for (const tabs of document.querySelectorAll("[data-wf-tabs]")) {
    // One Tabs that goes wrong leaves the others working, every panel shown as without the script.
    try {
      setUp(tabs);
    } catch {}
  }
})();

