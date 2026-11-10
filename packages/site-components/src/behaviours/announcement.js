// The Announcement bar (6.4, G19). Without the script the bar is always there and has no close
// button. With it, the bar isn't shown after its last day (`data-last-day`, `YYYY-MM-DD`, in the
// visitor's own time zone), and its close button shows: closing it hides the bar for the rest of
// the visit, on every page, until its text changes. The choice is kept in this tab only
// (sessionStorage); a browser that keeps nothing asks again on each page. The page itself then
// takes the focus, so the next Tab starts from the top of what's left.
(() => {
  const KEY = "webforge-announcement-closed";
  /** Today in the visitor's time zone, as the bar's last day is written. */
  const today = () => {
    const now = new Date();
    const two = (/** @type {number} */ value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  };
  const closed = () => {
    try {
      return window.sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  };
  /** @param {string} text */
  const remember = (text) => {
    try {
      window.sessionStorage.setItem(KEY, text);
    } catch {
      // Nothing to keep it in: it stays closed on this page.
    }
  };

  for (const bar of document.querySelectorAll("[data-wf-announcement]")) {
    if (!(bar instanceof HTMLElement)) continue;
    const text = (bar.textContent ?? "").trim();
    const lastDay = bar.dataset.lastDay ?? "";
    if ((/^\d{4}-\d{2}-\d{2}$/.test(lastDay) && today() > lastDay) || closed() === text) {
      bar.hidden = true;
      continue;
    }
    const close = bar.querySelector("[data-wf-announcement-close]");
    if (!(close instanceof HTMLElement)) continue;
    close.hidden = false;
    close.addEventListener("click", () => {
      remember(text);
      bar.hidden = true;
      const page = document.body;
      page.tabIndex = -1;
      page.focus({ preventScroll: true });
      page.addEventListener("blur", () => page.removeAttribute("tabindex"), { once: true });
    });
  }
})();
