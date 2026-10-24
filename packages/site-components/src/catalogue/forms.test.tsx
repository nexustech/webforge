import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterAll, describe, expect, it } from "vitest";
import { HONEYPOT_NAME } from "../form.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { emailFieldName, formAddress } from "./forms.js";
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

describe("formAddress and emailFieldName", () => {
  it("lets a form post only to an https address", () => {
    expect(formAddress(" https://example.us1.list-manage.com/subscribe/post?u=1&id=2 ")).toBe(
      "https://example.us1.list-manage.com/subscribe/post?u=1&id=2",
    );
    for (const value of [
      "",
      "http://example.com/signup",
      "javascript:alert(1)",
      "example.com",
      5,
    ]) {
      expect(formAddress(value)).toBeUndefined();
    }
  });

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

  it("posts nowhere without an https address", () => {
    for (const action of ["", "http://example.com/signup", "javascript:alert(1)"]) {
      expect(drawn(newsletter({ action })).querySelector("form")?.hasAttribute("action")).toBe(
        false,
      );
    }
  });

  it("puts the text beside the form in the split layout", () => {
    expect(drawn(newsletter({ variant: "split" })).innerHTML).toContain("md:grid-cols-2");
    expect(drawn(newsletter()).innerHTML).not.toContain("md:grid-cols-2");
  });
});
