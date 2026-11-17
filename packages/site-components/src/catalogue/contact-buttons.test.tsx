import { t } from "@webforge/i18n";
import type { BindableSetting } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { siteLibrary } from "./index.js";

/** Site Settings › Contact with a phone number and an email address. */
const SETTINGS: Partial<Record<BindableSetting, string>> = {
  "contact.phone": "01632 960123",
  "contact.email": "hello@example.com",
};

/** The Contact buttons' HTML with `props` over their defaults, on the canvas. */
function renderOnCanvas(
  props: Readonly<Record<string, unknown>> = {},
  context: Partial<RenderContext> = {},
): string {
  const defaults = siteLibrary.components.ContactButtons?.defaults;
  return renderNodesToHtml(
    [{ type: "ContactButtons", props: { id: "contact-buttons", ...defaults, ...props } }],
    siteLibrary,
    { ...EDITOR_RENDER_CONTEXT, setting: (key) => SETTINGS[key], ...context },
  );
}

/** The same, as the export draws them: pinned to the screen. */
const renderButtons = (
  props: Readonly<Record<string, unknown>> = {},
  context: Partial<RenderContext> = {},
) => renderOnCanvas(props, { pinned: true, ...context });

/** The links the buttons go to, in order. */
const hrefs = (html: string) => [...html.matchAll(/<a href="([^"]*)"/g)].map((match) => match[1]);

describe("the Contact buttons (#1136)", () => {
  it("calls and emails Site Settings' number and address, as plain links", () => {
    const html = renderButtons();

    expect(hrefs(html)).toEqual(["tel:01632960123", "mailto:hello@example.com"]);
    // Named for screen readers, as a whole and each by what it does.
    expect(html).toContain(`<nav aria-label="${t("siteText.contactButtons.label")}"`);
    expect(html).toContain(`aria-label="${t("siteText.contactButtons.call")}"`);
    expect(html).toContain(`aria-label="${t("siteText.contactButtons.email")}"`);
    // No script, nothing loaded: links alone.
    expect(html).not.toMatch(/<script|<img|<iframe|data-wf-/);
  });

  it("uses its own number and address over Site Settings', and WhatsApp's with its country code", () => {
    const html = renderButtons({
      phone: "+44 1632 960999",
      whatsapp: true,
      whatsappNumber: "+44 7700 900123",
      emailAddress: "bookings@example.com",
    });

    expect(hrefs(html)).toEqual([
      "tel:+441632960999",
      "https://wa.me/447700900123",
      "mailto:bookings@example.com",
    ]);
    expect(html).toContain(`aria-label="${t("siteText.contactButtons.whatsapp")}"`);
    // WhatsApp's number can be the phone's, written with 00.
    expect(hrefs(renderButtons({ phone: "0044 7700 900123", whatsapp: true }))).toContain(
      "https://wa.me/447700900123",
    );
  });

  it("doesn't show a button without a number or address it can use, or one turned off", () => {
    // WhatsApp needs the country code, which Site Settings' number here lacks.
    expect(hrefs(renderButtons({ whatsapp: true }))).toEqual([
      "tel:01632960123",
      "mailto:hello@example.com",
    ]);
    expect(hrefs(renderButtons({ call: false }))).toEqual(["mailto:hello@example.com"]);
    expect(hrefs(renderButtons({ emailAddress: "not an address" }))).toEqual(["tel:01632960123"]);
    // Nothing to show: nothing drawn but the section's frame.
    const none = renderButtons({}, { setting: () => undefined });
    expect(hrefs(none)).toEqual([]);
    expect(none).not.toContain("<nav");
  });

  it("stays at the bottom left on the site, clear of back-to-top, and under the cookie banner", () => {
    const pinned = renderButtons();
    expect(pinned).toMatch(/class="fixed bottom-4 left-4 z-40 [^"]*print:hidden"/);
    // A band with no room of its own after the Footer, even with a padding set.
    expect(pinned).toContain('<section class="site-contact-buttons">');
    expect(renderButtons({ padding: { top: "16", bottom: "16" } })).toContain(
      '<section class="site-contact-buttons">',
    );

    // On the canvas, where they are on the page, to be selected; with a hint while they show none.
    const canvas = { elementHint: (missing: string) => `[${missing}]` };
    expect(renderOnCanvas({}, canvas)).not.toContain("fixed");
    expect(renderOnCanvas({}, { ...canvas, setting: () => undefined })).toContain(
      "[contactButtons]",
    );
    expect(renderOnCanvas({ whatsapp: true }, canvas)).toContain("[whatsappNumber]");
  });
});
