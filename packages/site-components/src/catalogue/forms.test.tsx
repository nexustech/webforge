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
import { createFieldNames, emailFieldName, fieldNameBase } from "./forms.js";
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

describe("the Form and its fields (2.11, S1)", () => {
  const field = (id: string, props: Record<string, unknown>): NodeDoc => ({
    type: "FormField",
    props: { id, ...siteLibrary.components.FormField?.defaults, ...props },
  });
  const form = (fields?: NodeDoc[], props: Record<string, unknown> = {}): NodeDoc => ({
    type: "Form",
    props: {
      id: "enquiry",
      ...siteLibrary.components.Form?.defaults,
      ...(fields === undefined ? {} : { fields }),
      ...props,
    },
  });
  const names = (host: ReturnType<typeof drawn>) =>
    [...host.querySelectorAll("[name]")].map((control) => control.getAttribute("name"));

  it("starts asking for a name, an email address and a message, all required", () => {
    const host = drawn(form());

    expect(names(host)).toEqual(["name", "email", "message", HONEYPOT_NAME]);
    for (const control of host.querySelectorAll(".site-form-field [name]")) {
      expect(control.hasAttribute("required")).toBe(true);
      expect(control.getAttribute("aria-required")).toBe("true");
    }
    // Marked for the eye, the mark skipped by screen readers.
    expect(host.querySelector("label span")?.getAttribute("aria-hidden")).toBe("true");
    // Ids unique on the page: the form's, then the field's name.
    expect(host.querySelector("label")?.getAttribute("for")).toBe("enquiry-name");
    expect(host.querySelector("form")?.getAttribute("aria-label")).toBe(t("starter.formLabel"));
  });

  it("names each field from its label, uniquely, in plain letters or by its place", () => {
    const host = drawn(
      form([
        field("a", { kind: "text", label: "Téléphone" }),
        field("b", { kind: "text", label: "電話" }),
        field("c", { kind: "text", label: "Téléphone" }),
        field("d", { kind: "email", label: "Your e-mail" }),
        field("e", { kind: "email", label: "A second email" }),
      ]),
    );

    expect(names(host).slice(0, 5)).toEqual([
      "telephone",
      "field-2",
      "telephone-2",
      "email",
      "email-2",
    ]);
  });

  it("keeps a field's name when it's drawn again alone, and renames it with its label", () => {
    const fields = createFieldNames("f");

    expect(fields.claim("a", "text", "Name")).toEqual({ name: "name", id: "f-name" });
    expect(fields.claim("b", "text", "Name")).toEqual({ name: "name-2", id: "f-name-2" });
    expect(fields.claim("a", "text", "Name").name).toBe("name");
    expect(fields.claim("b", "text", "Company").name).toBe("company");
    expect(fieldNameBase("checkbox", "  ", 4)).toBe("field-4");
  });

  it("offers a tick box and a choice from its list, with the honeypot out of reach", () => {
    const host = drawn(
      form([
        field("a", { kind: "checkbox", label: "Send me news" }),
        field("b", {
          kind: "select",
          label: "Cake",
          options: [
            { id: "1", label: "Lemon" },
            { id: "2", label: " " },
            { id: "3", label: "Chocolate" },
          ],
        }),
      ]),
    );

    expect(host.querySelector("input[type=checkbox]")?.getAttribute("name")).toBe("send-me-news");
    const choices = [...host.querySelectorAll("select option")].map((option) => option.textContent);
    expect(choices).toEqual([t("siteText.form.choose"), "Lemon", "Chocolate"]);
    const honeypot = host.querySelector(`[name="${HONEYPOT_NAME}"]`);
    expect(honeypot?.getAttribute("tabindex")).toBe("-1");
    expect(honeypot?.closest("[hidden]")).not.toBeNull();
  });

  it("posts to the form service in Site Settings, else draws and says where to choose one", () => {
    const sending = drawn(form(), {
      ...EDITOR_RENDER_CONTEXT,
      formService: { kind: "formspree", formId: "xyzAbc12" },
    });
    expect(sending.querySelector("form")?.getAttribute("action")).toBe(
      "https://formspree.io/f/xyzAbc12",
    );

    const unset = drawn(form(), {
      ...EDITOR_RENDER_CONTEXT,
      formHint: (reason) => `Hint: ${reason}`,
    });
    expect(unset.querySelector("form")?.hasAttribute("action")).toBe(false);
    expect(unset.textContent).toContain("Hint: noService");
    expect(unset.querySelector("button[type=submit]")?.hasAttribute("disabled")).toBe(true);
  });
});
