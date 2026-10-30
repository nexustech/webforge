import { isNodeDoc, type NodeDoc, type PageDoc } from "@webforge/model";

/** Options of {@link largePage}. */
export type LargePageOptions = {
  /** Number of sections. */
  readonly sections?: number;
  /** FAQ questions per section; each section also holds a heading, two texts and the FAQ. */
  readonly questionsPerSection?: number;
};

/**
 * A large page for performance checks (spec/04 item 0.4, ADR 0004 U7): `sections` sections, each
 * with a heading, two paragraphs of text and an FAQ. With the defaults (25 sections, 4 questions)
 * that is 25 × (1 section + 1 heading + 2 texts + 1 FAQ + 4 questions) = 225 nodes.
 */
export function largePage(options: LargePageOptions = {}): PageDoc {
  const { sections = 25, questionsPerSection = 4 } = options;
  const content: NodeDoc[] = [];
  for (let s = 1; s <= sections; s++) {
    const questions: NodeDoc[] = [];
    for (let q = 1; q <= questionsPerSection; q++) {
      questions.push({
        type: "FaqItem",
        props: {
          id: `s${s}-q${q}`,
          question: `Question ${q} of section ${s}?`,
          answer: `<p>Answer ${q} of section ${s}, with enough words to wrap onto a second line.</p>`,
        },
      });
    }
    content.push({
      type: "Section",
      props: {
        id: `s${s}`,
        contentWidth: "medium",
        padding: { top: "m", bottom: "m" },
        content: [
          { type: "Heading", props: { id: `s${s}-heading`, text: `Section ${s}`, size: "medium" } },
          {
            type: "Text",
            props: { id: `s${s}-text-1`, text: `<p>First paragraph of section ${s}.</p>` },
          },
          {
            type: "Text",
            props: { id: `s${s}-text-2`, text: `<p>Second paragraph of section ${s}.</p>` },
          },
          { type: "Faq", props: { id: `s${s}-faq`, title: `FAQ ${s}`, items: questions } },
        ],
      },
    });
  }
  return { root: { props: {} }, content };
}

/** The number of nodes (sections and elements, including nested ones) in `page`. */
export function countNodes(page: PageDoc): number {
  const count = (nodes: readonly NodeDoc[]): number =>
    nodes.reduce(
      (total, node) =>
        total +
        1 +
        Object.values(node.props)
          .filter((value): value is unknown[] => Array.isArray(value))
          .reduce((sum, values) => sum + count(values.filter(isNodeDoc)), 0),
      0,
    );
  return count(page.content);
}
