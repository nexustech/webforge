import type { FieldKind } from "@webforge/editor-ui";
import type { FieldDef } from "@webforge/site-components";

/**
 * How the editor edits each kind of field a component can have (2.20, B5). A new kind in
 * `FieldDef` fails the type check here until it is listed, and the field-kind test then checks it
 * has a renderer and a story.
 *
 * This is the checklist for a new kind (#979): docs/extending.md and docs/components.md link here.
 * Every kind touches the seven places `pnpm scaffold field-kind` writes:
 *
 * 1. `FieldDef`, `StoredOne` and `ValueOne` (packages/site-components/src/schema.ts): how it's
 *    described, what it stores, and what a component's render gets; and `FieldValueShape` and
 *    `fieldValueSchema` (field-values.ts): the values it may hold, which the Edit panel, its paste,
 *    list edits, canvas drags and AI apps all check (#667).
 * 2. `valueReader` (packages/site-components/src/define.ts): how render reads what is stored, and
 *    what it falls back to.
 * 3. `toPuckField` (packages/engine/src/puck/config.tsx): its Puck field, and a sample in the
 *    engine's every-kind test (config.test.tsx), which fails until it has one.
 * 4. `FieldSpecs` (packages/editor-ui/src/components/edit/field-spec.ts): what its Edit panel
 *    renderer needs, if the Edit panel draws it; and a field of it in the form engine's story
 *    (editor-ui's `form/form-engine.stories.tsx`), which lists every kind.
 * 5. Its renderer: the Edit panel's own (editor-ui's `edit/`), or the app's in `fields/<kind>/`,
 *    listed in `fieldRenderers` (field-renderers.ts).
 * 6. `specOf` (apps/desktop/src/renderer/editor/edit-panel-fields.ts): the Edit panel's spec for
 *    the field.
 * 7. A story of its renderer, next to it, and the kind in this list with the story's title.
 *
 * And, as the kind needs them:
 *
 * 8. `field-group.ts` (apps/desktop/src/renderer/editor): the Edit panel's tab and group for it,
 *    if it isn't Content.
 * 9. A file it holds: `placedIn` (apps/desktop/src/renderer/media/media-usage.ts) finds it, so
 *    Media counts it as placed and copying an element carries it to another site
 *    (`element-clipboard.ts`); `field-kind-files.test.ts` lists every kind, and fails to
 *    type-check until a new one says whether it holds a file.
 * 10. `render-static.tsx` (packages/site-components): if the export draws or collects it
 *    specially, as `mediaUsedBy` and `documentsLinkedBy` collect the files it copies.
 * 11. The model: a zod schema for a stored value that isn't a plain one, and a migration if old
 *    documents hold it another way.
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
  code: { editPanel: "code", story: "Edit/Fields/Code" },
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
