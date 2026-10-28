import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CheckReport, Finding, RuleResult, SearchGuide } from "@webforge/site-check";
import { SiteCheckPanel } from "./SiteCheckPanel.js";

const at = (key: string): Finding => ({ key, place: { kind: "address" } });
const guide = (key: SearchGuide): Finding => ({ key, place: { kind: "guide", guide: key } });

/** *Being found*'s rules (3.17): a description to write, two pages alike, a page's headings. */
const FOUND: readonly RuleResult[] = [
  { rule: "searchHidden", level: "tip", group: "found", findings: [], ignored: 0 },
  { rule: "webAddress", level: "should", group: "found", findings: [at("address")], ignored: 0 },
  {
    rule: "pageDescriptions",
    level: "should",
    group: "found",
    findings: [at("prices")],
    ignored: 0,
  },
  {
    rule: "sameTitles",
    level: "should",
    group: "found",
    findings: [at("cakes"), at("cakes-2")],
    ignored: 0,
  },
  { rule: "sameDescriptions", level: "should", group: "found", findings: [], ignored: 0 },
  { rule: "mainHeading", level: "tip", group: "found", findings: [at("about")], ignored: 0 },
  { rule: "businessDetails", level: "tip", group: "found", findings: [], ignored: 0 },
  // One-time tips: listed only while they have something to say.
  {
    rule: "businessProfile",
    level: "tip",
    group: "found",
    oneTime: true,
    findings: [],
    ignored: 0,
  },
  { rule: "searchConsole", level: "tip", group: "found", oneTime: true, findings: [], ignored: 0 },
];

/** Every rule, as a site with a few things to look at has them. */
const REPORT: CheckReport = {
  mode: "export",
  results: [
    { rule: "deviceNames", level: "must", findings: [at("con")], ignored: 0 },
    { rule: "homePage", level: "must", findings: [], ignored: 0 },
    { rule: "brokenLinks", level: "should", findings: [at("old-prices")], ignored: 0 },
    { rule: "placeholders", level: "should", findings: [at("hero"), at("faq")], ignored: 1 },
    { rule: "pageTitles", level: "should", findings: [], ignored: 0 },
    { rule: "missingImages", level: "should", findings: [], ignored: 0 },
    { rule: "altText", level: "should", findings: [], ignored: 0 },
    { rule: "contrast", level: "should", findings: [at("accent")], ignored: 0 },
    { rule: "largeImages", level: "should", findings: [], ignored: 0 },
    { rule: "largeFiles", level: "tip", findings: [], ignored: 0 },
    { rule: "underlinedText", level: "tip", findings: [at("note")], ignored: 0 },
    ...FOUND,
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
  prices: { place: "Prices" },
  cakes: { place: "Cakes", detail: "The same as birthday-cakes.html" },
  "cakes-2": { place: "Birthday cakes", detail: "The same as cakes.html" },
  about: { place: "About us", detail: "2 main headings: keep one large Heading or Hero" },
  businessProfile: { place: "Open Google Business Profile" },
  searchConsole: { place: "Open Google Search Console" },
};

/** The rules with a *Fix* in these stories. */
const FIXES = new Set(["deviceNames", "webAddress", "pageDescriptions", "searchConsole"]);

const noop = () => undefined;

const meta = {
  title: "Panels/Site Check",
  component: SiteCheckPanel,
  args: {
    report: REPORT,
    ignored: 1,
    describe: (finding) => PLACES[finding.key] ?? { place: finding.key },
    fixFor: (rule) => (FIXES.has(rule) ? noop : undefined),
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

/**
 * *Being found* once the site has its web address (3.17): the two one-time tips, each a link to its
 * page and *Done*, beside a missing business detail.
 */
export const BeingFound: Story = {
  args: {
    ignored: 0,
    report: {
      mode: "export",
      results: FOUND.map((result): RuleResult => {
        switch (result.rule) {
          case "webAddress":
            return { ...result, findings: [] };
          case "businessDetails":
            return { ...result, findings: [at("phone")] };
          case "businessProfile":
            return { ...result, findings: [guide("businessProfile")] };
          case "searchConsole":
            return { ...result, findings: [guide("searchConsole")] };
          default:
            return result;
        }
      }),
    },
    describe: (finding) =>
      finding.key === "phone"
        ? { place: "Site Settings › Phone number" }
        : (PLACES[finding.key] ?? { place: finding.key }),
  },
};

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
