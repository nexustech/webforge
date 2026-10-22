/* webforge.js: behaviours for this site's components. Classic script, no modules. */

// Header menu on small screens: the toggle button opens and closes the navigation list.
// Sets aria-expanded on the button and data-open on the list (the CSS shows the list when it is
// set). Escape closes the menu and returns focus to the button; choosing a link closes it.
// Dropdowns work the same way inside it: their button opens their list, Escape closes the
// dropdown first, as does a click outside it, and opening one closes the others.
(() => {
  const dropdowns = [];
  for (const toggle of document.querySelectorAll("[data-wf-submenu-toggle]")) {
    const list = document.getElementById(toggle.getAttribute("aria-controls") || "");
    const item = toggle.closest("li");
    if (list === null || item === null) {
      continue;
    }
    // From here on the script opens the dropdown, not the CSS fallback for focus.
    item.setAttribute("data-wf-ready", "");
    const dropdown = {
      item,
      toggle,
      isOpen: () => toggle.getAttribute("aria-expanded") === "true",
      setOpen: (open) => {
        toggle.setAttribute("aria-expanded", String(open));
        list.toggleAttribute("data-open", open);
      },
    };
    dropdowns.push(dropdown);
    // Tabbing on past its links closes it, so it doesn't stay drawn over the page.
    item.addEventListener("focusout", (event) => {
      if (!(event.relatedTarget instanceof Node && item.contains(event.relatedTarget))) {
        dropdown.setOpen(false);
      }
    });
    toggle.addEventListener("click", () => {
      const open = !dropdown.isOpen();
      for (const other of dropdowns) {
        if (other !== dropdown) other.setOpen(false);
      }
      dropdown.setOpen(open);
    });
  }
  // Before the menu's own Escape (capture), so Escape closes an open dropdown first.
  document.addEventListener(
    "keydown",
    (event) => {
      const open = dropdowns.find((dropdown) => dropdown.isOpen());
      // Only while focus is in the dropdown (or nowhere): Escape elsewhere is someone else's.
      const focus = document.activeElement;
      const here =
        open !== undefined &&
        (focus === null || focus === document.body || open.item.contains(focus));
      if (event.key === "Escape" && open !== undefined && here) {
        event.preventDefault();
        event.stopPropagation();
        open.setOpen(false);
        open.toggle.focus();
      }
    },
    true,
  );
  document.addEventListener("click", (event) => {
    for (const dropdown of dropdowns) {
      if (
        dropdown.isOpen() &&
        !(event.target instanceof Node && dropdown.item.contains(event.target))
      ) {
        dropdown.setOpen(false);
      }
    }
  });

  for (const toggle of document.querySelectorAll("[data-wf-menu-toggle]")) {
    const menu = document.getElementById(toggle.getAttribute("aria-controls") || "");
    if (menu === null) {
      continue;
    }
    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      menu.toggleAttribute("data-open", open);
    };
    toggle.addEventListener("click", () => setOpen(!isOpen()));
    menu.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a") !== null) {
        setOpen(false);
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });
  }
})();

