import { Mark } from "@tiptap/core";
import {
  HIGHLIGHT_CLASSES,
  TEXT_COLOR_CLASSES,
  TEXT_MARK_ROLES,
  type TextMarkRole,
} from "@webforge/model";

/** A text mark's name in the editor: a highlight, or a text colour (2.25, ST-3). */
export type TextMarkName = "themeHighlight" | "themeColor";

/** The class each role writes, for each mark. */
export const TEXT_MARK_CLASSES_BY_NAME: Readonly<
  Record<TextMarkName, Readonly<Record<TextMarkRole, string>>>
> = {
  themeHighlight: HIGHLIGHT_CLASSES,
  themeColor: TEXT_COLOR_CLASSES,
};

/** The role whose class `className` is, for `name`'s mark: a span with exactly that class. */
function roleOf(name: TextMarkName, className: string | null): TextMarkRole | undefined {
  const classes = TEXT_MARK_CLASSES_BY_NAME[name];
  return TEXT_MARK_ROLES.find((role) => classes[role] === className?.trim());
}

/**
 * A mark of a theme role's colour (2.25, ST-3): a `span` with its class, never a style. Only a span
 * whose class is exactly one of the role's classes reads as one, so formatting pasted from Word or
 * a web page (spans with styles, other classes) keeps its text and loses the rest.
 */
function roleMark(name: TextMarkName) {
  return Mark.create({
    name,
    addAttributes() {
      return { role: { default: null, rendered: false } };
    },
    parseHTML() {
      return [
        {
          tag: "span[class]",
          getAttrs: (element) => {
            const role = roleOf(name, element.getAttribute("class"));
            return role === undefined ? false : { role };
          },
        },
      ];
    },
    renderHTML({ mark }) {
      const role = mark.attrs.role as TextMarkRole | null;
      const className = role === null ? undefined : TEXT_MARK_CLASSES_BY_NAME[name][role];
      return ["span", className === undefined ? {} : { class: className }, 0];
    },
  });
}

/** The highlight mark: a soft wash of a theme role's colour behind the text. */
export const ThemeHighlight = roleMark("themeHighlight");

/** The text colour mark: a theme role's colour for the text. */
export const ThemeColor = roleMark("themeColor");
