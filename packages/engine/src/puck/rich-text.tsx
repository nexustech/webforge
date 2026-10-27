import { type Field, RichTextMenu } from "@puckeditor/core";
import { Extension, type Extensions } from "@tiptap/core";
import { t } from "@webforge/i18n";
import {
  RICH_TEXT_FILE_LINK,
  RICH_TEXT_PAGE_LINK,
  TEXT_MARK_ROLES,
  type TextMarkRole,
} from "@webforge/model";
import { LinkIcon, UnlinkIcon } from "lucide-react";
import { useEditorState } from "./editor-state.js";
import { type PickLink, pickLinkInto } from "./text-keys.js";
import { type TextMarkName, ThemeColor, ThemeHighlight } from "./text-marks.js";

/** Puck's rich-text field, with the options and menus it takes. */
type RichtextField = Extract<Field, { type: "richtext" }>;

/** What Puck gives the format toolbar: the editor and its state. */
type ToolbarProps = Parameters<NonNullable<RichtextField["renderInlineMenu"]>>[0];

/**
 * Link addresses rich text may hold: the site's own pages and documents (1.28), web pages, email
 * and phone. Others are dropped, pasted ones too.
 */
const ALLOWED_LINK = new RegExp(
  `^(https?:|mailto:|tel:|${RICH_TEXT_PAGE_LINK}|${RICH_TEXT_FILE_LINK})`,
  "i",
);

/**
 * The formatting rich text allows (F-ED-3, C1, ST-3): bold, italic, underline, links, bullet and
 * numbered lists and alignment, in paragraphs, and a highlight or text colour from the theme's roles
 * (`text-marks.ts`). The editor's schema has nothing else, so text pasted from Word or a web page
 * keeps only that: headings become paragraphs, and fonts, colours of their own, tables, images,
 * strikethrough and the like are dropped. Puck always adds alignment itself.
 */
export const RICH_TEXT_OPTIONS: NonNullable<RichtextField["options"]> = {
  blockquote: false,
  code: false,
  codeBlock: false,
  heading: false,
  horizontalRule: false,
  strike: false,
  // Mod+U (ST-3). Site Check's tip says underlined text can be taken for a link.
  underline: {},
  link: {
    // A click in the editor places the caret; it doesn't follow the link.
    openOnClick: false,
    autolink: false,
    // The address, and `target="_blank"` where the link dialog asks for a new tab; no `rel` (the
    // export adds `noopener`).
    HTMLAttributes: { target: null, rel: null },
    isAllowedUri: (url) => ALLOWED_LINK.test(url),
  },
};

/**
 * The link button: asks the app for a link (through `pick`) and sets it on the selected text, or
 * changes the link at the caret. Without text selected or a link to change, there's nothing to link.
 */
function LinkControl({ editor, pick }: { editor: ToolbarProps["editor"]; pick: PickLink }) {
  const isLink = editor?.isActive("link") === true;
  return (
    <RichTextMenu.Control
      icon={<LinkIcon size={16} />}
      title={t("canvas.richText.link")}
      active={isLink}
      disabled={editor === null || (editor.state.selection.empty && !isLink)}
      onClick={async (event) => {
        event.stopPropagation();
        if (editor !== null) await pickLinkInto(editor, pick);
      }}
    />
  );
}

/**
 * A theme role's colour for the selected text, as `name`'s mark (ST-3): None or one of the roles.
 * A native select, so it reads and works as one from the keyboard and to assistive technology.
 */
function RoleSelect({ editor, name }: { editor: ToolbarProps["editor"]; name: TextMarkName }) {
  const role = (editor?.getAttributes(name).role ?? "") as TextMarkRole | "";
  const label = t(
    name === "themeHighlight" ? "canvas.richText.highlight" : "canvas.richText.color",
  );
  return (
    <select
      aria-label={label}
      title={label}
      value={role}
      disabled={editor === null}
      onMouseDown={(event) => event.stopPropagation()}
      onChange={(event) => {
        const next = event.currentTarget.value as TextMarkRole | "";
        if (editor === null) return;
        const chain = editor.chain().focus();
        (next === "" ? chain.unsetMark(name) : chain.setMark(name, { role: next })).run();
      }}
    >
      <option value="">
        {t(`canvas.richText.${name === "themeHighlight" ? "highlight" : "color"}.none`)}
      </option>
      {TEXT_MARK_ROLES.map((each) => (
        <option key={each} value={each}>
          {t(`canvas.richText.role.${each}`)}
        </option>
      ))}
    </select>
  );
}

/**
 * The format toolbar shown over rich text being edited on the canvas (F-ED-3), in the selected
 * element's quick-action bar: bold, italic and underline, a highlight and a text colour from the
 * theme (ST-3), a link and its removal (when the app picks links, `picker()`), the two lists, and
 * left, centre and right alignment.
 */
export function createFormatToolbar(picker: () => PickLink | null) {
  return function FormatToolbar({ editor }: ToolbarProps) {
    // Drawn again on every change of the content or selection, so the link buttons follow it.
    useEditorState(editor);
    const pick = picker();
    return (
      <RichTextMenu>
        <RichTextMenu.Group>
          <RichTextMenu.Bold />
          <RichTextMenu.Italic />
          <RichTextMenu.Underline />
        </RichTextMenu.Group>
        <RichTextMenu.Group>
          <RoleSelect editor={editor} name="themeHighlight" />
          <RoleSelect editor={editor} name="themeColor" />
        </RichTextMenu.Group>
        {pick === null ? null : (
          <RichTextMenu.Group>
            <LinkControl editor={editor} pick={pick} />
            {editor?.isActive("link") === true ? (
              <RichTextMenu.Control
                icon={<UnlinkIcon size={16} />}
                title={t("canvas.richText.removeLink")}
                onClick={(event) => {
                  event.stopPropagation();
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                }}
              />
            ) : null}
          </RichTextMenu.Group>
        )}
        <RichTextMenu.Group>
          <RichTextMenu.BulletList />
          <RichTextMenu.OrderedList />
        </RichTextMenu.Group>
        <RichTextMenu.Group>
          <RichTextMenu.AlignLeft />
          <RichTextMenu.AlignCenter />
          <RichTextMenu.AlignRight />
        </RichTextMenu.Group>
      </RichTextMenu>
    );
  };
}

/** The format toolbar without links, for an editor no app picks links for. */
export const FormatToolbar = createFormatToolbar(() => null);

/**
 * Names rich text's editor after its field (#465), as the Edit panel labels it ("Text"): an editor
 * is a text box to assistive technology, which announces it by its name. ProseMirror keeps the
 * attribute, as it changes only the ones it sets itself.
 */
function editorName(label: string) {
  return Extension.create({
    name: "webforgeEditorName",
    onCreate() {
      this.editor.view.dom.setAttribute("aria-label", label);
    },
  });
}

/**
 * Puck's field for rich text, edited on the canvas when `inline`, with `toolbar` over it and
 * `extensions` in its editor (the text keys), named after its field.
 */
export function richTextField(
  label: string,
  inline: boolean,
  toolbar: RichtextField["renderInlineMenu"] = FormatToolbar,
  extensions: Extensions = [],
): RichtextField {
  return {
    type: "richtext",
    label,
    contentEditable: inline,
    options: RICH_TEXT_OPTIONS,
    renderInlineMenu: toolbar,
    tiptap: { extensions: [editorName(label), ThemeHighlight, ThemeColor, ...extensions] },
  };
}
