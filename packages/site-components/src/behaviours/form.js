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
