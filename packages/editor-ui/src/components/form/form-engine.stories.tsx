import type { Meta, StoryObj } from "@storybook/react-vite";
import { z } from "zod";
import { FieldRenderersProvider } from "../edit/field-context.js";
import type { FieldKind, FieldRenderers } from "../edit/field-spec.js";
import { Form } from "./form-engine.js";
import type { FormField, FormSpec, FormValues } from "./form-spec.js";
import { useForm } from "./use-form.js";

/** A plain square of `colour`, in place of a Media thumbnail: stories make no requests (C8). */
const swatch = (colour: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="${colour}"/></svg>`,
  )}`;

const SIZES = [
  { label: "S", value: "small" },
  { label: "M", value: "medium" },
  { label: "L", value: "large" },
];

/**
 * One field of every kind (FORM_KINDS): adding a kind to `FieldSpec` fails to compile until it has
 * a field here, so every kind is drawn in a form's story.
 */
const FORM_KINDS = {
  text: { kind: "text", name: "text", label: "Site name", help: "Shown in browser tabs." },
  select: {
    kind: "select",
    name: "select",
    label: "Form service",
    options: [
      { label: "None", value: "" },
      { label: "Formspree", value: "formspree" },
    ],
  },
  toggle: { kind: "toggle", name: "toggle", label: "Show a back-to-top button" },
  slider: { kind: "slider", name: "slider", label: "Size", steps: SIZES },
  color: {
    kind: "color",
    name: "color",
    label: "Colour",
    options: [
      { label: "Brand", value: "primary" },
      { label: "Accent", value: "accent" },
    ],
  },
  spacing: { kind: "spacing", name: "spacing", label: "Gap", options: SIZES },
  box: {
    kind: "box",
    name: "box",
    label: "Padding",
    options: SIZES,
    sides: [
      { label: "Top", value: "top" },
      { label: "Bottom", value: "bottom" },
    ],
  },
  list: {
    kind: "list",
    name: "list",
    label: "Social profiles",
    itemLabel: "Profile",
    itemFields: [{ kind: "text", name: "url", label: "Profile address" }],
    newItem: () => ({ url: "" }),
  },
  link: { kind: "link", name: "link", label: "Link" },
  image: { kind: "image", name: "image", label: "Image" },
  icon: { kind: "icon", name: "icon", label: "Icon" },
  number: { kind: "number", name: "number", label: "Width (px)", min: 240, max: 3840, width: "sm" },
  time: { kind: "time", name: "time", label: "Opens" },
  multiChoice: {
    kind: "multiChoice",
    name: "multiChoice",
    label: "Days",
    options: ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({ label: day, value: day })),
  },
  imageChoice: {
    kind: "imageChoice",
    name: "imageChoice",
    label: "Site icon",
    noneLabel: "None",
    options: [
      { value: "shop", label: "shop", thumbnail: swatch("#e8a87c") },
      { value: "cakes", label: "cakes", thumbnail: swatch("#85cdca") },
    ],
  },
} satisfies { readonly [K in FieldKind]: FormField & { readonly kind: K } };

const VALUES: FormValues = {
  text: "Rosa's Bakery",
  select: "formspree",
  toggle: true,
  slider: "medium",
  color: "primary",
  spacing: "small",
  box: { top: "medium" },
  list: [{ id: "one", url: "https://instagram.com/rosas" }],
  number: "1280",
  time: "07:00",
  multiChoice: ["Tue", "Wed"],
  imageChoice: "shop",
};

/** The app draws these kinds (a link, a Media image, an icon): a stand-in shows where. */
const APP_DRAWN: FieldRenderers = Object.fromEntries(
  (["link", "image", "icon"] as const).map((kind) => [
    kind,
    ({ id }: { readonly id: string }) => (
      <output id={id} className="text-xs text-muted-foreground">
        Drawn by the app
      </output>
    ),
  ]),
);

/** A form of `spec` from `initial`, with a Save button that shows what saving gave. */
function FormHost({
  spec,
  initial,
}: {
  readonly spec: FormSpec<FormValues, unknown>;
  readonly initial: FormValues;
}) {
  const form = useForm(spec, initial);
  return (
    <FieldRenderersProvider renderers={APP_DRAWN}>
      <div className="grid w-[28rem] gap-3 p-3">
        <Form form={form} groupsLabel="Sections" />
        <button
          type="button"
          data-save=""
          className="justify-self-start rounded-sm border border-border px-2 py-1 text-sm"
          onClick={() => form.submit()}
        >
          Save
        </button>
      </div>
    </FieldRenderersProvider>
  );
}

const anything: FormSpec<FormValues, unknown> = {
  fields: Object.values(FORM_KINDS),
  schema: z.unknown(),
  toModel: (values) => values,
};

const meta = {
  title: "Base/Form engine",
  component: FormHost,
  args: { spec: anything, initial: VALUES },
} satisfies Meta<typeof FormHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A field of every kind, each drawn by its renderer; the app's own kinds by stand-ins. */
export const EveryKind: Story = {};

/** Fields on tabs: a form with groups, such as Site Settings. */
export const Tabs: Story = {
  args: {
    spec: {
      ...anything,
      groups: [
        { id: "general", label: "General" },
        { id: "hours", label: "Contact & hours" },
      ],
      fields: [
        { ...FORM_KINDS.text, group: "general" },
        { ...FORM_KINDS.imageChoice, group: "general" },
        { ...FORM_KINDS.toggle, group: "general" },
        { ...FORM_KINDS.multiChoice, group: "hours" },
        { ...FORM_KINDS.time, group: "hours" },
      ],
    },
  },
};

/** Save was tried: the schema's messages on their fields, and the tab with one marked. */
export const Problems: Story = {
  args: {
    spec: {
      ...anything,
      groups: [
        { id: "general", label: "General" },
        { id: "device", label: "Device" },
      ],
      fields: [
        { ...FORM_KINDS.text, group: "general" },
        { ...FORM_KINDS.number, group: "device" },
      ],
      schema: z.object({
        text: z.string().max(10, "Use at most 10 characters."),
        number: z.coerce.number().max(3840, "Use a width up to 3840 px."),
      }),
    },
    initial: { text: "Rosa's Bakery and Café", number: "5000" },
  },
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>("[data-save]")?.click();
  },
};

/** Fields that can't be changed now, greyed out. */
export const Disabled: Story = {
  args: {
    spec: {
      ...anything,
      fields: [FORM_KINDS.text, FORM_KINDS.toggle, FORM_KINDS.number, FORM_KINDS.select].map(
        (field) => ({ ...field, disabled: true }),
      ),
    },
  },
};
