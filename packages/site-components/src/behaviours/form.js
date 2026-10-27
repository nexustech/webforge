// Forms (3.7, B6): a spam check besides the honeypot. A robot that fills a page's form in sends it
// the moment the page opens; a person takes longer than a few seconds to type anything. A form
// sent sooner than that after the page opened isn't sent: the robot's message goes nowhere, and a
// person who somehow got there first can press the button again. Without the script, forms send
// as they are (the honeypot still works).
(() => {
  const opened = Date.now();
  const SOONEST_MS = 3000;
  for (const form of document.querySelectorAll("form.site-form[action]")) {
    form.addEventListener("submit", (event) => {
      if (Date.now() - opened < SOONEST_MS) {
        event.preventDefault();
      }
    });
  }
})();
