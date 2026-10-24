import { Window } from "happy-dom";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";
import { FormField, HONEYPOT_NAME, SiteForm } from "./form.js";

const happy = new Window();
afterAll(() => happy.happyDOM.close());

/** `node` rendered as the export renders it, parsed, so tests don't depend on attribute order. */
function drawn(node: ReactElement) {
  const host = happy.document.createElement("div");
  host.innerHTML = renderToStaticMarkup(node);
  return host;
}

const attributes = (element: Element | null) =>
  Object.fromEntries([...(element?.attributes ?? [])].map(({ name, value }) => [name, value]));

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
  it("posts plainly to its address, with the honeypot hidden from people", () => {
    const host = drawn(
      <SiteForm action="https://formspree.io/f/abcd" label="Contact form" submitLabel="Send">
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
    const honeypot = form?.querySelector(`input[name="${HONEYPOT_NAME}"]`);
    expect(honeypot?.closest("[hidden]")).not.toBeNull();
    expect(honeypot?.getAttribute("tabindex")).toBe("-1");
    expect(honeypot?.getAttribute("autocomplete")).toBe("off");
    expect(form?.querySelector('button[type="submit"]')?.textContent).toBe("Send");
    expect(host.querySelector("script")).toBeNull();
  });

  it("adds the hidden fields a service needs, and draws without an address", () => {
    const form = drawn(
      <SiteForm action={undefined} label="Form" submitLabel="Send" hidden={{ access_key: "k" }}>
        {null}
      </SiteForm>,
    ).querySelector("form");

    expect(form?.hasAttribute("action")).toBe(false);
    expect(attributes(form?.querySelector('input[type="hidden"]') ?? null)).toEqual({
      type: "hidden",
      name: "access_key",
      value: "k",
    });
  });
});
