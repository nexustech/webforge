import { expect, type Locator } from "@playwright/test";
import type { NodeDoc } from "@webforge/model";

// Rows of cards (#1372, #1511) for the app's canvas and the exported site alike: a page of every
// section that lays cards out in CARD_ROWS, with texts of different lengths, and how each row is
// laid out where it's drawn.

const SHORT = "<p>Fresh every day.</p>";
const LONG =
  "<p>Baked before dawn from flour milled down the road, with butter from the farm next door and nothing else added, so it keeps for days.</p>";
const MEDIUM = "<p>Cakes for birthdays and weddings, made to order.</p>";
/** Texts for cards in turn: short, long, medium, so no two neighbours are alike. */
const text = (index: number) => [SHORT, LONG, MEDIUM][index % 3] ?? SHORT;

/** The title of Features' cards layout with `count` cards, Same height. */
export const sameHeightTitle = (count: number) =>
  `Same height, ${count} card${count === 1 ? "" : "s"}`;

/** The title of Features' cards layout with Fit the text. */
const FIT_TITLE = "Fit the text";

const features = (title: string, variant: string, count: number, cardHeight?: string): NodeDoc => ({
  type: "Features",
  props: {
    id: `features-${title.replace(/\W+/g, "-").toLowerCase()}`,
    variant,
    ...(cardHeight === undefined ? {} : { cardHeight }),
    title,
    text: "<p>What we do.</p>",
    items: Array.from({ length: count }, (_, index) => ({
      type: "Feature",
      props: {
        id: `feature-${title.replace(/\W+/g, "-").toLowerCase()}-${index}`,
        icon: "sparkles",
        title: `Card ${index + 1}`,
        text: text(index),
      },
    })),
  },
});

/**
 * Every section whose cards sit in CARD_ROWS, each titled to find it by: Features' cards layout
 * with one to seven cards (Same height, saved without the setting, as a site from before it), and
 * with Fit the text; its centred and list layouts; Pricing's cards; Team's three layouts; Stats'
 * row and cards.
 */
export const CARD_ROW_SECTIONS: readonly NodeDoc[] = [
  ...[1, 2, 3, 4, 5, 6, 7].map((count) => features(sameHeightTitle(count), "cards", count)),
  features(FIT_TITLE, "cards", 4, "fit"),
  features("Centred icons", "centred", 4),
  features("List", "list", 4),
  {
    type: "Pricing",
    props: {
      id: "pricing",
      variant: "cards",
      title: "Prices",
      text: "<p>What it costs.</p>",
      items: [0, 1, 2].map((index) => ({
        type: "PricingPlan",
        props: {
          id: `plan-${index}`,
          name: `Plan ${index + 1}`,
          price: "£3",
          period: "each",
          details: text(index),
          buttonLabel: "Order",
          featured: index === 1,
          badge: "",
        },
      })),
    },
  },
  ...(["cards", "round", "list"] as const).map(
    (variant): NodeDoc => ({
      type: "Team",
      props: {
        id: `team-${variant}`,
        variant,
        title: `Team, ${variant}`,
        text: "<p>Who we are.</p>",
        items: [0, 1, 2, 3].map((index) => ({
          type: "TeamMember",
          props: {
            id: `member-${variant}-${index}`,
            name: "Rosa",
            role: "Baker",
            text: text(index),
          },
        })),
      },
    }),
  ),
  ...(["row", "cards"] as const).map(
    (variant): NodeDoc => ({
      type: "Stats",
      props: {
        id: `stats-${variant}`,
        variant,
        title: `Stats, ${variant}`,
        text: "<p>In numbers.</p>",
        items: [
          "Loaves a day",
          "Years baking bread in the same oven on the high street",
          "Cakes",
          "Shops",
        ].map((label, index) => ({
          type: "Stat",
          props: { id: `stat-${variant}-${index}`, number: "40", label },
        })),
      },
    }),
  ),
];

/** One row of cards: their heights, and the left and right of the row they make. */
type CardRow = {
  readonly heights: readonly number[];
  readonly left: number;
  readonly right: number;
  /** The bottom of each card's last part (Pricing's button). */
  readonly lastBottoms: readonly number[];
  readonly bottoms: readonly number[];
};

/**
 * Each section's rows of cards in `root` (a page, or the canvas's frame), by its title: cards
 * whose tops are level make a row. In px, to the half pixel.
 */
export function cardRows(root: { locator(selector: string): Locator }) {
  return root.locator("body").evaluate((body) => {
    const half = (value: number) => Math.round(value * 2) / 2;
    const sections: Record<
      string,
      { rows: (CardRow & { top: number })[]; left: number; right: number }
    > = {};
    for (const card of body.querySelectorAll<HTMLElement>(
      ".site-feature, .site-pricing-plan, .site-team-member, .site-stat",
    )) {
      // By its title: a section's element carries no id. The page's first section's is its h1.
      const title = card.closest("section")?.querySelector("h1, h2")?.textContent?.trim() ?? "?";
      const holder = card.closest(".flex-wrap")?.getBoundingClientRect();
      const box = card.getBoundingClientRect();
      const section = sections[title] ?? {
        rows: [],
        left: half(holder?.left ?? 0),
        right: half(holder?.right ?? 0),
      };
      sections[title] = section;
      const top = Math.round(box.top);
      let row = section.rows.find((each) => each.top === top);
      if (row === undefined) {
        row = {
          top,
          heights: [],
          left: half(box.left),
          right: half(box.right),
          lastBottoms: [],
          bottoms: [],
        };
        section.rows.push(row);
      }
      (row.heights as number[]).push(half(box.height));
      (row.bottoms as number[]).push(half(box.bottom));
      (row.lastBottoms as number[]).push(
        half(card.lastElementChild?.getBoundingClientRect().bottom ?? box.bottom),
      );
      Object.assign(row, {
        left: Math.min(row.left, half(box.left)),
        right: Math.max(row.right, half(box.right)),
      });
    }
    return sections;
  });
}

/** Every section's rows, as {@link cardRows} reads them. */
export type Measured = Awaited<ReturnType<typeof cardRows>>;

const spread = (values: readonly number[]) => Math.max(...values) - Math.min(...values);

/**
 * Checks `measured`, laid out `width` px wide, is drawn as #1372 and #1511 ask: in every section
 * the cards in a row are the same height, but Fit the text's; a last row that isn't full is
 * centred; Features' Same height cards are the same height on every row from 768 px (`md`), and
 * as tall as their own text below it; Pricing's buttons line up. `where` names it in a failure.
 */
export function expectCardRows(measured: Measured, width: number, where: string): void {
  const said = (title: string) =>
    `${where} at ${width} px, ${title}: ${JSON.stringify(measured[title])}`;
  expect(Object.keys(measured).length, `${where}: sections found`).toBe(CARD_ROW_SECTIONS.length);
  for (const [title, section] of Object.entries(measured)) {
    for (const row of section.rows) {
      if (title === FIT_TITLE && width >= 768 && row.heights.length > 1) {
        expect
          .soft(spread(row.heights), `${said(title)}: each card its own height`)
          .toBeGreaterThan(8);
      } else {
        expect
          .soft(spread(row.heights), `${said(title)}: a row's cards the same height`)
          .toBeLessThanOrEqual(1);
      }
      // Centred in what holds it, as #1372 centres a last row that isn't full.
      expect
        .soft(
          Math.abs((row.left + row.right) / 2 - (section.left + section.right) / 2),
          `${said(title)}: centred`,
        )
        .toBeLessThanOrEqual(1);
    }
    if (title.startsWith("Same height")) {
      const all = section.rows.flatMap((row) => row.heights);
      if (width >= 768) {
        expect
          .soft(spread(all), `${said(title)}: every row the same height`)
          .toBeLessThanOrEqual(1);
      } else if (all.length > 1) {
        expect
          .soft(spread(all), `${said(title)}: each card its own height on a phone`)
          .toBeGreaterThan(8);
      }
    }
    if (title === "Prices") {
      for (const row of section.rows) {
        expect
          .soft(spread(row.lastBottoms), `${said(title)}: the buttons line up`)
          .toBeLessThanOrEqual(1);
      }
    }
  }
}
