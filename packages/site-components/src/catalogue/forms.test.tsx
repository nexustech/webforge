import { t } from "@webforge/i18n";
import {
  expandSharedCopies,
  type NodeDoc,
  SHARED_COPY_TYPE,
  type SharedSectionId,
} from "@webforge/model";
import { Window } from "happy-dom";
import { afterAll, describe, expect, it } from "vitest";
import { HONEYPOT_NAME } from "../form.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { emailFieldName } from "./forms.js";
import { siteLibrary } from "./index.js";

const happy = new Window();
afterAll(() => happy.happyDOM.close());

/** `node` as the export renders it, parsed. */
function drawn(node: NodeDoc, context: RenderContext = EDITOR_RENDER_CONTEXT) {
  const host = happy.document.createElement("div");
  host.innerHTML = renderNodesToHtml([node], siteLibrary, context);
  return host;
}

const newsletter = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "Newsletter",
  props: { id: "news", ...siteLibrary.components.Newsletter?.defaults, ...props },
});

describe("emailFieldName", () => {
  it("keeps a field name a service may use, and falls back to email", () => {
    for (const name of ["EMAIL", "email", "fields[email]", "member.email"]) {
      expect(emailFieldName(name)).toBe(name);
    }
    for (const name of ["", "e mail", '"><script>', "x".repeat(65), undefined]) {
      expect(emailFieldName(name)).toBe("email");
    }
  });
});

describe("Newsletter signup (F-CM-6)", () => {
  it("asks for an email address and posts it to the newsletter service's address", () => {
    const host = drawn(newsletter({ action: "https://example.com/signup", emailName: "EMAIL" }));
    const form = host.querySelector("form");

    expect(host.querySelector("section")?.className).toContain("site-newsletter");
    expect(form?.getAttribute("action")).toBe("https://example.com/signup");
    expect(form?.getAttribute("method")).toBe("post");
    expect(form?.getAttribute("aria-label")).toBe(t("siteText.form.newsletter"));
    const email = form?.querySelector('input[type="email"]');
    expect(email?.getAttribute("name")).toBe("EMAIL");
    expect(email?.hasAttribute("required")).toBe(true);
    expect(form?.querySelector(`input[name="${HONEYPOT_NAME}"]`)).not.toBeNull();
    expect(form?.querySelector('button[type="submit"]')?.textContent).toBe(
      t("starter.newsletterButton"),
    );
    // No name unless asked.
    expect(form?.querySelector('input[name="name"]')).toBeNull();
  });

  it("asks for a name too when set to, and uses its own button text", () => {
    const form = drawn(newsletter({ askName: true, buttonLabel: "Join" })).querySelector("form");

    expect(form?.querySelector('input[name="name"]')?.getAttribute("autocomplete")).toBe("name");
    expect(form?.querySelector("button")?.textContent).toBe("Join");
  });

  it("can't send without an https address, and the canvas says why", () => {
    const canvas: RenderContext = {
      ...EDITOR_RENDER_CONTEXT,
      formHint: (reason) => <em>{`hint:${reason}`}</em>,
    };
    for (const [action, reason] of [
      ["", "noAddress"],
      ["http://example.com/signup", "insecure"],
      ["javascript:alert(1)", "insecure"],
    ]) {
      const form = drawn(newsletter({ action }), canvas).querySelector("form");
      expect(form?.hasAttribute("action")).toBe(false);
      expect(form?.getAttribute("data-wf-form-unset")).toBe(reason);
      expect(form?.querySelector("button")?.hasAttribute("disabled")).toBe(true);
      expect(form?.querySelector("em")?.textContent).toBe(`hint:${reason}`);
    }
  });

  it("puts the text beside the form in the split layout", () => {
    expect(drawn(newsletter({ variant: "split" })).innerHTML).toContain("md:grid-cols-2");
    expect(drawn(newsletter()).innerHTML).not.toContain("md:grid-cols-2");
  });
});

const contactForm = (props: Record<string, unknown> = {}): NodeDoc => ({
  type: "ContactForm",
  props: { id: "contact-form", ...siteLibrary.components.ContactForm?.defaults, ...props },
});

describe("Contact form (F-CM-1)", () => {
  const withService: RenderContext = {
    ...EDITOR_RENDER_CONTEXT,
    formService: { kind: "formspree", formId: "xyzAbc12" },
  };

  it("sends a name, an email address and a message to the service in Site Settings", () => {
    const host = drawn(contactForm(), withService);
    const form = host.querySelector("form");

    expect(host.querySelector("section")?.className).toContain("site-contact-form");
    expect(form?.getAttribute("action")).toBe("https://formspree.io/f/xyzAbc12");
    expect(form?.getAttribute("aria-label")).toBe(t("siteText.form.contact"));
    expect(
      [...(form?.querySelectorAll("input:not([type=hidden]), textarea") ?? [])]
        .map((field) => field.getAttribute("name"))
        .filter((name) => name !== HONEYPOT_NAME),
    ).toEqual(["name", "email", "message"]);
    for (const name of ["name", "email", "message"]) {
      expect(form?.querySelector(`[name="${name}"]`)?.hasAttribute("required")).toBe(true);
    }
    // Each field's id is unique on the page: the section's id, then the field.
    expect(form?.querySelector('[name="email"]')?.id).toBe("contact-form-email");
    expect(form?.querySelector("button")?.textContent).toBe(t("starter.contactFormButton"));
  });

  it("asks for a phone number, not required, when set to", () => {
    const phone = drawn(contactForm({ askPhone: true }), withService).querySelector(
      'input[name="phone"]',
    );

    expect(phone?.getAttribute("type")).toBe("tel");
    expect(phone?.hasAttribute("required")).toBe(false);
  });

  it("without a service, posts nowhere, is marked for Site Check, and shows the canvas's hint", () => {
    const exported = drawn(contactForm()).querySelector("form");
    expect(exported?.hasAttribute("action")).toBe(false);
    expect(exported?.hasAttribute("data-wf-form-unset")).toBe(true);

    const canvas = drawn(contactForm(), {
      ...EDITOR_RENDER_CONTEXT,
      formHint: (reason) => <em>{`hint:${reason}`}</em>,
    });
    expect(canvas.querySelector("form em")?.textContent).toBe("hint:noService");
  });

  it("can't send with Netlify Forms (3.7) or a custom address that isn't https, and says why", () => {
    const hinted = (formService: NonNullable<RenderContext["formService"]>) =>
      drawn(contactForm(), {
        ...EDITOR_RENDER_CONTEXT,
        formService,
        formHint: (reason) => <em>{`hint:${reason}`}</em>,
      }).querySelector("form");

    const netlify = hinted({ kind: "netlify" });
    expect(netlify?.getAttribute("data-wf-form-unset")).toBe("netlify");
    expect(netlify?.querySelector("em")?.textContent).toBe("hint:netlify");
    const insecure = hinted({ kind: "custom", url: "http://forms.example.com/in" });
    expect(insecure?.hasAttribute("action")).toBe(false);
    expect(insecure?.getAttribute("data-wf-form-unset")).toBe("insecure");
    expect(insecure?.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    expect(insecure?.querySelector("em")?.textContent).toBe("hint:insecure");
  });
});

describe("forms in linked copies (F-ED-23)", () => {
  it("give each copy's fields ids of their own, so two copies on a page don't clash", () => {
    const shared = {
      ["shared-contact" as SharedSectionId]: {
        id: "shared-contact" as SharedSectionId,
        name: "Contact",
        section: contactForm(),
      },
    };
    const copy = (id: string): NodeDoc => ({
      type: SHARED_COPY_TYPE,
      props: { id, sharedSectionId: "shared-contact" },
    });
    const host = happy.document.createElement("div");
    host.innerHTML = renderNodesToHtml(
      expandSharedCopies([copy("c1"), copy("c2")], shared),
      siteLibrary,
      EDITOR_RENDER_CONTEXT,
    );

    const ids = [...host.querySelectorAll("[id]")].map((element) => element.id);
    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
