import { CompletionContext } from "@codemirror/autocomplete";
import { css, cssLanguage } from "@codemirror/lang-css";
import { syntaxTree } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { DEFAULT_THEME, type SiteDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import {
  type CssSiteData,
  cssDiagnostics,
  cssSiteCompletion,
  themeVariables,
} from "./css-language.js";

const data: CssSiteData = {
  variables: ["--color-primary", "--radius-box"],
  classes: ["hero", "btn"],
  ids: ["hours"],
};

/** What completion offers with the caret at `|` in `text`. */
function complete(text: string) {
  const pos = text.indexOf("|");
  const state = EditorState.create({ doc: text.replace("|", ""), extensions: [css()] });
  const source = cssSiteCompletion(
    () => data,
    (context) => syntaxTree(context.state),
  );
  const result = source(new CompletionContext(state, pos, true));
  return result === null
    ? null
    : { from: result.from, labels: result.options.map((option) => option.label) };
}

describe("cssSiteCompletion (CT-8, 6.8)", () => {
  it("offers the theme's variables inside var(", () => {
    expect(complete(".a { color: var(--co| }")).toEqual({
      from: ".a { color: var(".length,
      labels: ["--color-primary", "--radius-box"],
    });
  });

  it("offers the site's classes and anchors in a selector, not in declarations", () => {
    expect(complete(".he|")?.labels).toEqual(["hero", "btn"]);
    expect(complete("#ho|")?.labels).toEqual(["hours"]);
    expect(complete(".a { color: #ff| }")).toBeNull();
  });
});

describe("themeVariables", () => {
  it("lists the variables the theme's CSS defines", () => {
    const variables = themeVariables(DEFAULT_THEME);

    expect(variables).toContain("--color-primary");
    expect(variables).toContain("--radius-box");
    expect(new Set(variables).size).toBe(variables.length);
  });
});

describe("cssDiagnostics (CT-8)", () => {
  const site: SiteDoc = starterSite();
  const lint = (text: string, used = { classes: new Set(["hero"]), ids: new Set<string>() }) =>
    cssDiagnostics(text, cssLanguage.parser.parse(text), {
      site,
      variables: ["--color-primary"],
      used,
      allowListConfirmed: false,
    }).map((each) => ({
      text: text.slice(each.from, each.to),
      severity: each.severity,
      message: each.message,
    }));

  it("finds unknown variables, files from other websites and rules that match nothing", () => {
    expect(
      lint(
        [
          ":root { --brand: red; }",
          ".hero { color: var(--color-primary); background: var(--brand); }",
          ".hero { border-color: var(--colour-primary); }",
          ".heor { background: url(https://img.example.com/a.jpg); }",
        ].join("\n"),
      ),
    ).toEqual([
      {
        text: "--colour-primary",
        severity: "warning",
        message: "The theme has no variable --colour-primary.",
      },
      { text: ".heor", severity: "info", message: "Nothing on your site has this class or id." },
      {
        text: "https://img.example.com/a.jpg",
        severity: "error",
        message: expect.stringContaining("another website"),
      },
    ]);
  });

  it("finds what isn't valid CSS", () => {
    expect(lint(".hero { color: red; } }").map((each) => each.severity)).toContain("error");
  });
});
