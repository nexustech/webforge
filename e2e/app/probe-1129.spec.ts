import { type ElectronApplication, expect, type Page, test } from "@playwright/test";
import { launchDesktopApp, waitForCanvas } from "./launch.js";

// TEMPORARY local probe (#1129). Not committed.

let app: ElectronApplication;
let page: Page;

test.beforeEach(async () => {
  app = await launchDesktopApp();
  page = await app.firstWindow();
  await page
    .getByRole("region", { name: "Left panels" })
    .getByRole("tab", { name: "Undo History" })
    .click();
  await waitForCanvas(page);
});

test.afterEach(async () => {
  await app.close();
});

const canvas = () => page.frameLocator(".editor__canvas iframe");

test("probe: hovered +", async () => {
  const section = canvas().locator(".site-section");
  const box = await section.boundingBox();
  if (box === null) throw new Error("no box");
  // Record events in the frame.
  await section.evaluate((el) => {
    const doc = el.ownerDocument;
    const log: string[] = [];
    (doc.defaultView as unknown as { __log: string[] }).__log = log;
    const t0 = performance.now();
    const name = (n: EventTarget | null) => {
      const e = n as Element | null;
      if (!e?.tagName) return String(n);
      return `${e.tagName}.${String(e.className).slice(0, 30)}${e.getAttribute?.("data-puck-component") ? `#${e.getAttribute("data-puck-component")}` : ""}`;
    };
    for (const type of ["mouseover", "mouseout", "pointerover", "pointerout", "scroll"]) {
      doc.addEventListener(
        type,
        (ev) => {
          const m = ev as MouseEvent;
          log.push(
            `${Math.round(performance.now() - t0)} ${type} ${name(ev.target)} -> ${name(m.relatedTarget ?? null)} trusted=${ev.isTrusted}`,
          );
        },
        { capture: true },
      );
    }
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes)
          if (
            (n as Element).querySelector?.(".wf-add") ||
            (n as Element).classList?.contains("wf-add")
          )
            log.push(`${Math.round(performance.now() - t0)} + added`);
        for (const n of r.removedNodes)
          if (
            (n as Element).querySelector?.(".wf-add") ||
            (n as Element).classList?.contains("wf-add")
          )
            log.push(`${Math.round(performance.now() - t0)} + removed`);
        for (const n of r.addedNodes)
          if ((n as Element).classList?.contains("wf-tip"))
            log.push(`${Math.round(performance.now() - t0)} tip shown`);
        for (const n of r.removedNodes)
          if ((n as Element).classList?.contains("wf-tip"))
            log.push(`${Math.round(performance.now() - t0)} tip hidden`);
      }
    }).observe(doc.body, { childList: true, subtree: true });
  });
  await section.hover({ force: true, position: { x: 10, y: box.height - 4 } });
  const plus = canvas()
    .locator('.wf-outline[data-state="hover"]')
    .getByRole("button", { name: "Add a section here" });
  await plus.hover();
  let shown = true;
  try {
    await expect(canvas().locator(".wf-tip")).toHaveText("Add a section here", { timeout: 3000 });
  } catch {
    shown = false;
  }
  const log = await section.evaluate(
    (el) => (el.ownerDocument.defaultView as unknown as { __log: string[] }).__log,
  );
  console.log(`PROBE1129 shown=${shown}\n${log.join("\n")}\n---`);
});
