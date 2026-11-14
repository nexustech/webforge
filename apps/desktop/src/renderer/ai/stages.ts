import { type CommandApi, type CommandHost, createCommandApi } from "@webforge/commands";
import { createHistoryManager } from "@webforge/history";
import type { SiteDoc } from "@webforge/model";
import type { AiRequest, AiResponse } from "../../shared/ipc/ai.js";

/**
 * The assistant's held changes (6.9e, AIA-5's _Review before applying_): each reply's requests
 * name its stage, a draft of the site with a history of its own, which nothing shows or saves.
 * A staged query reads the draft, so a later step builds on an earlier one; a staged command is
 * planned, checked and run there. The site and its history are untouched. Main keeps what each
 * command asked, and asks again, unstaged, when the person applies them: each then becomes the
 * undo step it would have been, asking the person where it would.
 */

/** A request of a reply whose changes are held: its stage's id. */
type StagedRequest = AiRequest & { readonly stage: string };

export type Stages = {
  /** `request` answered against its stage, which starts as the site is now. */
  answer(request: StagedRequest): Promise<AiResponse>;
};

/**
 * The stages over the open site's `real` host: one at a time, as only the last reply's changes are
 * held; another reply's request starts a new one.
 */
export function createStages(real: Pick<CommandHost, "history" | "mode" | "published">): Stages {
  let current: { readonly id: string; readonly api: CommandApi } | undefined;
  const stage = (id: string): CommandApi => {
    if (current?.id === id) return current.api;
    const history = createHistoryManager<SiteDoc>({ initial: real.history.document.getState() });
    const api = createCommandApi({
      history,
      run: (label, recipe) => history.run(label, recipe),
      // Nothing real changes while staging: the person is asked when the changes are applied.
      editing: () => false,
      confirm: async () => true,
      mode: real.mode,
      published: real.published,
    });
    current = { id, api };
    return api;
  };
  return {
    async answer(request) {
      const api = stage(request.stage);
      if (request.kind === "query") return api.query(request.name, request.input);
      const result = await api.run(request.name, request.input, { app: request.app });
      if (result.status !== "done") return result;
      // The draft's step isn't the site's: none to undo yet, only what it would change.
      const { entryId: _draft, ...held } = result;
      return held;
    },
  };
}
