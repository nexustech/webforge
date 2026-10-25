import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { FormField, FormSpec } from "./form-spec.js";
import { applyListChange, changedGroups, checkForm, issueOf, unplacedIssues } from "./use-form.js";

type Values = { readonly name: string; readonly email: string; readonly hours: readonly unknown[] };

/** A form of a name (at most 10 characters) and an email address, as zod checks them. */
const spec: FormSpec<Values, { name: string; email?: string }> = {
  groups: [
    { id: "general", label: "General" },
    { id: "contact", label: "Contact" },
  ],
  fields: [
    { kind: "text", name: "name", label: "Name", group: "general" },
    { kind: "text", name: "email", label: "Email", group: "contact" },
  ],
  schema: z.object({
    name: z.string().min(1, "Give it a name").max(10, "At most 10 characters"),
    email: z.email("Use an email address").optional(),
  }),
  toModel: (values) => ({
    name: values.name.trim(),
    ...(values.email.trim() === "" ? {} : { email: values.email.trim() }),
  }),
};

const values = (change: Partial<Values> = {}): Values => ({
  name: "Rosa",
  email: "",
  hours: [],
  ...change,
});

describe("checkForm (2.21)", () => {
  it("gives the schema's value when the form is acceptable, as the model takes it", () => {
    expect(checkForm(spec, values({ name: " Rosa " }))).toEqual({
      output: { name: "Rosa" },
      issues: [],
    });
  });

  it("gives the schema's own messages, at the paths it found them", () => {
    expect(checkForm(spec, values({ name: "", email: "rosa" })).issues).toEqual([
      { path: ["name"], message: "Give it a name" },
      { path: ["email"], message: "Use an email address" },
    ]);
  });

  it("adds the form's own checks to the schema's", () => {
    const taken: typeof spec = {
      ...spec,
      check: (each) =>
        each.name === "Home" ? [{ path: ["name"], message: "A page is called that" }] : [],
    };
    expect(checkForm(taken, values({ name: "Home" })).issues).toEqual([
      { path: ["name"], message: "A page is called that" },
    ]);
  });
});

describe("a field's problems (2.21)", () => {
  const url: FormField = { kind: "text", name: "url", label: "Address", path: "social.profiles" };

  it("are those at its path, or inside it (an item of a list)", () => {
    const issues = [
      { path: ["social", "profiles", 2, "url"], message: "Use a web address" },
      { path: ["general", "name"], message: "Give it a name" },
    ];
    expect(issueOf(url, issues)).toBe("Use a web address");
    expect(issueOf({ kind: "text", name: "name", label: "Name" }, issues)).toBeUndefined();
    expect(issueOf({ ...url, path: "general.name" }, issues)).toBe("Give it a name");
  });

  it("that no field shows are the form's own", () => {
    const issues = [
      { path: ["social", "profiles", 0, "url"], message: "Use a web address" },
      { path: ["publish"], message: "Something else" },
    ];
    expect(unplacedIssues([url], issues)).toEqual([
      { path: ["publish"], message: "Something else" },
    ]);
  });
});

describe("changedGroups (2.21)", () => {
  it("names the groups whose fields changed, in the form's order", () => {
    expect(changedGroups(spec, values(), values())).toEqual([]);
    expect(changedGroups(spec, values(), values({ email: "a@b.example", name: "Ana" }))).toEqual([
      "general",
      "contact",
    ]);
  });
});

describe("applyListChange (2.21)", () => {
  const items = [
    { id: "a", day: "mon" },
    { id: "b", day: "tue" },
    { id: "c", day: "wed" },
  ];

  it("adds an item with a fresh id, removes, edits and moves one", () => {
    const added = applyListChange(items, { type: "add" }, () => ({ day: "sun" }));
    expect(added).toHaveLength(4);
    expect(added[3]).toMatchObject({ day: "sun", id: expect.any(String) });
    expect(added[3]?.id).not.toBe("c");

    expect(applyListChange(items, { type: "remove", id: "b" }).map((item) => item.id)).toEqual([
      "a",
      "c",
    ]);
    expect(applyListChange(items, { type: "edit", id: "b", name: "day", value: "sat" })[1]).toEqual(
      { id: "b", day: "sat" },
    );
    expect(applyListChange(items, { type: "move", id: "c", to: 0 }).map((item) => item.id)).toEqual(
      ["c", "a", "b"],
    );
  });
});
