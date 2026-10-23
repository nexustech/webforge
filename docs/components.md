# Writing a site component

Site components are what people place on their pages: sections such as a Hero, and elements such as a Heading. They live in `packages/site-components`. One render function draws each component on the canvas and in the exported site (ADR 0005), so what people see while editing is what they publish.

This page is the template for adding one (2.5). The rules come from the engineering standards (§5), the MVP spec (§3) and the decisions they name.

## Where it goes

- **One module per family:** components live in `src/catalogue/`, one file per family: `basic.tsx` (Section, Heading, Text), `layout.tsx` (Header, Footer) and `sections.tsx` (Hero, FAQ).
- **A new family:** add a module and list it in `createLibrary` in `src/catalogue/index.ts`. Streams adding components in parallel then never edit the same file.
- **Each module ends with its family:** a record from component type to definition, e.g. `export const basicComponents = { Section: section, Heading: heading, Text: text }`.
- **Component types** (`Hero`, `Faq`) are stored in every site file, so never rename one; add a migration if one must change.

## Defining it

Wrap the definition in `defineComponent`. It checks the conventions as the module loads, so a mistake fails every test that uses the library instead of reaching a site.

```tsx
import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { optionValue, slotComponent, textValue } from "../library.js";

const COLUMNS = ["two", "three"] as const;

/** Cards side by side: a title over a grid of elements. */
const cards = defineComponent({
  // D2: the display name, from the glossary (research/product/01-terminology.md), via t().
  label: t("section.cards"),
  // A band of the page; an element (the default) goes inside sections.
  place: "section",
  category: t("category.basic"),
  // Layout variants become a Style choice, "Layout", defaulting to the first.
  variants: COLUMNS.map((value) => ({ label: t(`field.columns.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    // A token per device (F-ED-4): only design tokens may differ per device.
    gap: {
      kind: "slider",
      label: t("field.gap"),
      responsive: true,
      steps: ["small", "medium"].map((value) => ({ label: t(`field.gap.${value}`), value })),
    },
    // Every element of the library, those added later too.
    items: { kind: "slot", label: t("field.content"), accepts: "element" },
  },
  defaults: { title: t("starter.cardsTitle"), gap: "medium", items: [] },
  render: (props) => {
    const Items = slotComponent(props, "items");
    const columns = optionValue(props.values.variant, COLUMNS);
    return (
      <section className="site-cards mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold">{textValue(props.values.title)}</h2>
        <div className={columns === "two" ? "grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-3"}>
          <Items />
        </div>
      </section>
    );
  },
});
```

### What `defineComponent` refuses

- **No display name (D2):** every component has a label, already translated.
- **A free value as a style (C4):** a field in the Style group, given or by its kind, must be a design token. That means `select`, `toggle`, `slider`, `color`, `spacing` or `box`; never a typed value.
- **A free value per device (F-ED-4):** only design tokens may be `responsive`.
- **Broken choices:** a `select`, `color`, `spacing` or `slider` field must offer choices, each once, and its default must be one of them.
- **A default for nothing:** every default is for a field.
- **A missing behaviour:** each name in `behaviours` must be a file in `src/behaviours/`.
- **A clash with variants:** with `variants`, no field of its own may be named `variant`.

### Fields

`FieldDef` in `src/library.ts` lists the kinds:

- **Content:** `text` and `richtext`, which can be edited on the canvas with `inline`. `text` can also be bound to a Site Settings value with `bindable`.
- **Media and links:** `media` (an image from Media, rendered with `Picture`) and `link` (rendered with `linkAttributes`).
- **Repeating content:** `list`, for repeating plain values.
- **Containers:** `slot`, for elements inside. Give a slot `accepts: "element"` to take every element, or `allow` for a fixed set (an FAQ's questions).
- **Spacing:** padding and margin per side use `box`, with `PADDING_FIELD` and `MARGIN_FIELD` from `basic.tsx`, rendered by `boxClasses`.

### Rendering

- **Markup:** daisyUI 5 component classes and Tailwind utilities only, chosen from the field's token, never built from what the person typed.
- **Class names in full:** write each class out (`"md:grid-cols-3"`) so the export's CSS build finds it. Never assemble one (`` `md:grid-cols-${n}` ``).
- **Static HTML that works without JavaScript:** an FAQ is a `<details>`, and a menu shows on focus until its script runs.
- **Behaviours:** a component that needs a script names it in `behaviours`. Each is a plain, readable classic script in `src/behaviours/<name>.js`, a self-contained IIFE (decisions X1, X4). The export's `webforge.js` includes only the behaviours its pages use.
- **No external requests (C8):** icons are inline SVG, and fonts and images come with the site.
- **Context:** `props.context` resolves links, images and settings. On the canvas they go nowhere; in the export they're the site's.

## Stories

Every component has stories for its main variants, next to it in `src/catalogue/<family>.stories.tsx`.

- **Rendering:** stories render with `SiteNodes` (`src/stories/site-nodes.tsx`), the export's own renderer, so a story is what a site shows. Its context has a navigation, the image `photo` and the site name.
- **Running them:** `pnpm --filter @webforge/site-components storybook` opens them, with toolbars for the theme and the device width.
- **Visual checks:** `pnpm visual` runs axe on every story in each theme on Desktop and Mobile. CI's Linux container also compares screenshots; a new story's screenshots come back as the `visual-screenshots` artifact to commit.

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SiteNodes } from "../stories/site-nodes.js";

const meta = { title: "Site components/Basic", component: SiteNodes } satisfies Meta<typeof SiteNodes>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Cards in three columns. */
export const Cards: Story = {
  args: {
    nodes: [{ type: "Cards", props: { id: "cards", title: "Our cakes", variant: "three", items: [] } }],
  },
};
```

## Checklist

- [ ] **Module:** a module in `src/catalogue/` (or added to its family's), and its family listed in `index.ts`.
- [ ] **`defineComponent`:** the label and field labels go through `t()`, with English text in `packages/i18n/src/en/components.ts`.
- [ ] **Stories:** for its variants, passing axe in every theme on Desktop and Mobile.
- [ ] **Tests:** unit tests for anything its render works out. The export's golden files change only on purpose.
- [ ] **Edit panel:** each field shows in the Edit panel with a meaningful undo label ("Changed Cards layout").
