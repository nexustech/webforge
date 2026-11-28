import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { fieldControlClass } from "../edit/text-field.js";
import { Check, Field, ImageChoice, TextInput, TimeInput } from "./form.js";
import { swatch } from "./story-swatch.js";

const meta = {
  title: "Base/Form",
  component: Field,
  decorators: [
    (Story) => (
      <div className="grid w-80 gap-3 p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A field draws its own control; the label, hint and error belong to it. */
export const CustomControl: Story = {
  args: {
    label: "Language",
    hint: "The language the site is written in, such as en or en-GB.",
    children: (control) => <input {...control} className={fieldControlClass} defaultValue="en" />,
  },
};

export const WithError: Story = {
  args: {
    label: "Web address",
    hint: "Where the site will be published.",
    error: "Use only the address, without a page or folder.",
    children: (control) => (
      <input
        {...control}
        type="url"
        className={fieldControlClass}
        defaultValue="https://example.com/about"
      />
    ),
  },
};

function TextInputs() {
  const [name, setName] = useState("Rosa's Bakery");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("rosa@");
  return (
    <>
      <TextInput label="Site name" value={name} maxLength={100} onChange={setName} required />
      <TextInput
        label="Description"
        hint="Shown in search results."
        multiline
        value={description}
        placeholder="Fresh bread every morning"
        onChange={setDescription}
      />
      <TextInput
        label="Email"
        type="email"
        value={email}
        error="Use an email address such as name@example.com."
        onChange={setEmail}
      />
      <TextInput
        label="File name"
        hint="Always index.html."
        value="index.html"
        disabled
        onChange={() => {}}
      />
    </>
  );
}

/** One line and several, with a hint, an error, and switched off. */
export const TextInputStates: Story = {
  args: { label: "", children: () => null },
  render: () => <TextInputs />,
};

function Checks() {
  const [indexing, setIndexing] = useState(true);
  const [banner, setBanner] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Check label="Let search engines show the site" checked={indexing} onChange={setIndexing} />
      <Check label="Ask visitors before counting them" checked={banner} onChange={setBanner} />
      <Check label="Include a sitemap" checked disabled onChange={() => {}} />
    </div>
  );
}

export const Checkboxes: Story = {
  args: { label: "", children: () => null },
  render: () => <Checks />,
};

export const Times: Story = {
  args: { label: "", children: () => null },
  render: () => (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <TimeInput label="Opens" value="09:00" onChange={() => {}} />
      <TimeInput label="Closes" value="" error="Use a time such as 17:00." onChange={() => {}} />
    </div>
  ),
};

/** A thumbnail still loading: nothing drawn yet, so its box's fill shows (#1452). */
const LOADING = swatch("transparent");

function ImageChoices() {
  const [chosen, setChosen] = useState<string | undefined>("shop");
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="mb-1 text-xs text-muted-foreground">Share image</legend>
      <ImageChoice
        name="share-image"
        label="The site's"
        selected={chosen === undefined}
        onSelect={() => setChosen(undefined)}
      />
      <ImageChoice
        name="share-image"
        label="shop-front.jpg"
        thumbnail={swatch("#5b7fa6")}
        selected={chosen === "shop"}
        onSelect={() => setChosen("shop")}
      />
    </fieldset>
  );
}

/** Choices of image, the default first; without a thumbnail, a blank square. */
export const ImageChoiceGroup: Story = {
  args: { label: "", children: () => null },
  render: () => <ImageChoices />,
};

/** Names Settings' logo pickers meet (#1452): long, with several dots, a dot first, short. */
const FILE_NAMES = [
  { name: "riverside-terrace-breakfast.jpg", thumbnail: swatch("#d97757") },
  { name: "menu.v2.final.png", thumbnail: swatch("#c9a46b") },
  { name: ".hidden", thumbnail: swatch("#7a9a6b") },
  { name: "hannah.jpg", thumbnail: LOADING },
  { name: "cake.jpg", thumbnail: swatch("#8c6a9e") },
];

function LongNames({ scale }: { readonly scale: number }) {
  const [chosen, setChosen] = useState<string | undefined>(FILE_NAMES[0]?.name);
  return (
    // 125% interface text is the window's zoom: the same here.
    <fieldset className="flex flex-wrap gap-2" style={{ zoom: scale }}>
      <legend className="mb-1 text-xs text-muted-foreground">Logo at {scale * 100}%</legend>
      <ImageChoice
        name={`logo-${scale}`}
        label="None"
        selected={chosen === undefined}
        onSelect={() => setChosen(undefined)}
      />
      {FILE_NAMES.map(({ name, thumbnail }) => (
        <ImageChoice
          key={name}
          name={`logo-${scale}`}
          label={name}
          thumbnail={thumbnail}
          selected={chosen === name}
          onSelect={() => setChosen(name)}
        />
      ))}
    </fieldset>
  );
}

/**
 * Long file names on one line (#1452), at 100% and 125% interface text: cut in the middle, the
 * extension and the three characters before it kept, the whole name in a tooltip. `hannah.jpg`'s
 * picture is still loading: its box is filled, its size kept.
 */
export const ImageChoiceLongNames: Story = {
  args: { label: "", children: () => null },
  render: () => (
    <div className="flex flex-col gap-4">
      <LongNames scale={1} />
      <LongNames scale={1.25} />
    </div>
  ),
};
