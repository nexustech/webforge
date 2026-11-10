import { t } from "@webforge/i18n";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

/** The bar as the Add panel places it, with `props` over its defaults. */
const bar = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [
      {
        type: "AnnouncementBar",
        props: { id: "news", ...siteLibrary.components.AnnouncementBar?.defaults, ...props },
      },
    ],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );

describe("the Announcement bar (6.4)", () => {
  it("is a thin landmark in the theme's dark colour, with its text and a hidden close button", () => {
    const html = bar();

    expect(html).toMatch(/^<section class="site-announcement-bar bg-neutral text-neutral-content /);
    expect(html).toContain(`aria-label="${t("siteText.announcement.label")}"`);
    expect(html).toContain("data-wf-announcement=");
    expect(html).toContain(`<p class="text-center text-sm">${t("starter.announcementText")}</p>`);
    // Shown by the script, which alone can close the bar.
    expect(html).toMatch(
      new RegExp(
        `<button type="button"[^>]*aria-label="${t("siteText.announcement.close")}"[^>]*hidden`,
      ),
    );
    expect(html).not.toContain("data-last-day");
    expect(html).toContain(
      'class="site-announcement-bar bg-neutral text-neutral-content px-4 py-0"',
    );
  });

  it("links its text when it has a link, and gives the script its last day", () => {
    const html = bar({
      link: { kind: "url", href: "https://rosas.example/opening-hours" },
      lastDay: "2026-12-27",
    });

    // The editor draws a link going nowhere; the export, its address.
    expect(html).toMatch(/<p class="text-center text-sm"><a class="link" href="[^"]*">Closed/);
    expect(html).toContain('data-last-day="2026-12-27"');
  });

  it("gives the script no last day that isn't a date", () => {
    expect(bar({ lastDay: "next week" })).not.toContain("data-last-day");
  });
});
