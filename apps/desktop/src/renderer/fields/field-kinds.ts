import type { FieldKind } from "@webforge/editor-ui";
import type { FieldDef } from "@webforge/site-components";

/**
 * How the editor edits each kind of field a component can have (2.20, B5). A new kind in
 * `FieldDef` fails the type check here until it is listed, and the field-kind test then checks it
 * has a renderer and a story. A new kind touches seven places:
 *
 * 1. `FieldDef`, `StoredOne` and `ValueOne` (packages/site-components/src/schema.ts): how it's
 *    described, what it stores, and what a component's render gets.
 * 2. `valueReader` (packages/site-components/src/define.ts): how render reads what is stored, and
 *    what it falls back to.
 * 3. `toPuckField` (packages/engine/src/puck/config.tsx): its Puck field, and a sample in the
 *    engine's every-kind test (config.test.tsx), which fails until it has one.
 * 4. `FieldSpecs` (packages/editor-ui/src/components/edit/field-spec.ts): what its Edit panel
 *    renderer needs, if the Edit panel draws it.
 * 5. Its renderer: the Edit panel's own (editor-ui's `edit/`), or the app's in `fields/<kind>/`,
 *    listed in `fieldRenderers` (field-renderers.ts).
 * 6. `specOf` and `accepts` (apps/desktop/src/renderer/editor/EditPanelHost.tsx): the Edit panel's
 *    spec for the field, and the values it accepts.
 * 7. A story of its renderer, next to it, and the kind in this list with the story's title.
 *
 * Its words go through `t()` (the glossary, research/product/01-terminology.md).
 */
export const FIELD_KINDS = {
  text: { editPanel: "text", story: "Edit/Fields/Text" },
  richtext: { editedOn: "canvas", why: "Edited where it is, with its format toolbar (1.23)." },
  select: { editPanel: "select", story: "Edit/Fields/Select" },
  toggle: { editPanel: "toggle", story: "Edit/Fields/Toggle" },
  slider: { editPanel: "slider", story: "Edit/Fields/Slider" },
  color: { editPanel: "color", story: "Edit/Fields/Colour" },
  spacing: { editPanel: "spacing", story: "Edit/Fields/Choice" },
  box: { editPanel: "box", story: "Edit/Fields/Box" },
  // Elements are dragged into a slot; one holding a single type (a FAQ's questions) is a list too.
  slot: { editPanel: "list", story: "Edit/Fields/List" },
  media: { editPanel: "image", story: "Edit/ImageField" },
  link: { editPanel: "link", story: "Edit/Fields/Link" },
  icon: { editPanel: "icon", story: "Edit/Fields/Icon" },
  list: { editPanel: "list", story: "Edit/Fields/List" },
} as const satisfies { readonly [K in FieldDef["kind"]]: FieldKindEditing };

/** How the editor edits one kind of field: in the Edit panel, by a renderer, or elsewhere. */
type FieldKindEditing =
  | {
      /** The Edit panel renderer that draws it. */
      readonly editPanel: FieldKind;
      /** The Storybook title of that renderer's story. */
      readonly story: string;
    }
  | { readonly editedOn: "canvas"; readonly why: string };
