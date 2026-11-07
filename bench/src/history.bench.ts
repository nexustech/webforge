import { createHistoryManager } from "@webforge/history";
import type { NodeDoc, SiteDoc } from "@webforge/model";
import { describe, test } from "vitest";
import { measure } from "./measure.js";
import { homeOf, largeSite, SECTIONS } from "./sites.js";

// Undo history on a site whose home page has 20 sections (ADR 0004; U7: undo "instant", < 100 ms
// in the app). The editor's history holds the whole site; one keystroke edits one text field, as
// the canvas's targeted patch writes it (ADR 0007, 1.27).

/** Steps already in the history, as ADR 0007's harness has them. */
const STEPS = 50;

/** The props of the first Text on `site`'s home page, in a draft. */
function firstText(site: SiteDoc): Record<string, unknown> {
  const [section] = homeOf(site).doc.content as NodeDoc[];
  const content = section?.props.content as NodeDoc[] | undefined;
  const text = content?.find((node) => node.type === "Text");
  if (text === undefined) throw new Error("The home page has no Text");
  return text.props;
}

/** A history of the large site, with `steps` text edits in it. */
function historyWith(steps: number) {
  const history = createHistoryManager({ initial: largeSite() });
  for (let step = 0; step < steps; step++) {
    history.run(`Edited text ${step}`, (draft) => {
      firstText(draft).text = `<p>Step ${step}</p>`;
    });
  }
  return history;
}

describe(`history, a ${SECTIONS}-section page (ADR 0004)`, () => {
  test("a keystroke: one text field edited, coalesced", async ({ bench }) => {
    const history = historyWith(0);
    let key = 0;
    // §10's one frame, for the history's part of a keystroke.
    await measure(
      bench,
      "history-keystroke",
      () => {
        key += 1;
        history.run(
          "Edited Text",
          (draft) => {
            firstText(draft).text = `<p>Typed ${key}</p>`;
          },
          { coalesceKey: "text:s1-text-1:text" },
        );
      },
      { budgetMs: 16 },
    );
  });

  test(`undo then redo, in a ${STEPS}-step history`, async ({ bench }) => {
    const history = historyWith(STEPS);
    await measure(
      bench,
      "history-undo-redo",
      () => {
        history.undo();
        history.redo();
      },
      { budgetMs: 100 },
    );
  });

  test(`a jump to the start of a ${STEPS}-step history and back`, async ({ bench }) => {
    const history = historyWith(STEPS);
    const last = history.entries().at(-1)?.id ?? null;
    await measure(
      bench,
      "history-jump",
      () => {
        history.jumpTo(null);
        history.jumpTo(last);
      },
      { budgetMs: 100 },
    );
  });
});
