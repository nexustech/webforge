// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Form } from "./form-engine.js";
import type { FormSpec } from "./form-spec.js";
import { type FormSubmit, useForm } from "./use-form.js";

afterEach(cleanup);

type Values = {
  readonly name: string;
  readonly phone: string;
  readonly open: boolean;
  readonly service: string;
  readonly value: string;
};

const schema = z.object({
  name: z.string().min(1, "Give it a name"),
  phone: z.string().max(5, "At most 5 characters").optional(),
  open: z.boolean(),
  service: z.string(),
  value: z.string().min(1, "Give the form ID"),
});

const spec: FormSpec<Values, z.infer<typeof schema>> = {
  groups: [
    { id: "general", label: "General" },
    { id: "contact", label: "Contact" },
  ],
  // The value's label depends on the service, as Site Settings' form service does.
  fields: (values) => [
    { kind: "text", name: "name", label: "Site name", group: "general" },
    { kind: "toggle", name: "open", label: "Show a button", group: "general" },
    { kind: "text", name: "phone", label: "Phone", group: "contact", width: "sm" },
    {
      kind: "select",
      name: "service",
      label: "Service",
      group: "contact",
      options: [
        { label: "Formspree", value: "formspree" },
        { label: "Web3Forms", value: "web3forms" },
      ],
    },
    {
      kind: "text",
      name: "value",
      label: values.service === "web3forms" ? "Access key" : "Form ID",
      group: "contact",
    },
  ],
  schema,
  toModel: (values) => ({
    name: values.name.trim(),
    ...(values.phone === "" ? {} : { phone: values.phone }),
    open: values.open,
    service: values.service,
    value: values.value,
  }),
  // A new service's value starts empty.
  adjust: (next, previous) => (next.service === previous.service ? next : { ...next, value: "" }),
};

const initial: Values = { name: "Rosa", phone: "", open: false, service: "formspree", value: "x1" };

/** The form in a host with a Save button, which reports what saving gave to `saved`. */
function setUp(form: FormSpec<Values, z.infer<typeof schema>> = spec) {
  const saved = vi.fn<(result: FormSubmit<z.infer<typeof schema>>) => void>();
  function Host() {
    const state = useForm(form, initial);
    return (
      <>
        <Form form={state} groupsLabel="Sections" />
        <button type="button" onClick={() => saved(state.submit())}>
          Save
        </button>
      </>
    );
  }
  render(<Host />);
  return { saved, user: userEvent.setup({ delay: null }) };
}

describe("Form (2.21)", () => {
  it("draws its fields by kind on its tabs, an on/off field as a labelled checkbox", async () => {
    const { user } = setUp();

    expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Site name" })).toHaveProperty("value", "Rosa");
    expect(screen.getByRole("checkbox", { name: "Show a button" })).toHaveProperty(
      "checked",
      false,
    );
    await user.click(screen.getByRole("tab", { name: "Contact" }));
    expect(screen.getByRole("combobox", { name: "Service" })).toBeTruthy();
  });

  it("saves the values as the model takes them, with the groups that changed", async () => {
    const { saved, user } = setUp();

    await user.click(screen.getByRole("checkbox", { name: "Show a button" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saved).toHaveBeenCalledWith({
      ok: true,
      output: { name: "Rosa", open: true, service: "formspree", value: "x1" },
      changedGroups: ["general"],
    });
  });

  it("shows the schema's message on the field once Save is tried, on the first tab with one", async () => {
    const { saved, user } = setUp();
    await user.click(screen.getByRole("tab", { name: "Contact" }));
    await user.type(screen.getByRole("textbox", { name: "Phone" }), "0123456");
    await user.click(screen.getByRole("tab", { name: "General" }));
    // Nothing shows while the person types (validateOn "save").
    expect(screen.queryByText("At most 5 characters")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saved).toHaveBeenCalledWith({ ok: false });
    const phone = screen.getByRole("textbox", { name: "Phone" });
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    expect(phone.getAttribute("aria-describedby")).toBe(
      screen.getByText("At most 5 characters").id,
    );
    // Then it follows the fixes.
    await user.clear(phone);
    expect(screen.queryByText("At most 5 characters")).toBeNull();
  });

  it("shows problems as the person types when the form asks, and makes the values consistent", async () => {
    const { user } = setUp({ ...spec, validateOn: "change" });
    await user.clear(screen.getByRole("textbox", { name: "Site name" }));
    expect(screen.getByText("Give it a name")).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Contact" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Service" }), "web3forms");
    // The value's field is the new service's, and starts empty.
    expect(screen.getByRole("textbox", { name: "Access key" })).toHaveProperty("value", "");
    expect(screen.getByText("Give the form ID")).toBeTruthy();
  });

  it("lists a problem no field shows above the fields", async () => {
    const { user } = setUp({
      ...spec,
      check: () => [{ path: ["publish"], message: "Publishing isn't set up" }],
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert").textContent).toBe("Publishing isn't set up");
  });

  it("keeps a disabled field's controls from changing, an image choice's too", () => {
    function Host() {
      const state = useForm(
        {
          fields: [
            {
              kind: "imageChoice",
              name: "icon",
              label: "Site icon",
              noneLabel: "None",
              options: [{ value: "shop", label: "shop", thumbnail: "test://shop" }],
              disabled: true,
            },
          ],
          schema: z.unknown(),
          toModel: (values) => values,
        },
        { icon: "shop" },
      );
      return <Form form={state} />;
    }
    render(<Host />);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveProperty("disabled", true);
    }
    expect(screen.getByRole("radio", { name: "shop" })).toHaveProperty("checked", true);
  });

  it("gives a text field that checks what's typed its kind of text and its limit too", () => {
    function Host() {
      const state = useForm(
        {
          fields: [
            {
              kind: "text",
              name: "email",
              label: "Email",
              inputType: "email",
              maxLength: 20,
              validate: (text) => (text.includes("@") ? undefined : "Use an email address"),
            },
          ],
          schema: z.unknown(),
          toModel: (values) => values,
        },
        { email: "" },
      );
      return <Form form={state} />;
    }
    render(<Host />);

    const email = screen.getByRole("textbox", { name: "Email" });
    expect(email.getAttribute("type")).toBe("email");
    expect(email.getAttribute("maxlength")).toBe("20");
  });
});
