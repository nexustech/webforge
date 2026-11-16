import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap } from "@codemirror/commands";
import { css, cssLanguage } from "@codemirror/lang-css";
import {
  bracketMatching,
  ensureSyntaxTree,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { type Diagnostic, linter, lintGutter, lintKeymap } from "@codemirror/lint";
import { Annotation, EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { t } from "@webforge/i18n";
import {
  type CssLintData,
  type CssSiteData,
  cssDiagnostics,
  cssSiteCompletion,
} from "./css-language.js";

/** How long after the last keystroke the stylesheet is checked again. */
const LINT_DELAY_MS = 500;

/** How long a check may parse the rest of the stylesheet first. */
const LINT_PARSE_MS = 100;

/**
 * What's wrong in `state`'s stylesheet, once all of it is parsed: CodeMirror parses a while at a
 * time, and the part not yet parsed would read as invalid CSS, a mark nothing took away again
 * on a busy machine (#1096). Nothing while it isn't; the editor checks again once it is.
 */
export function lintStylesheet(state: EditorState, data: CssLintData): readonly Diagnostic[] {
  const tree = ensureSyntaxTree(state, state.doc.length, LINT_PARSE_MS);
  return tree === null ? [] : cssDiagnostics(state.doc.toString(), tree, data);
}

/** Marks a change the document made (undo, another window's edit), not the person's typing. */
const fromDocument = Annotation.define<boolean>();

/**
 * The editor's colours (CT-8): the window's own tokens, so it follows the light and dark themes,
 * and the canvas's code font. Its text size is its parent's (the Stylesheet panel's).
 */
const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--color-foreground)",
    backgroundColor: "var(--color-background)",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.5" },
  ".cm-content": { caretColor: "var(--color-foreground)" },
  "&.cm-focused": { outline: "2px solid var(--color-ring)", outlineOffset: "-2px" },
  ".cm-gutters": {
    backgroundColor: "var(--color-panel)",
    color: "var(--color-muted-foreground)",
    borderRight: "1px solid var(--color-border)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--color-hover)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--color-accent)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--color-popover)",
    color: "var(--color-popover-foreground)",
    border: "1px solid var(--color-border)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--color-accent)",
    color: "var(--color-accent-foreground)",
  },
});

/** CSS's parts in the window's text colours, each readable on its background in both themes. */
const highlighting = HighlightStyle.define([
  { tag: tags.comment, color: "var(--color-muted-foreground)", fontStyle: "italic" },
  // Selectors stand out by weight: the main colour is too light to read as text on the panel.
  { tag: [tags.className, tags.labelName, tags.tagName], fontWeight: "600" },
  { tag: [tags.propertyName, tags.variableName], color: "var(--color-foreground)" },
  { tag: [tags.string, tags.url], color: "var(--color-success)" },
  { tag: [tags.number, tags.unit, tags.color], color: "var(--color-destructive-text)" },
  { tag: [tags.keyword, tags.modifier, tags.atom], color: "var(--color-info)" },
]);

/** What the stylesheet editor reads as it goes, and where it says what was typed. */
export type CssEditorOptions = {
  /** The stylesheet as the document has it. */
  readonly css: string;
  /** Called with the whole stylesheet after each change the person types. */
  readonly onChange: (css: string) => void;
  /** The site's variables, classes and anchors, for completion. */
  readonly siteData: () => CssSiteData;
  /** What the lint reads besides the CSS. */
  readonly lintData: () => CssLintData;
};

/** The stylesheet editor in the page, and how to update it and take it away. */
export type CssEditor = {
  readonly view: EditorView;
  /** Shows `css` if it differs: the document changed it (undo, *Target this element*). */
  setCss(css: string): void;
  /** Puts the caret at `pos`, or the end if the stylesheet is shorter, scrolled into view, with the focus. */
  focusAt(pos: number): void;
  destroy(): void;
};

/**
 * The stylesheet editor (CT-8, 6.8): CodeMirror 6 with CSS, the site's completion and lint. It has
 * no history of its own: Undo and Redo are the window's (each pause one step), and the editor
 * shows what the document has after them.
 */
export function createCssEditor(parent: HTMLElement, options: CssEditorOptions): CssEditor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: options.css,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        css(),
        cssLanguage.data.of({
          autocomplete: cssSiteCompletion(options.siteData, (context) => syntaxTree(context.state)),
        }),
        autocompletion(),
        syntaxHighlighting(highlighting),
        linter((current) => lintStylesheet(current.state, options.lintData()), {
          delay: LINT_DELAY_MS,
          // Checked again as the parse goes on, not only as the stylesheet changes.
          needsRefresh: (update) => syntaxTree(update.startState) !== syntaxTree(update.state),
        }),
        lintGutter(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...completionKeymap, ...lintKeymap]),
        editorTheme,
        EditorView.contentAttributes.of({ "aria-label": t("stylesheet.editor") }),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          if (update.transactions.some((each) => each.annotation(fromDocument) === true)) return;
          options.onChange(update.state.doc.toString());
        }),
      ],
    }),
  });
  return {
    view,
    setCss(css) {
      const current = view.state.doc.toString();
      if (current === css) return;
      // Only the part that differs is replaced, so the caret stays where it was around it.
      let start = 0;
      while (start < current.length && start < css.length && current[start] === css[start]) {
        start += 1;
      }
      let end = 0;
      while (
        end < current.length - start &&
        end < css.length - start &&
        current[current.length - 1 - end] === css[css.length - 1 - end]
      ) {
        end += 1;
      }
      view.dispatch({
        changes: {
          from: start,
          to: current.length - end,
          insert: css.slice(start, css.length - end),
        },
        annotations: fromDocument.of(true),
      });
    },
    focusAt(pos) {
      const anchor = Math.min(Math.max(pos, 0), view.state.doc.length);
      view.dispatch({ selection: { anchor }, scrollIntoView: true });
      view.focus();
    },
    destroy: () => view.destroy(),
  };
}
