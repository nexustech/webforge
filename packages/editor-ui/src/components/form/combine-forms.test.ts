// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { combineForms, formPart } from "./combine-forms.js";
import type { FormSpec } from "./form-spec.js";
import { useForm } from "./use-form.js";

type Look = { readonly theme: string };
const look: FormSpec<Look, { theme: string }> = {
  fields: [{ kind: "text", name: "theme", label: "Theme" }],
  schema: z.object({ theme: z.string().min(1, "Choose a theme") }),
  toModel: (values) => ({ theme: values.theme.trim() }),
};

type Site = { readonly name: string; readonly email: string };
const site: FormSpec<Site, { general: { name: string }; contact: { email: string } }> = {
  groups: [
    { id: "general", label: "General" },
    { id: "contact", label: "Contact" },
  ],
  fields: [
    { kind: "text", name: "name", label: "Site name", group: "general", path: "general.name" },
    { kind: "text", name: "email", label: "Email", group: "contact", path: "contact.email" },
  ],
  schema: z.object({
    general: z.object({ name: z.string().min(1, "Give the site a name") }),
    contact: z.object({ email: z.string() }),
  }),
  toModel: (values) => ({ general: { name: values.name }, contact: { email: values.email } }),
  // Made consistent per part: an email is kept lower case.
  adjust: (next) => ({ ...next, email: next.email.toLowerCase() }),
};

const combined = () =>
  combineForms([
    formPart({
      id: "look",
      heading: "App",
      label: "Interface",
      spec: look,
      initial: { theme: "dark" },
    }),
    formPart({
      id: "site",
      heading: "This site",
      label: "Site",
      spec: site,
      initial: { name: "Rosa's", email: "" },
    }),
  ]);

describe("combineForms (LF-12)", () => {
  it("lists each part's groups under its heading, its fields and values kept apart by its id", () => {
    const { spec, initial } = combined();

    expect(spec.groups).toEqual([
      { id: "look:", label: "Interface", heading: "App" },
      { id: "site:general", label: "General", heading: "This site" },
      { id: "site:contact", label: "Contact", heading: "This site" },
    ]);
    expect(initial).toEqual({ "look:theme": "dark", "site:name": "Rosa's", "site:email": "" });
    const fields = typeof spec.fields === "function" ? spec.fields(initial) : spec.fields;
    expect(fields.map(({ name, group, path }) => [name, group, path])).toEqual([
      ["look:theme", "look:", "look.theme"],
      ["site:name", "site:general", "site.general.name"],
      ["site:email", "site:contact", "site.contact.email"],
    ]);
  });

  it("saves each part's output by its id, and shows a part's problem by its field", () => {
    const { spec, initial } = combined();
    const { result } = renderHook(() => useForm(spec, initial));

    act(() => result.current.change("site:name", ""));
    act(() => {
      expect(result.current.submit().ok).toBe(false);
    });
    expect(result.current.issues).toEqual([
      { path: ["site", "general", "name"], message: "Give the site a name" },
    ]);

    act(() => result.current.change("site:name", "Rosa's Bakery"));
    act(() => result.current.change("site:email", "HI@ROSAS.CO"));
    let saved: unknown;
    act(() => {
      const outcome = result.current.submit();
      saved = outcome.ok ? outcome.output : undefined;
    });
    expect(saved).toEqual({
      look: { theme: "dark" },
      site: { general: { name: "Rosa's Bakery" }, contact: { email: "hi@rosas.co" } },
    });
  });
});
