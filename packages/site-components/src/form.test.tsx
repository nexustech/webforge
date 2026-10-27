import { httpsAddress } from "@webforge/model";
import { Window } from "happy-dom";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { FormField, formAction, SiteForm } from "./form.js";

const happy = new Window();
afterAll(() => happy.happyDOM.close());

/** `node` rendered as the export renders it, parsed, so tests don't depend on attribute order. */
function drawn(node: ReactElement) {
  const host = happy.document.createElement("div");
  host.innerHTML = renderToStaticMarkup(node);
  return host;
}

/** An element's attributes by name (happy-dom's elements, typed by what's read). */
const attributes = (
  element:
    | { readonly attributes: Iterable<{ name: string; value: string | null }> }
    | null
    | undefined,
) => Object.fromEntries([...(element?.attributes ?? [])].map(({ name, value }) => [name, value]));

describe("form fields (2.8, shared with 2.11)", () => {
  it("labels each field, and asks the browser for the right kind of value", () => {
    const email = drawn(
      <FormField kind="email" name="email" label="Email" id="f-email" required />,
    );

    expect(email.querySelector("label")?.getAttribute("for")).toBe("f-email");
    expect(email.querySelector("label")?.textContent).toBe("Email *");
    // The required mark is for the eye; the field itself says it's required.
    expect(email.querySelector("label span")?.getAttribute("aria-hidden")).toBe("true");
    expect(attributes(email.querySelector("input"))).toEqual({
      id: "f-email",
      name: "email",
      type: "email",
      class: "input w-full",
      required: "",
      // Said by every screen reader, as the browser checks it (2.11 review).
      "aria-required": "true",
      autocomplete: "email",
    });
    expect(
      drawn(<FormField kind="phone" name="phone" label="Phone" id="f-p" />)
        .querySelector("input")
        ?.getAttribute("type"),
    ).toBe("tel");
    const message = drawn(<FormField kind="message" name="message" label="Message" id="f-m" />);
    expect(attributes(message.querySelector("textarea"))).toMatchObject({
      id: "f-m",
      name: "message",
    });
  });

  it("puts a tick box inside its label, and offers a select's choices after a prompt", () => {
    const box = drawn(<FormField kind="checkbox" name="agree" label="I agree" id="f-a" required />);
    expect(box.querySelector("label > input")?.getAttribute("type")).toBe("checkbox");
    expect(box.querySelector("label")?.textContent).toBe("I agree *");

    const select = drawn(
      <FormField kind="select" name="topic" label="Topic" id="f-t" options={["Cakes", "Bread"]} />,
    );
    const options = [...select.querySelectorAll("option")];
    expect(options.map((option) => option.textContent)).toEqual(["Choose…", "Cakes", "Bread"]);
    expect(options[0]?.hasAttribute("disabled")).toBe(true);
    expect(options[0]?.hasAttribute("selected")).toBe(true);
  });
});

describe("SiteForm (F-CM-1, F-CM-6, B6)", () => {
  it("posts plainly to its service, with the honeypot hidden from people", () => {
    const host = drawn(
      <SiteForm
        target={{
          action: "https://formspree.io/f/abcd",
          hidden: {},
          honeypot: { name: "_gotcha" },
        }}
        label="Contact form"
        submitLabel="Send"
      >
        <FormField kind="text" name="name" label="Name" id="n" />
      </SiteForm>,
    );
    const form = host.querySelector("form");

    expect(attributes(form)).toMatchObject({
      method: "post",
      action: "https://formspree.io/f/abcd",
      "accept-charset": "UTF-8",
      "aria-label": "Contact form",
    });
    expect(form?.hasAttribute("data-wf-form-unset")).toBe(false);
    expect(form?.querySelector("button")?.hasAttribute("disabled")).toBe(false);
    const honeypot = form?.querySelector('input[name="_gotcha"]');
    expect(honeypot?.closest("[hidden]")).not.toBeNull();
    expect(honeypot?.getAttribute("tabindex")).toBe("-1");
    expect(honeypot?.getAttribute("autocomplete")).toBe("off");
    expect(form?.querySelector('button[type="submit"]')?.textContent).toBe("Send");
    expect(host.querySelector("script")).toBeNull();
  });

  it("adds the hidden fields a service needs", () => {
    const form = drawn(
      <SiteForm
        target={{
          action: "https://api.web3forms.com/submit",
          hidden: { access_key: "k" },
          honeypot: { name: "botcheck", checkbox: true },
        }}
        label="Form"
        submitLabel="Send"
      >
        {null}
      </SiteForm>,
    ).querySelector("form");

    expect(attributes(form?.querySelector('input[type="hidden"]'))).toEqual({
      type: "hidden",
      name: "access_key",
      value: "k",
    });
    // Web3Forms' honeypot is a checkbox, hidden like any other (3.7).
    const honeypot = form?.querySelector('input[name="botcheck"]');
    expect(honeypot?.getAttribute("type")).toBe("checkbox");
    expect(honeypot?.closest("[hidden]")).not.toBeNull();
  });

  it("with nowhere to send, posts nowhere, is marked for Site Check, and shows the hint", () => {
    const form = drawn(
      <SiteForm
        target="noService"
        label="Form"
        submitLabel="Send"
        hint={(reason) => <em>{`Choose one (${reason})`}</em>}
      >
        {null}
      </SiteForm>,
    ).querySelector("form");

    // No action: a form without one would post to the page itself.
    expect(form?.hasAttribute("action")).toBe(false);
    expect(form?.getAttribute("data-wf-form-unset")).toBe("noService");
    // Nothing to send to: the button can't send the visitor's message into an error page.
    expect(form?.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    expect(form?.querySelector("em")?.textContent).toBe("Choose one (noService)");
    // The export has no hint.
    const exported = drawn(
      <SiteForm target="noService" label="Form" submitLabel="Send">
        {null}
      </SiteForm>,
    ).querySelector("form");
    expect(exported?.querySelector("p")).toBeNull();
  });
});

describe("formAction (F-CM-1, B3)", () => {
  it("sends to each service's own address, with what it needs", () => {
    expect(formAction({ kind: "formspree", formId: "xyzAbc12" })).toEqual({
      action: "https://formspree.io/f/xyzAbc12",
      hidden: {},
      honeypot: { name: "_gotcha" },
    });
    expect(
      formAction({ kind: "web3forms", accessKey: "0f8fad5b-d9cb-469f-a165-70867728950e" }),
    ).toEqual({
      action: "https://api.web3forms.com/submit",
      hidden: { access_key: "0f8fad5b-d9cb-469f-a165-70867728950e" },
      honeypot: { name: "botcheck", checkbox: true },
    });
    expect(formAction({ kind: "formsubmit", email: "rosa+web@example.com" })).toEqual({
      action: "https://formsubmit.co/rosa%2Bweb%40example.com",
      hidden: {},
      honeypot: { name: "_honey" },
    });
    expect(formAction({ kind: "custom", url: "https://forms.example.com/in" })).toEqual({
      action: "https://forms.example.com/in",
      hidden: {},
      honeypot: { name: "_gotcha" },
    });
  });

  it("says why there's nowhere to send: no service, Netlify Forms (3.7), or no https", () => {
    expect(formAction(undefined)).toBe("noService");
    expect(formAction({ kind: "netlify" })).toBe("netlify");
    // A custom address must be https, so a visitor's message never travels unencrypted.
    expect(formAction({ kind: "custom", url: "http://forms.example.com/in" })).toBe("insecure");
  });

  it("sends the visitor to the thank-you page where the service takes one (3.7)", () => {
    const thanks = "https://rosas-bakery.example/thank-you.html";

    expect(
      formAction({ kind: "web3forms", accessKey: "0f8fad5b-d9cb-469f-a165-70867728950e" }, thanks),
    ).toMatchObject({ hidden: { redirect: thanks } });
    expect(formAction({ kind: "formsubmit", email: "rosa@example.com" }, thanks)).toMatchObject({
      hidden: { _next: thanks },
    });
    // Formspree's redirect is a paid plan's setting, and a custom endpoint's conventions are its
    // own: theirs show the service's own thank-you page.
    expect(formAction({ kind: "formspree", formId: "xyzAbc12" }, thanks)).toMatchObject({
      hidden: {},
    });
    expect(
      formAction({ kind: "custom", url: "https://forms.example.com/in" }, thanks),
    ).toMatchObject({ hidden: {} });
  });
});

describe("httpsAddress", () => {
  it("lets a form post only to an https address", () => {
    expect(httpsAddress(" https://example.us1.list-manage.com/subscribe/post?u=1&id=2 ")).toBe(
      "https://example.us1.list-manage.com/subscribe/post?u=1&id=2",
    );
    for (const value of [
      "",
      "http://example.com/signup",
      "javascript:alert(1)",
      "example.com",
      5,
    ]) {
      expect(httpsAddress(value)).toBeUndefined();
    }
  });
});
