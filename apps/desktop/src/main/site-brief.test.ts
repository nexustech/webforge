import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiWindow } from "./ai-ipc.js";
import { type BriefTemplate, briefProblem, createSiteBriefs, siteChoices } from "./site-brief.js";

const TRADES: BriefTemplate = {
  id: "trades",
  category: "trades",
  theme: "workshop",
  pages: [
    { id: "home", title: "Home", home: true },
    { id: "services", title: "Services", home: false },
    { id: "contact", title: "Contact", home: false },
  ],
};

const brief = {
  businessType: "trades",
  businessKind: "AutoRepair",
  name: "Rapidfix Vehicle Repair",
  colours: { colour: "#c62828" },
} as const;

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

/** Briefs over a fake window, which records what it's sent and can start over. */
function setUp(options: { window?: boolean; timeoutMs?: number; answerWithinMs?: number } = {}) {
  const sent: unknown[][] = [];
  let navigate: ((details: { isMainFrame: boolean; isSameDocument: boolean }) => void) | undefined;
  const window: AiWindow = {
    webContents: {
      send: (...args: unknown[]) => {
        sent.push(args);
      },
      isCrashed: () => false,
      on: (_event, listener) => {
        navigate = listener;
      },
    },
  };
  const briefs = createSiteBriefs({
    window: () => (options.window === false ? undefined : window),
    templates: () => [TRADES],
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.answerWithinMs === undefined ? {} : { answerWithinMs: options.answerWithinMs }),
  });
  const handlers = new Map<string, Handler>();
  briefs.register(
    { handle: (name: string, handler: Handler) => handlers.set(name, handler) } as unknown as Pick<
      IpcMain,
      "handle"
    >,
    () => true,
  );
  /** The window says what became of brief `id`. */
  const answer = (id: unknown, outcome: string) =>
    handlers.get("ai:brief-answer")?.(
      { senderFrame: { url: "app" } } as IpcMainInvokeEvent,
      id,
      outcome,
    );
  return {
    briefs,
    sent,
    answer,
    startOver: () => navigate?.({ isMainFrame: true, isSameDocument: false }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("what a brief chooses from (4.12a, AIB-5)", () => {
  it("lists each business type's kinds, templates with their pages, and recipes; the themes and palettes", () => {
    const choices = siteChoices([TRADES]);
    const trades = choices.businessTypes.find(({ type }) => type === "trades");

    expect(trades?.kinds).toContainEqual({ kind: "AutoRepair", label: "Vehicle repair" });
    expect(trades?.templates).toEqual([
      { id: "trades", name: expect.any(String), theme: "workshop", pages: TRADES.pages },
    ]);
    expect(trades?.recipes.length).toBeGreaterThan(0);
    expect(choices.themes).toContain("workshop");
    expect(choices.palettes.length).toBeGreaterThan(0);
  });

  it("refuses a brief that doesn't fit what ships, saying what would", () => {
    expect(briefProblem({ ...brief }, [TRADES])).toBeUndefined();
    expect(briefProblem({ ...brief, businessKind: "Bakery" }, [TRADES])).toMatch(
      /isn't a kind of trades business: .*AutoRepair/,
    );
    expect(briefProblem({ ...brief, template: "cafe" }, [TRADES])).toMatch(
      /"cafe" isn't a trades template: trades/,
    );
    expect(briefProblem({ ...brief, leaveOut: ["home"] }, [TRADES])).toBe(
      "The home page can't be left out.",
    );
    expect(briefProblem({ ...brief, leaveOut: ["about"] }, [TRADES])).toMatch(/no page "about"/);
    expect(briefProblem({ ...brief, recipes: ["menu"] }, [TRADES])).toMatch(
      /"menu" isn't a trades page recipe/,
    );
    expect(briefProblem({ ...brief, theme: "neon" }, [TRADES])).toMatch(/no theme "neon"/);
    expect(briefProblem({ ...brief, colours: { palette: "neon" } }, [TRADES])).toMatch(
      /no palette "neon"/,
    );
  });
});

describe("a brief, shown to the person (4.12a, AIB-5)", () => {
  it("opens in the window, and answers done with the site once the person creates it", async () => {
    const { briefs, sent, answer } = setUp();

    const asked = briefs.ask(brief, "Claude");
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const [channel, id, shown] = sent[0] ?? [];
    expect(channel).toBe("ai:brief");
    expect(shown).toMatchObject({ name: "Rapidfix Vehicle Repair", businessKind: "AutoRepair" });
    await answer(id, "created");

    expect(await asked).toEqual({
      status: "done",
      data: { created: true, name: "Rapidfix Vehicle Repair" },
    });
  });

  it.each([
    ["declined", "declined"],
    ["refused", "refused"],
    ["busy", "busy"],
  ])("answers %s when the window says so", async (outcome, status) => {
    const { briefs, sent, answer } = setUp();
    const asked = briefs.ask(brief, "Claude");
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    await answer(sent[0]?.[1], outcome);

    expect(await asked).toMatchObject({ status });
  });

  it("shows one brief at a time, and takes no answer for another", async () => {
    const { briefs, sent, answer } = setUp();
    const first = briefs.ask(brief, "Claude");
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(await briefs.ask(brief, "Claude")).toMatchObject({ status: "busy" });
    await answer(99, "created");
    await answer(sent[0]?.[1], "declined");
    expect(await first).toMatchObject({ status: "declined" });
  });

  it("declines one the window started over without answering, or that waited too long", async () => {
    const reloaded = setUp();
    const asked = reloaded.briefs.ask(brief, "Claude");
    await vi.waitFor(() => expect(reloaded.sent).toHaveLength(1));
    reloaded.startOver();
    expect(await asked).toMatchObject({ status: "declined" });

    vi.useFakeTimers();
    const slow = setUp({ timeoutMs: 1_000 });
    const waiting = slow.briefs.ask(brief, "Claude");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await waiting).toMatchObject({ status: "declined" });
  });

  it("refuses a brief that isn't one, or that doesn't fit, before showing anything", async () => {
    const { briefs, sent } = setUp();

    expect(await briefs.ask({ name: "No type" }, "Claude")).toMatchObject({ status: "invalid" });
    expect(await briefs.ask({ ...brief, colours: { colour: "red" } }, "Claude")).toMatchObject({
      status: "invalid",
    });
    expect(await briefs.ask({ ...brief, template: "cafe" }, "Claude")).toMatchObject({
      status: "invalid",
    });
    expect(sent).toEqual([]);
    expect(await setUp({ window: false }).briefs.ask(brief, "Claude")).toMatchObject({
      status: "not-found",
    });
  });
});

describe("a brief the person takes a while over (4.12a, #778 review)", () => {
  it("answers waiting with its id after the wait, and briefStatus gives the outcome, once", async () => {
    vi.useFakeTimers();
    const { briefs, sent, answer } = setUp({ answerWithinMs: 45_000 });

    const asked = briefs.ask(brief, "Claude");
    await vi.advanceTimersByTimeAsync(45_000);
    const first = await asked;
    expect(first).toEqual({
      status: "waiting",
      data: { briefId: sent[0]?.[1] },
      message:
        "The person is checking the quick start: ask briefStatus with this briefId in a while.",
    });
    const briefId = (first as { data: { briefId: number } }).data.briefId;
    expect(briefs.status({ briefId }, "Claude")).toMatchObject({ status: "waiting" });
    // Still shown: another brief waits its turn.
    expect(await briefs.ask(brief, "Claude")).toMatchObject({ status: "busy" });

    await answer(briefId, "created");
    expect(briefs.status({ briefId }, "Claude")).toEqual({
      status: "done",
      data: { created: true, name: "Rapidfix Vehicle Repair" },
    });
    // Read once.
    expect(briefs.status({ briefId }, "Claude")).toMatchObject({ status: "not-found" });
  });

  it("stops waiting when the app gives up on the request, without declining the brief", async () => {
    const { briefs, sent, answer } = setUp();
    const cancel = new AbortController();

    const asked = briefs.ask(brief, "Claude", cancel.signal);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    cancel.abort();
    const briefId = sent[0]?.[1] as number;
    expect(await asked).toMatchObject({ status: "waiting", data: { briefId } });

    // The quick start stays open, and the person still decides.
    await answer(briefId, "declined");
    expect(briefs.status({ briefId }, "Claude")).toMatchObject({ status: "declined" });
  });

  it("shows an app its own briefs only, and forgets an unread outcome after a while", async () => {
    vi.useFakeTimers();
    const { briefs, sent, answer } = setUp({ answerWithinMs: 1_000 });
    const asked = briefs.ask(brief, "Claude");
    await vi.advanceTimersByTimeAsync(1_000);
    await asked;
    const briefId = sent[0]?.[1] as number;

    expect(briefs.status({ briefId }, "Cursor")).toMatchObject({ status: "not-found" });
    expect(briefs.status({ briefId: 999 }, "Claude")).toMatchObject({ status: "not-found" });
    expect(briefs.status({ briefId: "one" }, "Claude")).toMatchObject({ status: "invalid" });

    await answer(briefId, "created");
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(briefs.status({ briefId }, "Claude")).toMatchObject({ status: "not-found" });
  });
});
