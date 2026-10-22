import { type Field, RichTextMenu } from "@puckeditor/core";
import { t } from "@webforge/i18n";
import { RICH_TEXT_PAGE_LINK } from "@webforge/model";
import { LinkIcon, UnlinkIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { LinkPicker } from "../canvas-engine.js";

/** Puck's rich-text field, with the options and menus it takes. */
type RichtextField = Extract<Field, { type: "richtext" }>;

/** What Puck gives the format toolbar: the editor and its state. */
type ToolbarProps = Parameters<NonNullable<RichtextField["renderInlineMenu"]>>[0];

/**
 * Link addresses rich text may hold: the site's own pages, web pages, email and phone. Others are
 * dropped, pasted ones too.
 */
const ALLOWED_LINK = new RegExp(`^(https?:|mailto:|tel:|${RICH_TEXT_PAGE_LINK})`, "i");

/**
 * The formatting rich text allows (F-ED-3, C1): bold, italic, links, bullet and numbered lists
 * and alignment, in paragraphs. The editor's schema has nothing else, so text pasted from Word or a
 * web page keeps only that: headings become paragraphs, and fonts, colours, tables, images,
 * underline and the like are dropped. Puck always adds alignment itself.
 */
export const RICH_TEXT_OPTIONS: NonNullable<RichtextField["options"]> = {
  blockquote: false,
  code: false,
  codeBlock: false,
  heading: false,
  horizontalRule: false,
  strike: false,
  underline: false,
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
 * Draws the toolbar again on every change of `editor`'s content or selection, so the link buttons
 * follow the caret: Puck draws its menu again only for the formatting it tracks itself.
 */
function useRedrawOnChange(editor: ToolbarProps["editor"]): void {
  const [, setChanges] = useState(0);
  useEffect(() => {
    if (editor === null) return;
    const redraw = () => setChanges((count) => count + 1);
    editor.on("transaction", redraw);
    return () => {
      editor.off("transaction", redraw);
    };
  }, [editor]);
}

/**
 * The link button: asks the app for a link (through `pick`) and sets it on the selected text, or
 * changes the link at the caret. Without text selected or a link to change, there's nothing to link.
 */
function LinkControl({ editor, pick }: { editor: ToolbarProps["editor"]; pick: LinkPicker }) {
  const isLink = editor?.isActive("link") === true;
  return (
    <RichTextMenu.Control
      icon={<LinkIcon size={16} />}
      title={t("canvas.richText.link")}
      active={isLink}
      disabled={editor === null || (editor.state.selection.empty && !isLink)}
      onClick={async (event) => {
        event.stopPropagation();
        if (editor === null) return;
        const { href, target } = editor.getAttributes("link");
        const current = typeof href === "string" ? { href, newTab: target === "_blank" } : null;
        const next = await pick(current);
        const chain = editor.chain().focus().extendMarkRange("link");
        if (next === null) {
          chain.unsetLink().run();
        } else if (next !== undefined) {
          chain.setLink({ href: next.href, target: next.newTab ? "_blank" : null }).run();
        } else {
          chain.run();
        }
      }}
    />
  );
}

/**
 * The format toolbar shown over rich text being edited on the canvas (F-ED-3), in the selected
 * element's quick-action bar: bold and italic, a link and its removal (when the app picks links,
 * `picker()`), the two lists, and left, centre and right alignment.
 */
export function createFormatToolbar(picker: () => LinkPicker | null) {
  return function FormatToolbar({ editor }: ToolbarProps) {
    useRedrawOnChange(editor);
    const pick = picker();
    return (
      <RichTextMenu>
        <RichTextMenu.Group>
          <RichTextMenu.Bold />
          <RichTextMenu.Italic />
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

/** Puck's field for rich text, edited on the canvas when `inline`, with `toolbar` over it. */
export function richTextField(
  label: string,
  inline: boolean,
  toolbar: RichtextField["renderInlineMenu"] = FormatToolbar,
): RichtextField {
  return {
    type: "richtext",
    label,
    contentEditable: inline,
    options: RICH_TEXT_OPTIONS,
    renderInlineMenu: toolbar,
  };
}
