import { css } from "@codemirror/lang-css";
import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { DEFAULT_THEME } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { lintStylesheet } from "./css-editor.js";
import { type CssLintData, cssDiagnostics, themeVariables } from "./css-language.js";

const data: CssLintData = {
  site: starterSite(),
  variables: themeVariables(DEFAULT_THEME),
  allowListConfirmed: false,
};

describe("lintStylesheet (#1096)", () => {
  it("never reads the part of the stylesheet not yet parsed as invalid CSS", () => {
    // Longer than CodeMirror parses when the editor opens.
    const stylesheet = "@media (min-width: 48rem) {\n  #hours {\n    columns: 2;\n  }\n}\n".repeat(
      2000,
    );
    const state = EditorState.create({ doc: stylesheet, extensions: [css()] });
    expect(syntaxTreeAvailable(state)).toBe(false);
    // Read from the tree as far as it goes, the rest is invalid.
    expect(
      cssDiagnostics(stylesheet, syntaxTree(state), data).map((each) => each.severity),
    ).toContain("error");

    expect(lintStylesheet(state, data)).toEqual([]);
  });

  it("finds what's wrong in a stylesheet", () => {
    const state = EditorState.create({ doc: ".a { color: var(--nope); }", extensions: [css()] });

    expect(lintStylesheet(state, data).map((each) => each.severity)).toEqual(["warning"]);
  });
});
