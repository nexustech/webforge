// Tabs (2.11, WCAG 2.1 AA). Without the script every panel shows in turn under its label as a
// heading. The script follows WAI-ARIA's tabs pattern: a list of tabs made from the panels'
// labels (copies of the tabs' template button, so they're styled), one panel shown at a time.
// One tab is in the Tab order; Left and Right move between tabs (round past either end), Home and
// End to the first and last, and the tab moved to is shown at once. Each panel is labelled by its
// tab, and its own heading is hidden, as the tab says it.
(() => {
  for (const tabs of document.querySelectorAll("[data-wf-tabs]")) {
    const list = tabs.querySelector(":scope > [data-wf-tabs-list]");
    const template = tabs.querySelector(":scope > template[data-wf-tab-button]");
    if (!(list instanceof HTMLElement) || !(template instanceof HTMLTemplateElement)) continue;
    // This tabs' own panels, not those of tabs inside one.
    const panels = /** @type {HTMLElement[]} */ (
      [...tabs.querySelectorAll("[data-wf-tab]")].filter(
        (panel) => panel instanceof HTMLElement && panel.closest("[data-wf-tabs]") === tabs,
      )
    );
    const model = template.content.firstElementChild;
    if (panels.length === 0 || !(model instanceof HTMLElement)) continue;

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
        if (panel !== undefined) panel.hidden = !selected;
      });
      if (focus) buttons[index]?.focus();
    };

    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(index, false));
    });
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
  }
})();
