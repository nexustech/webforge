import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CheckReport, Finding } from "@webforge/site-check";
import { SiteCheckPanel } from "./SiteCheckPanel.js";

const at = (key: string): Finding => ({ key, place: { kind: "address" } });

/** Every rule, as a site with a few things to look at has them. */
const REPORT: CheckReport = {
  mode: "export",
  results: [
    { rule: "deviceNames", level: "must", findings: [at("con")], ignored: 0 },
    { rule: "homePage", level: "must", findings: [], ignored: 0 },
    { rule: "brokenLinks", level: "should", findings: [at("old-prices")], ignored: 0 },
    { rule: "placeholders", level: "should", findings: [at("hero"), at("faq")], ignored: 1 },
    { rule: "pageTitles", level: "should", findings: [], ignored: 0 },
    { rule: "webAddress", level: "should", findings: [at("address")], ignored: 0 },
    { rule: "missingImages", level: "should", findings: [], ignored: 0 },
    { rule: "altText", level: "should", findings: [], ignored: 0 },
    { rule: "contrast", level: "should", findings: [at("accent")], ignored: 0 },
    { rule: "largeImages", level: "should", findings: [], ignored: 0 },
    { rule: "largeFiles", level: "tip", findings: [], ignored: 0 },
    { rule: "underlinedText", level: "tip", findings: [at("note")], ignored: 0 },
  ],
};

/** Where each story finding is, as the panel names it. */
const PLACES: Readonly<Record<string, { place: string; detail?: string }>> = {
  con: { place: "Con (con.html)" },
  "old-prices": { place: "Button on Prices" },
  hero: { place: "Hero on Home" },
  faq: { place: "Questions on Contact us" },
  address: { place: "Site Settings › Web address" },
  accent: { place: "Text on About us", detail: "2.8:1, needs 4.5:1" },
  note: { place: "Text in the Footer" },
};

const noop = () => undefined;

const meta = {
  title: "Panels/Site Check",
  component: SiteCheckPanel,
  args: {
    report: REPORT,
    ignored: 1,
    describe: (finding) => PLACES[finding.key] ?? { place: finding.key },
    fixFor: (rule) => (rule === "deviceNames" || rule === "webAddress" ? noop : undefined),
    onJump: noop,
    onIgnore: noop,
    onRestore: noop,
  },
  // In the bottom drawer's shape: wide and short.
  render: (args) => (
    <div className="h-80 w-[48rem] border border-border-strong bg-panel">
      <SiteCheckPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof SiteCheckPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Something to fix, something worth fixing and a tip, each rule with its dot (SP-13). */
export const Findings: Story = {};

/** A site with nothing left to fix. */
export const AllClear: Story = {
  args: {
    ignored: 0,
    report: {
      mode: "export",
      results: REPORT.results.map((result) => ({ ...result, findings: [], ignored: 0 })),
    },
  },
};
