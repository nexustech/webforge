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
