import type { Dictionary } from "@puckeditor/core";
import { type MessageKey, t } from "@webforge/i18n";

/**
 * Puck's UI strings (keys of Puck 0.23's `defaultDictionary`) and the i18n keys that replace them.
 * Check this list against Puck's `defaultDictionary` when upgrading Puck: a key missing here falls
 * back to Puck's English text.
 */
export const PUCK_MESSAGES = {
  "header-publish": "puck.header.publish",
  "header-undo": "puck.header.undo",
  "header-redo": "puck.header.redo",
  "header-toggle-leftsidebar": "puck.header.toggleLeftSidebar",
  "header-toggle-rightsidebar": "puck.header.toggleRightSidebar",
  "header-toggle-menubar": "puck.header.toggleMenuBar",
  "action-selectparent": "puck.action.selectParent",
  "action-duplicate": "puck.action.duplicate",
  "action-delete": "puck.action.delete",
  "label-page": "puck.label.page",
  "label-component": "puck.label.element",
  "outline-empty": "puck.layers.empty",
  "outline-item-collapse": "puck.layers.collapse",
  "outline-item-expand": "puck.layers.expand",
  "outline-header-title": "puck.layers.title",
  "outline-header-collapseall": "puck.layers.collapseAll",
  "outline-item-duplicate": "puck.layers.duplicate",
  "outline-item-delete": "puck.layers.delete",
  "drawer-category-collapse": "puck.add.collapseCategory",
  "drawer-category-expand": "puck.add.expandCategory",
  "drawer-category-other": "puck.add.otherCategory",
  "canvas-noconfig": "puck.canvas.unknownElement",
  "field-readonly": "puck.field.readOnly",
  "field-arrayitem-summary": "puck.field.listItem",
  "field-arrayitem-duplicate": "puck.field.listItemDuplicate",
  "field-arrayitem-delete": "puck.field.listItemDelete",
  "field-external-selectdata": "puck.field.external.select",
  "field-external-search": "puck.field.external.search",
  "field-external-togglefilters": "puck.field.external.toggleFilters",
  "field-external-item": "puck.field.external.item",
  "field-external-result-singular": "puck.field.external.resultOne",
  "field-external-result-plural": "puck.field.external.resultMany",
  "field-richtext-bold": "puck.richText.bold",
  "field-richtext-italic": "puck.richText.italic",
  "field-richtext-underline": "puck.richText.underline",
  "field-richtext-strikethrough": "puck.richText.strikethrough",
  "field-richtext-blockquote": "puck.richText.quote",
  "field-richtext-code-inline": "puck.richText.inlineCode",
  "field-richtext-code-block": "puck.richText.codeBlock",
  "field-richtext-list-bullet": "puck.richText.bulletList",
  "field-richtext-list-ordered": "puck.richText.numberedList",
  "field-richtext-horizontalrule": "puck.richText.divider",
  "field-richtext-align-left": "puck.richText.alignLeft",
  "field-richtext-align-center": "puck.richText.alignCentre",
  "field-richtext-align-right": "puck.richText.alignRight",
  "field-richtext-align-justify": "puck.richText.justify",
  "field-richtext-select": "puck.richText.select",
  "field-richtext-headingselect-1": "puck.richText.heading1",
  "field-richtext-headingselect-2": "puck.richText.heading2",
  "field-richtext-headingselect-3": "puck.richText.heading3",
  "field-richtext-headingselect-4": "puck.richText.heading4",
  "field-richtext-headingselect-5": "puck.richText.heading5",
  "field-richtext-headingselect-6": "puck.richText.heading6",
  "field-richtext-alignselect-left": "puck.richText.left",
  "field-richtext-alignselect-center": "puck.richText.centre",
  "field-richtext-alignselect-right": "puck.richText.right",
  "field-richtext-alignselect-justify": "puck.richText.justify",
  "field-richtext-listselect-bullet": "puck.richText.bulletList",
  "field-richtext-listselect-ordered": "puck.richText.numberedList",
  "viewport-zoom-in": "puck.view.zoomIn",
  "viewport-zoom-out": "puck.view.zoomOut",
  "viewport-zoom-auto": "puck.view.zoomAuto",
  "viewport-toggle-menu": "puck.view.toggleMenu",
  "viewport-switch": "puck.view.switchTo",
  "viewport-switch-default": "puck.view.switch",
  "plugin-blocks": "puck.panel.add",
  "plugin-outline": "puck.panel.layers",
  "plugin-fields": "puck.panel.edit",
  "plugin-components": "puck.panel.elements",
  "layout-maximize": "puck.layout.maximize",
  "layout-minimize": "puck.layout.minimize",
  "loader-loading": "puck.loading",
} as const satisfies Readonly<Record<string, MessageKey>>;

/**
 * Puck's UI text from the i18n catalogue, for `<Puck dictionary>`. Placeholders such as `{title}`
 * are left in place for Puck to fill in.
 */
export function puckDictionary(): Dictionary {
  return Object.fromEntries(
    Object.entries(PUCK_MESSAGES).map(([puckKey, key]) => [puckKey, t(key)]),
  );
}
