/* webforge.js: behaviours for this site's components. Classic script, no modules. */

// Gallery lightboxes (2.7a, G10). Without the script each image links to its full-size file. The
// script opens it large in the gallery's <dialog> instead, as a modal: the focus stays in it and
// the page behind is out of reach, Esc and its close button close it, and the focus goes back to
// the image clicked. The previous and next buttons, the arrow keys and a swipe go through the
// gallery's images, round past either end; each move says which image shows ("3 of 8").
(() => {
  /** A horizontal swipe at least this long, in CSS pixels, moves to the next or previous image. */
  const SWIPE = 50;

  for (const gallery of document.querySelectorAll("[data-wf-gallery]")) {
    const dialog = gallery.querySelector("dialog[data-wf-lightbox]");
    const image = gallery.querySelector("[data-wf-lightbox-image]");
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
      // The link as written: relative to the page, as the export writes every path.
      image.src = item.getAttribute("href") ?? item.href;
      image.alt = thumbnail?.alt ?? "";
      if (caption !== null) {
        caption.textContent =
          item.closest("figure")?.querySelector("figcaption")?.textContent ?? "";
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
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      show(current + (event.key === "ArrowLeft" ? -1 : 1));
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

