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
