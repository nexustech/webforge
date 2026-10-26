import { t } from "@webforge/i18n";
import { z } from "zod";
import { COMMANDS, type CommandName, type Failure, type Plan } from "./commands.js";
import { QUERIES, type QueryName } from "./queries.js";
import type { Actor, CommandHost, CommandResult } from "./types.js";

/** How long a change to more than one page waits for the person to allow it (D7). */
export const CONFIRM_TIMEOUT_MS = 60_000;

/** What a query answers: its data, or why there is none. */
export type QueryResult =
  | { readonly status: "done"; readonly data: unknown }
  | { readonly status: "invalid" | "not-found" | "busy"; readonly message: string };

/** The command layer AI apps use (F-AI-1, 4.8): queries that read the site, commands that change it. */
export type CommandApi = {
  query(name: string, input: unknown): QueryResult;
  run(name: string, input: unknown, actor: Actor): Promise<CommandResult>;
};

const BUSY = "The person is editing (a drag, a slider, typing or a question): try again shortly.";

/** Whether the person is in the middle of a gesture, typing or a question: nothing else may change. */
const busy = (host: CommandHost) =>
  host.history.state.getState().transaction !== null || host.editing();

/**
 * The command layer over `host`: every command validated with zod, refused while the person is
 * editing (`busy`) and in Content mode when it's structural, confirmed first when it changes more
 * than one page (D7, `declined` after {@link CONFIRM_TIMEOUT_MS}), and run as one undo step
 * labelled "AI (‹app›): …" (F-AI-1). Nothing runs that isn't one of {@link COMMANDS}.
 */
export function createCommandApi(host: CommandHost): CommandApi {
  /** The command `name` planned against the site as it is now. */
  const planNow = (name: CommandName, input: unknown): Plan | Failure => {
    const command = COMMANDS[name];
    const parsed = command.input.safeParse(input);
    if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
    // Each command's input type is its own schema's output.
    return (command.plan as (site: unknown, input: unknown) => Plan | Failure)(
      host.history.document.getState(),
      parsed.data,
    );
  };

  /** Asks the person to allow a change; declined when they don't, or after a minute. */
  const allowed = async (plan: Plan, app: string): Promise<boolean> => {
    if (plan.confirm === undefined) return true;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), CONFIRM_TIMEOUT_MS);
    try {
      return await Promise.race([
        host.confirm(plan.confirm(app), timeout.signal),
        new Promise<false>((resolve) =>
          timeout.signal.addEventListener("abort", () => resolve(false)),
        ),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    query(name, input) {
      if (!Object.hasOwn(QUERIES, name)) {
        return { status: "invalid", message: `There is no query "${name}".` };
      }
      const query = QUERIES[name as QueryName];
      const parsed = query.input.safeParse(input);
      if (!parsed.success) return { status: "invalid", message: z.prettifyError(parsed.error) };
      const data = (query.read as (site: unknown, input: unknown) => unknown)(
        host.history.document.getState(),
        parsed.data,
      );
      return data === undefined
        ? { status: "not-found", message: "That page, element or shared section isn't there." }
        : { status: "done", data };
    },

    async run(name, input, actor) {
      if (!Object.hasOwn(COMMANDS, name)) {
        return { status: "invalid", message: `There is no command "${name}".` };
      }
      const command = name as CommandName;
      const first = planNow(command, input);
      if ("status" in first) return first;
      if (busy(host)) return { status: "busy", message: BUSY };
      if (first.structural && host.mode() === "content") {
        return {
          status: "refused",
          message:
            "Webforge is in Content mode: AI apps can edit text and content, not structure or style.",
        };
      }
      if (!(await allowed(first, actor.app))) {
        return { status: "declined", message: "The person didn't allow this change." };
      }
      // Planned again: the site may have changed while the person was asked.
      const plan = first.confirm === undefined ? first : planNow(command, input);
      if ("status" in plan) return plan;
      if (busy(host)) return { status: "busy", message: BUSY };
      const label = t("ai.history", { app: actor.app, action: plan.action });
      host.run(label, plan.recipe, plan.kind);
      return { status: "done", label, ...(plan.id === undefined ? {} : { id: plan.id }) };
    },
  };
}
