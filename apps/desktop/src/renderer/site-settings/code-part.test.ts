import { describe, expect, it } from "vitest";
import { createSettingsRegistry } from "../editor/settings-registry.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { sessionWith } from "../testing/fixtures.js";
import {
  type CodeForm,
  codeSpec,
  registerSiteCode,
  saveSiteCode,
  toCodeForm,
} from "./code-part.js";

const CODE = {
  css: ".sale { color: red; }",
  js: "window.sold = true;",
  head: '<meta name="verify" content="abc">',
  bodyEnd: "<p>Bye</p>",
};

/** What the section's schema makes of `values`: the saved code, or the problems by path. */
async function checked(values: CodeForm) {
  const spec = codeSpec();
  const result = await spec.schema["~standard"].validate(spec.toModel(values));
  return result.issues === undefined
    ? { value: result.value }
    : { issues: result.issues.map((issue) => [issue.path?.join("."), issue.message]) };
}

describe("the Custom code section (F-ED-15, 3.9)", () => {
  it("opens with the site's code and allowed addresses, and saves them as they were", async () => {
    const state = sessionWith().history.document.getState();
    const site = {
      ...state,
      code: CODE,
      settings: { ...state.settings, allowedExternalUrls: ["https://maps.example.com"] },
    };

    const form = toCodeForm(site);

    expect(form.allowed).toEqual([{ id: "allowed-0", url: "https://maps.example.com" }]);
    expect(await checked(form)).toEqual({
      value: { code: CODE, allowedExternalUrls: ["https://maps.example.com"] },
    });
  });

  it("says when an allowed address isn't an https:// address, in its own words", async () => {
    const form = toCodeForm(sessionWith().history.document.getState());

    // http:// too: a published site is https, where a browser blocks an http:// script.
    expect(
      (await checked({ ...form, allowed: [{ id: "a", url: "http://maps.example.com/x.js" }] }))
        .issues,
    ).toHaveLength(1);
    expect(await checked({ ...form, allowed: [{ id: "a", url: "maps.example.com" }] })).toEqual({
      issues: [["allowedExternalUrls.0", "Enter a web address that starts with https://."]],
    });
  });
});

describe("saveSiteCode", () => {
  it("keeps the files kept with the site, which the form doesn't show (3.9)", () => {
    const session = sessionWith();
    const file = {
      url: "https://cdn.example.com/w.js",
      file: "w-1.js",
      hash: "d".repeat(64),
      mime: "text/javascript",
    };
    session.edit("props", "Kept a file", (draft) => {
      draft.code.bundled = [file];
    });
    const site = session.history.document.getState();
    const { bundled: _kept, ...code } = site.code;

    // The form's own values, as it opened: nothing to save.
    expect(saveSiteCode(session, { code, allowedExternalUrls: [] })).toBe(false);
    expect(saveSiteCode(session, { code: { ...code, css: "a{}" }, allowedExternalUrls: [] })).toBe(
      true,
    );
    expect(session.history.document.getState().code.bundled).toEqual([file]);
  });

  it("saves the code and allowed addresses as one undo step, and nothing when nothing changed", () => {
    const session = sessionWith();
    const before = session.history.document.getState();
    const unchanged = {
      code: before.code,
      allowedExternalUrls: before.settings.allowedExternalUrls,
    };

    expect(saveSiteCode(session, unchanged)).toBe(false);
    expect(
      saveSiteCode(session, { code: CODE, allowedExternalUrls: ["https://maps.example.com"] }),
    ).toBe(true);

    const after = session.history.document.getState();
    expect(after.code).toEqual(CODE);
    expect(after.settings.allowedExternalUrls).toEqual(["https://maps.example.com"]);
    expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
      "Changed Custom Code",
    ]);
    session.history.undo();
    expect(session.history.document.getState().code).toEqual(before.code);
    expect(session.history.document.getState().settings.allowedExternalUrls).toEqual([]);
  });
});

describe("registerSiteCode", () => {
  it("shows the section in Advanced mode (T2)", () => {
    const settings = createSettingsRegistry();
    const preferences = createPreferencesStore();
    registerSiteCode(settings, sessionWith(), preferences);
    const entry = settings.list().find((item) => item.id === "code");

    expect(entry?.heading).toBe("site");
    expect(entry?.open()).toBeUndefined();
    preferences.change({ editorLevel: "advanced" });
    expect(entry?.open()?.form.id).toBe("code");
  });

  it("shows it in Simple mode too once the site has code of its own, for Site Check to show (3.9)", () => {
    const settings = createSettingsRegistry();
    const session = sessionWith();
    registerSiteCode(settings, session, createPreferencesStore());
    const entry = settings.list().find((item) => item.id === "code");

    expect(entry?.open()).toBeUndefined();
    saveSiteCode(session, {
      code: { ...CODE, js: "", head: "", bodyEnd: "" },
      allowedExternalUrls: [],
    });
    expect(entry?.open()?.form.id).toBe("code");
  });
});
