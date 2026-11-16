import { css } from "@codemirror/lang-css";
import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { DEFAULT_THEME } from "@webforge/model";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { lintStylesheet } from "./css-editor.js";
import { type CssLintData, cssDiagnostics, themeVariables } from "./css-language.js";

const data: CssLintData = {
  site: starterSite(),
  variables: themeVariables(DEFAULT_THEME),
  allowListConfirmed: false,
};

describe("lintStylesheet (#1096)", () => {
  // CodeMirror's parses stop at a time limit as well as a position: with the clock stopped, they
  // stop at the position, however busy the computer is (#1117).
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("never reads the part of the stylesheet not yet parsed as invalid CSS", () => {
    // Longer than CodeMirror parses when the editor opens (its first 3,000 characters), and its
    // one mistake at the very end.
    const stylesheet = `${"@media (min-width: 48rem) {\n  #hours {\n    columns: 2;\n  }\n}\n".repeat(
      2000,
    )}.last { color: var(--nope); }\n`;
    const state = EditorState.create({ doc: stylesheet, extensions: [css()] });
    expect(syntaxTreeAvailable(state)).toBe(false);
    // Read from the tree as far as it goes, the rest is invalid: the first parse stops in a rule.
    expect(
      cssDiagnostics(stylesheet, syntaxTree(state), data).map((each) => each.severity),
    ).toContain("error");

    // Only the mistake at the end: found, so all of the stylesheet was read, and nothing else.
    expect(lintStylesheet(state, data).map((each) => each.severity)).toEqual(["warning"]);
  });

  it("finds what's wrong in a stylesheet", () => {
    const state = EditorState.create({ doc: ".a { color: var(--nope); }", extensions: [css()] });

    expect(lintStylesheet(state, data).map((each) => each.severity)).toEqual(["warning"]);
  });
});
