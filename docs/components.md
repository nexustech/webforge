# Writing a site component

Site components are what people place on their pages: sections such as a Hero, and elements such as a Heading. They live in `packages/site-components`. One render function draws each component on the canvas and in the exported site (ADR 0005), so what people see while editing is what they publish.

This page is the template for adding one (2.5). The rules come from the engineering standards (§5), the MVP spec (§3) and the decisions they name.

## Starting one: `pnpm new-component`

```bash
pnpm new-component PriceList --place section
```

It writes a new family for the component, from the primitives below, and registers it:
- `src/catalogue/price-list.tsx`: the component, with `defineSection` (or `defineComponent` for `--place element` or `child`);
- `src/catalogue/price-list.stories.tsx` and `price-list.test.tsx`: a story and a test that render it with its defaults;
- `packages/i18n/src/en/components/priceList.ts`: its strings;
- the family's lines in `src/catalogue/index.ts` and in the strings' `components/index.ts`.

What it writes passes `pnpm check` and renders in Storybook as it is; then make it the component. The type (`PriceList`) is stored in every site file, so choose it with care. A child (`--place child`) is an item of another component's repeating list: add its type to that slot's `allow`.

## Where it goes

- **One module per family:** components live in `src/catalogue/`, one file per family: `basic.tsx` (Section, Heading, Text), `layout.tsx` (Header, Footer), `sections.tsx` (Hero, Text, Text + Image, Call to action, FAQ), `carousel.tsx` (Carousel) and `gallery.tsx` (Gallery).
- **A new family:** add a module and list it in `createLibrary` in `src/catalogue/index.ts` (`pnpm new-component` does both). Streams adding components in parallel then never edit the same file.
- **Its strings:** in a file of its own, `packages/i18n/src/en/components/<family>.ts`, listed in that folder's `index.ts` (2.19). Strings several families use (`field.title`, the spacing and colour choices, the starter page) are in `shared.ts`. A test fails on a key in two files.
- **Each module ends with its family:** a record from component type to definition, e.g. `export const basicComponents = { Section: section, Heading: heading, Text: text }`.
- **Component types** (`Hero`, `Faq`) are stored in every site file, so never rename one; add a migration if one must change.

## Defining it

Wrap an element's definition in `defineComponent`, and a section's in `defineSection` (2.19), which is `defineComponent` with the section's frame added (see [The section frame](#the-section-frame)).
- **Typed by its fields (R7):** `fields` type the rest. A default for a field the component doesn't have, or a choice a field doesn't offer, is a type error. `render` gets `values` and `slots` typed by them, so it reads `values.variant` as `"two" | "three"`, with no narrowing of its own.
- **Read from whatever the document holds:** a site file can hold anything. `defineComponent` gives `render` each value in its field's form:
  - a choice not offered becomes the default, else the first choice;
  - a toggle becomes `false`;
  - text becomes something to render;
  - an invalid image or link is left out;
  - an empty slot renders nothing.
- **Checked as the module loads:** `defineComponent` checks the conventions as the module loads, so a mistake fails every test that uses the library instead of reaching a site.

```tsx
import { t } from "@webforge/i18n";
import { defineSection } from "../frame.js";
import { SectionTitle } from "../typography.js";

const COLUMNS = ["two", "three"] as const;

/** Cards side by side: a title over a grid of elements. */
const cards = defineSection({
  // D2: the display name, from the glossary (research/product/01-terminology.md), via t().
  label: t("section.cards"),
  // Its `site-cards` class, which exported pages and tests find it by.
  name: "cards",
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
    // No padding or margin: defineSection adds them.
  },
  defaults: { title: t("starter.cardsTitle"), gap: "medium", items: [] },
  // The frame's classes: its background and layout.
  frame: () => "bg-base-100",
  // The inside of the frame. `values` and `slots` are typed by `fields`.
  render: ({ values, slots }) => {
    const Items = slots.items;
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <SectionTitle>{values.title}</SectionTitle>
        {/* The slot's class goes on the element that holds its elements: see Slots below. */}
        <Items className={values.variant === "two" ? "grid gap-6 md:grid-cols-2" : "grid gap-6 md:grid-cols-3"} />
      </div>
    );
  },
});
```

### The section frame

Every section is defined with `defineSection` (`src/frame.tsx`), and `defineComponent` refuses `place: "section"`, so every section has the same frame and the same frame fields:
- **Its colours:** `COLORS_FIELD` (2.4, F-DS-3), *Page colours* or *Reversed*. A reversed section gets `data-theme="wf_inverse"` (`INVERSE_THEME` from `@webforge/model`), daisyUI's nested theme of the theme's inverse colours, so its background, text and every colour class inside it take those. A section declaring a `colors` field is refused.
- **Its padding and margin:** `PADDING_FIELD` and `MARGIN_FIELD` (1.32), added after its own fields. A section declaring either is refused. The canvas's spacing handles and the Edit panel's spacing fields work on every section alike.
- **Its frame:** `<section class="site-<name> <frame classes> <padding> <margin>">` (with `data-theme` when reversed), with the padding from `SECTION_PADDING` (`px-4 py-16`) for the sides left unset. `frame` gives its background and layout classes from its values ("hero bg-base-200"); `frameAttributes` gives attributes its behaviour needs.
- **Its inside:** `render` draws what goes in the frame.
- **Elements:** an element takes `margin: MARGIN_FIELD` (from `frame.tsx`) and draws `marginClasses(values.margin)` itself.

### Titles, text and buttons

`src/typography.tsx` is the one source of the catalogue's title, body-text and button classes, where the theme's type scale (2.3) lands. A test renders every component in each layout and fails on any other title, running-text or button classes.
- **Titles:** `<SectionTitle>` (a section's h2), `size="page"` (the Hero's h1) or `size="small"` (h3), from `TITLE_CLASSES`. The Heading element uses the same classes.
- **Running text:** `<BodyText>` for paragraphs (`BODY_TEXT_CLASSES`), with a placing class if needed (`className="mt-4"`).
- **Buttons:** `<ButtonLink label link context kind>` for a link drawn as a button (nothing when its label is empty), or `BUTTON_CLASSES` for other buttons: `primary`, `primarySmall`, `primaryLarge`, and the icon buttons `icon`, `iconSmall` and `menu`. Placing classes come after them (`` `${BUTTON_CLASSES.primary} hidden md:inline-flex` ``).

### What `defineComponent` refuses

As it types (R7), and again as the module loads for specs typed loosely:
- **A default for nothing:** every default is for a field.
- **A default that isn't a choice:** a `select`, `spacing` or `slider` default must be one of its choices.

As the module loads:
- **No display name (D2):** every component has a label, already translated.
- **A free value as a style (C4):** a field in the Style group, given or by its kind, must be a design token. That means `select`, `toggle`, `slider`, `color`, `spacing` or `box`; never a typed value.
- **A free value per device (F-ED-4):** only design tokens may be `responsive`.
- **Broken choices:** a `select`, `color`, `spacing` or `slider` field must offer choices, each once, and its default must be one of them.
- **A missing behaviour:** each name in `behaviours` must be a file in `src/behaviours/`.
- **A clash with variants:** with `variants`, no field of its own may be named `variant`.
- **A section without its frame (2.19):** `place: "section"` must come through `defineSection`, which refuses a field of its own named `padding` or `margin`.

### Fields

`FieldDef` in `src/schema.ts` lists the kinds. `FieldValue` says what `render` gets for each, and `StoredValue` what a site file stores. A field shared by several components is a constant with `as const satisfies FieldDef` (like `PADDING_FIELD`), so it keeps its kind and the components' values stay typed.

- **Content:** `text` and `richtext`, which can be edited on the canvas with `inline`. `text` can also be bound to a Site Settings value with `bindable`.
- **Media and links:** `media` (an image from Media, rendered with `Picture`) and `link` (rendered with `linkAttributes`).
- **Repeating content:** `list`, for repeating plain values.
- **Containers:** `slot`, for elements inside. Give a slot `accepts: "element"` to take every element, or `allow` for a fixed set (an FAQ's questions).
  - **Laying out a slot's elements:** pass a class to the slot (`<Items className="grid md:grid-cols-3" />`). It goes on the element that holds them, Puck's drop zone on the canvas and a `<div>` in the export, so a grid lays them out alike in both. A class on an element around `<Items />` would reach only the drop zone on the canvas.
- **Spacing:** padding and margin per side use `box`, with `PADDING_FIELD` and `MARGIN_FIELD` from `basic.tsx`, rendered by `boxClasses` and `marginClasses`.
  - Every section takes both.
  - Every element takes `margin: MARGIN_FIELD`, since its sides are its section's.

### Repeating items: a `list` or child elements

- **Child elements (slot plus child):** use these when an item has an image, a link, its own spacing, or text people should edit on the canvas. Examples are an FAQ question, a Carousel's slide (2.10), a testimonial with a photo or a gallery image.
  - The items are components of their own with `place: "child"` (`pnpm new-component <Name> --place child`).
  - The parent holds them in a slot that `allow`s just that type.
  - The Edit panel still edits them as a list, and each one gets a row in Layers.
- **A `list` field:** use this for short plain values, such as opening hours or a price list's lines.
  - Its items can only hold `text`, `select`, `toggle`, `slider`, `color` and `spacing` values (`ListItemFieldDef`), edited in the Edit panel's rows, not on the canvas.

### Rendering

- **Markup:** daisyUI 5 component classes and Tailwind utilities only, chosen from the field's token, never built from what the person typed.
- **Class names in full:** write each class out (`"md:grid-cols-3"`), never assembled (`` `md:grid-cols-${n}` ``), so the Storybook's Tailwind scan finds it, and so the code reads as the HTML it gives.
  - The export and the canvas compile the classes in the rendered HTML, so they don't need it.
  - `boxClasses` is the one exception: its classes are listed for the Storybook (`@source inline` in `.storybook/preview.css`, which a test keeps complete).
- **Static HTML that works without JavaScript:** an FAQ is a `<details>`, and a menu shows on focus until its script runs.
- **Reading order is the document's order:** the keyboard and screen readers follow the HTML, not where the layout puts things. CSS columns (the Gallery's "Natural shapes") fill down each column, so its items read down the first column, then the next; a grid reads along each row. Prefer a grid where the order matters, and say so in the component's description where it doesn't.
- **Behaviours:** a component that needs a script names it in `behaviours`. Each is a plain, readable classic script in `src/behaviours/<name>.js`, a self-contained IIFE (decisions X1, X4). The export's `webforge.js` includes only the behaviours its pages use.
  - **Type-checked as written (R7):** `tsconfig.behaviours.json` checks each file with the DOM's types (`checkJs`), with no `@ts-check` line, so sites get the script as it is. Give the types TypeScript can't work out in JSDoc (`/** @param {boolean} open */`).
  - **Unit-tested:** `src/behaviours/<name>.test.ts` renders the component with the export's renderer into a happy-dom page of its own, runs the script on it, and checks what it does: `aria-expanded`, the focus, Escape.
  - **After adding or changing one, run `pnpm behaviours`.** It writes `src/behaviours/index.ts`, the scripts as strings, so the package loads without Vite. A test fails while it's out of date.
- **No external requests (C8):** icons are inline SVG, and fonts and images come with the site.
- **Context:** `props.context` resolves links, images and settings. On the canvas they go nowhere; in the export they're the site's.

### A new field kind

The field kinds are a closed vocabulary. A component almost always fits the kinds there are, or slot plus child for repeating items with fields of their own. A new kind costs a change in each of:
- **The schema:** `FieldDef` and the value types in `src/schema.ts`, and how `defineComponent` reads its value (`define.ts`); `render-static.tsx` if it renders specially.
- **The engine:** its Puck field in `packages/engine/src/puck/config.tsx` (`toPuckField`), and the action bar if it acts on the canvas.
- **The editor UI:** a field renderer in `packages/editor-ui/src/components/edit/`, registered by kind, with its story.
- **The desktop app:** `EditPanelHost.tsx` and `field-group.ts` (its Edit panel tab and group); copy and paste (`element-clipboard.ts`) and Media's usage (`media-usage.ts`) if it holds a file.
- **The model:** a zod schema for its stored value if it isn't a plain one, and a migration if old documents hold it another way.
- **Strings:** its labels, and any wording the renderer shows.

## The schema entry

`@webforge/site-components/schema` (`src/schema.ts`) has the package's types only: `FieldDef`, `RenderContext`, `ComponentPlace`, the value types. It loads without React or Vite, in plain Node too, for tools that need what a component's fields are. A test in `tools/` imports it in Node and fails if anything from React or Vite comes with it, so keep it to types.

## Stories

Every component has stories for its main variants, next to it in `src/catalogue/<family>.stories.tsx`.

- **Rendering:** stories render with `SiteNodes` (`src/stories/site-nodes.tsx`), the export's own renderer, so a story is what a site shows. Its context has a navigation, the image `photo` and the site name.
- **Running them:** `pnpm --filter @webforge/site-components storybook` opens them, with toolbars for the theme and the device width.
- **Visual checks:** `pnpm visual` runs axe on every story in each theme on Desktop and Mobile. CI's Linux container also compares screenshots; make a new story's screenshots before CI with `pnpm visual:docker` (the same container, in Docker) and commit them with the PR.

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
- [ ] **`defineSection` or `defineComponent`:** a section has its frame; titles, text and buttons come from the primitives; the label and field labels go through `t()`, with English text in its family's `packages/i18n/src/en/components/<family>.ts`.
- [ ] **Stories:** for its variants, passing axe in every theme on Desktop and Mobile.
- [ ] **Tests:** unit tests for anything its render works out. The export's golden files change only on purpose.
- [ ] **Behaviours:** a new or changed script type-checks, has its unit test, and `pnpm behaviours` has been run.
- [ ] **Edit panel:** each field shows in the Edit panel with a meaningful undo label ("Changed Cards layout").
