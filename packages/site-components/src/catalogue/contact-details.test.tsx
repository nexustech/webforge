import { t } from "@webforge/i18n";
import type { BindableSetting, NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { siteLibrary } from "./index.js";

const section = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "ContactDetails",
  props: { id: "contact", ...siteLibrary.components.ContactDetails?.defaults, ...props },
});

const SETTINGS: Partial<Record<BindableSetting, string>> = {
  "contact.address": "1 High Street\nHightown",
  "contact.phone": "+44 1234 567890",
  "contact.email": "hello@rosas.example",
  "contact.openingHoursNote": "Closed on bank holidays.",
};

/** The export's context: links resolved, the site's settings and hours, no hints. */
const exported = (
  settings: Partial<Record<BindableSetting, string>> = SETTINGS,
  openingHours: RenderContext["openingHours"] = [
    { days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" },
  ],
): RenderContext => ({
  ...EDITOR_RENDER_CONTEXT,
  href: (link) =>
    link.kind === "phone"
      ? `tel:${link.number}`
      : link.kind === "email"
        ? `mailto:${link.address}`
        : "#",
  setting: (key) => settings[key],
  openingHours,
});

const html = (node: NodeDoc, context: RenderContext = exported()) =>
  renderNodesToHtml([node], siteLibrary, context);

describe("Opening hours and contact (2.8)", () => {
  it("lists the opening hours and their note from Site Settings", () => {
    const drawn = html(section());

    expect(drawn).toContain('class="site-contact');
    expect(drawn).toContain(t("siteText.openingHours"));
    expect(drawn).toContain(
      '<dt class="font-medium">Tuesday to Friday</dt><dd><time dateTime="07:00">07:00</time>–<time dateTime="15:00">15:00</time></dd>',
    );
    expect(drawn).toContain("Closed on bank holidays.");
  });

  it("gives the address, and the phone number and email address as links", () => {
    const drawn = html(section());

    expect(drawn).toContain("<address");
    expect(drawn).toContain("1 High Street<br/>Hightown");
    expect(drawn).toContain('<a class="link" href="tel:+44 1234 567890">+44 1234 567890</a>');
    expect(drawn).toContain(
      '<a class="link" href="mailto:hello@rosas.example">hello@rosas.example</a>',
    );
  });

  it("follows Site Settings: the same section shows what they hold now", () => {
    const now = html(section(), exported({ ...SETTINGS, "contact.phone": "+44 1111 222333" }));

    expect(now).toContain("+44 1111 222333");
    expect(now).not.toContain("+44 1234 567890");
  });

  it("leaves out of the export what Site Settings don't have", () => {
    const drawn = html(section(), exported({ "contact.email": "hello@rosas.example" }, []));

    // No hours and no note: no hours at all.
    expect(drawn).not.toContain(t("siteText.openingHours"));
    expect(drawn).not.toContain(t("siteText.phone"));
    expect(drawn).not.toContain(t("siteText.address"));
    expect(drawn).toContain("hello@rosas.example");
  });

  it("shows on the canvas where to fill in what's empty", () => {
    const canvas: RenderContext = {
      ...exported({}, []),
      emptySetting: (key) => <em>{`hint:${key}`}</em>,
    };
    const drawn = html(section(), canvas);

    for (const key of [
      "contact.address",
      "contact.phone",
      "contact.email",
      "contact.openingHoursNote",
    ]) {
      expect(drawn).toContain(`hint:${key}`);
    }
  });

  it("hides either part, and puts them side by side or one above the other", () => {
    expect(html(section({ showHours: false }))).not.toContain(t("siteText.openingHours"));
    expect(html(section({ showContact: false }))).not.toContain("<address");
    expect(html(section())).toContain("md:grid-cols-2");
    expect(html(section({ variant: "stacked" }))).not.toContain("md:grid-cols-2");
    // One part alone needs no columns.
    expect(html(section({ showHours: false }))).not.toContain("md:grid-cols-2");
  });

  it("starts with its title, its text and both parts", () => {
    expect(siteLibrary.components.ContactDetails?.defaults).toMatchObject({
      title: t("starter.contactDetailsTitle"),
      showHours: true,
      showContact: true,
    });
  });
});
