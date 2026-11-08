// Gallery lightboxes (2.7a, G10), and the single-picture lightbox a page's Images that open larger
// share (3.20, #646). Without the script each image links to its full-size file. The script opens
// it large in its <dialog> instead, as a modal: the focus stays in it and the page behind is out of
// reach, Esc, its close button or a click beside it close it, and the focus goes back to the image
// clicked. In a gallery, the previous and next buttons, the arrow keys (Home and End for the first
// and last) and a swipe go through its images, round past either end; each move says which image
// shows ("3 of 8"). The single-picture lightbox has one picture at a time, so it has none of them.
// The large image has the image's own sources, as wide as the screen, so a phone loads a file its
// size; only the image shown is loaded.
(() => {
  /** A horizontal swipe at least this long, in CSS pixels, moves to the next or previous image. */
  const SWIPE = 50;

  /**
   * Opens `items` large in `dialog`. `gallery` says whether they're a gallery's, to go through;
   * otherwise each opens alone, with its own caption.
   */
  const lightbox = (
    /** @type {HTMLDialogElement} */ dialog,
    /** @type {readonly HTMLAnchorElement[]} */ items,
    /** @type {boolean} */ gallery,
  ) => {
    const image = dialog.querySelector("[data-wf-lightbox-image]");
    const picture = dialog.querySelector("[data-wf-lightbox-picture]");
    const caption = dialog.querySelector("[data-wf-lightbox-caption]");
    const status = dialog.querySelector("[data-wf-lightbox-status]");
    if (!(image instanceof HTMLImageElement)) return;
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
        // The image's own caption: its figure's, not one inside a lightbox (3.20).
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

    dialog.addEventListener("close", () => {
      image.removeAttribute("src");
      image.removeAttribute("srcset");
      opener?.focus();
      opener = null;
    });

    // One picture at a time: nothing to go through, so the keys and a swipe stay the page's
    // (#646), rather than showing the same picture again.
    if (!gallery) return;

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
  };

  /** The image links in `root`, as anchors. */
  const linksIn = (/** @type {ParentNode} */ root, /** @type {string} */ selector) =>
    [...root.querySelectorAll(selector)].filter((item) => item instanceof HTMLAnchorElement);

  for (const gallery of document.querySelectorAll("[data-wf-gallery]")) {
    const dialog = gallery.querySelector("dialog[data-wf-lightbox]");
    if (dialog instanceof HTMLDialogElement) {
      lightbox(dialog, linksIn(gallery, "a[data-wf-lightbox-item]"), true);
    }
  }

  // The page's Images that open larger, each alone in the lightbox they share: a click shows its
  // own picture and caption, and nothing goes from one to the next.
  const single = document.querySelector("dialog[data-wf-lightbox-single]");
  if (single instanceof HTMLDialogElement) {
    lightbox(single, linksIn(document, "[data-wf-enlarge] a[data-wf-lightbox-item]"), false);
  }
})();
