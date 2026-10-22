import { type Field, RichTextMenu } from "@puckeditor/core";
import type { ReactNode } from "react";

/** Puck's rich-text field, with the options and menus it takes. */
type RichtextField = Extract<Field, { type: "richtext" }>;

/** Link addresses rich text may hold: web pages, email and phone. Others are dropped, pasted too. */
const ALLOWED_LINK = /^(https?:|mailto:|tel:)/i;

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
    // Only the address: the exported page decides how a link opens.
    HTMLAttributes: { target: null, rel: null },
    isAllowedUri: (url) => ALLOWED_LINK.test(url),
  },
};

/**
 * The format toolbar shown over rich text being edited on the canvas (F-ED-3), in the selected
 * element's quick-action bar: bold and italic, the two lists, and left, centre and right alignment.
 */
export function FormatToolbar(_props: { readonly children: ReactNode }) {
  return (
    <RichTextMenu>
      <RichTextMenu.Group>
        <RichTextMenu.Bold />
        <RichTextMenu.Italic />
      </RichTextMenu.Group>
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
}

/** Puck's field for rich text, edited on the canvas when `inline`. */
export function richTextField(label: string, inline: boolean): RichtextField {
  return {
    type: "richtext",
    label,
    contentEditable: inline,
    options: RICH_TEXT_OPTIONS,
    renderInlineMenu: FormatToolbar,
  };
}
