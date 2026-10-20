/* webforge.js: behaviours for this site's components. Classic script, no modules. */

// Header menu on small screens: the toggle button opens and closes the navigation list.
// Sets aria-expanded on the button and data-open on the list (the CSS shows the list when it is
// set). Escape closes the menu and returns focus to the button; choosing a link closes it.
(() => {
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

