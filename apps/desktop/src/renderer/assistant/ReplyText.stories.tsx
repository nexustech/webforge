import type { Meta, StoryObj } from "@storybook/react-vite";
import { MonthReadout } from "./MonthReadout.js";
import { ReplyText } from "./ReplyText.js";

// A reply's text in limited Markdown (product/14 §6.4) and the month's readout (AIA-8), at the width
// of a side panel.
const meta = { title: "Assistant/Reply text" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Emphasis, code and a list; a link with its address; raw HTML and an image as text, never
 * loaded.
 */
export const Markdown: Story = {
  render: () => (
    <div className="w-80 rounded-md border border-border bg-panel p-3">
      <ReplyText
        onOpenLink={() => undefined}
        text={[
          "I shortened the title to **Fresh bread daily** and set `Text alignment` to *Centre*:",
          "",
          "1. Monday to Friday, 7am to 6pm",
          "2. Saturday, 8am to 2pm",
          "",
          "> Your opening hours are on the Contact page too.",
          "",
          "See the [Google Business page](https://business.example.com/bakery).",
          "",
          '![a photo](https://images.example.com/x.jpg) <b onclick="x()">raw HTML</b>',
        ].join("\n")}
      />
    </div>
  ),
};

/** The month's readout: well under the limit, past 80%, and reached. */
export const Month: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4 rounded-md border border-border bg-panel p-3">
      <MonthReadout month={{ spentUsd: 1.2, limitUsd: 5, warned: false, reached: false }} />
      <MonthReadout month={{ spentUsd: 4.1, limitUsd: 5, warned: true, reached: false }} />
      <MonthReadout month={{ spentUsd: 5.02, limitUsd: 5, warned: true, reached: true }} />
    </div>
  ),
};
