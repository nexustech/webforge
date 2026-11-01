import { type SiteCodePiece, type SiteDoc, siteCodePieces } from "@webforge/model";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { TrustApi } from "../../shared/ipc/trust.js";
import { reportFailure } from "../log.js";
import type { EditorSession } from "./editor-session.js";

/**
 * The code trust step (#649, S1 and S6): a site's own code runs for its visitors, and in Preview in
 * the owner's browser, only once the owner has written it here or confirmed it. The main process
 * keeps what's trusted and builds only that; this asks the owner before an export or a Preview,
 * and tells main what the owner writes.
 */

/** How long Site Check waits after a change before asking main about the site's allow-list. */
const ALLOW_LIST_DELAY_MS = 300;

/** How long the owner's writing has to pause before what they wrote is trusted. */
const WRITTEN_DELAY_MS = 1000;

/** What the owner chose for the code they haven't confirmed. */
export type CodeAnswer = "keep" | "leave" | "review" | "cancel";

/** Whether to go on with an export or a Preview, and with which of the site's code. */
export type CodeDecision =
  | { readonly go: false }
  | {
      readonly go: true;
      /** Which code the build will have: what the owner trusts, or kept just now. */
      readonly keeps: (text: string) => boolean;
      /** Whether Site Check may apply the site's allowed addresses. */
      readonly allowListConfirmed: boolean;
    };

/** The question the prompt asks, while it's open. */
export type CodeQuestion = {
  readonly pieces: readonly SiteCodePiece[];
  readonly answer: (answer: CodeAnswer) => void;
} | null;

/** What the window's code trust step works with. */
type CodeTrustOptions = {
  readonly api: TrustApi;
  readonly session: Pick<EditorSession, "history" | "onCodeWritten">;
  /** This opening of the site, as main knows it (R6). */
  readonly sessionId: () => string;
  /** Shows the first piece the owner wants to look at (Review): Settings, or the element. */
  readonly review: (piece: SiteCodePiece) => void;
  /** Says that trusting the code failed. */
  readonly notify: (message: "trust-failed") => void;
};

/** The window's code trust step. */
export type CodeTrust = {
  /**
   * Asks about the site's code the owner hasn't written here or confirmed, if any, before an
   * export or a Preview: *Keep the code* trusts it, *Leave it out* builds without it this time,
   * *Review* shows it and stops.
   */
  confirm(site: SiteDoc): Promise<CodeDecision>;
  /** The prompt's question, for its dialog. */
  readonly question: StoreApi<{ readonly question: CodeQuestion }>;
  /** Whether the site's allowed addresses are confirmed, for Site Check (false while unknown). */
  readonly allowListConfirmed: StoreApi<boolean>;
  /**
   * Calls `listener` each time main trusts more of the site's code, so a running Preview builds
   * again with it: main builds only what it trusts. Returns how to stop.
   */
  onTrusted(listener: () => void): () => void;
  /**
   * Starts following what the owner writes and the site's allow-list, while the window's areas
   * are connected. Returns how to stop, which first trusts what was written just before.
   */
  connect(): () => void;
};

/** The texts of `site`'s code. */
const textsOf = (site: SiteDoc) => new Set(siteCodePieces(site).map((piece) => piece.text));

/** The allow-list piece of `site`, if it has one. */
const allowListOf = (site: SiteDoc) =>
  siteCodePieces(site).find((piece) => piece.kind === "allowList");

/** The window's code trust step, for the open site. */
export function createCodeTrust({
  api,
  session,
  sessionId,
  review,
  notify,
}: CodeTrustOptions): CodeTrust {
  const question = createStore<{ readonly question: CodeQuestion }>(() => ({ question: null }));
  const allowListConfirmed = createStore<boolean>(() => false);
  const trustedListeners = new Set<() => void>();

  /** Which of `texts` main doesn't trust, by position; all of them when it can't say. */
  const untrustedAt = async (texts: readonly string[]): Promise<ReadonlySet<number>> => {
    if (texts.length === 0) return new Set();
    try {
      const result = await api.untrusted(sessionId(), texts);
      if (result.status === "checked") return new Set(result.untrusted);
    } catch (error) {
      reportFailure("codeTrust.check", error);
    }
    return new Set(texts.keys());
  };

  /** Which of `pieces` main doesn't trust; all of them when it can't say. */
  const untrustedOf = async (pieces: readonly SiteCodePiece[]): Promise<SiteCodePiece[]> => {
    const untrusted = await untrustedAt(pieces.map((piece) => piece.text));
    return pieces.filter((_, index) => untrusted.has(index));
  };

  const trust = async (texts: readonly string[]): Promise<boolean> => {
    if (texts.length === 0) return true;
    try {
      const result = await api.trust(sessionId(), texts);
      if (result.status === "trusted") {
        for (const listener of trustedListeners) listener();
        return true;
      }
    } catch (error) {
      reportFailure("codeTrust.trust", error);
    }
    return false;
  };

  /** Asks whether the site's allowed addresses are trusted, for Site Check. */
  let asked = 0;
  const checkAllowList = async () => {
    const mine = ++asked;
    const piece = allowListOf(session.history.document.getState());
    const confirmed = piece === undefined || (await untrustedOf([piece])).length === 0;
    if (mine === asked) allowListConfirmed.setState(confirmed, true);
  };

  const ask = (pieces: readonly SiteCodePiece[]) => {
    question.getState().question?.answer("cancel");
    return new Promise<CodeAnswer>((resolve) => {
      question.setState({
        question: {
          pieces,
          answer: (answer) => {
            question.setState({ question: null });
            resolve(answer);
          },
        },
      });
    });
  };

  // What the owner writes here is theirs (#649), as the fields they write code in say
  // (`codeWritten`): never a paste, a copied style, a shown element, an Undo or a Redo. Writing in
  // a piece only makes it the owner's when the piece was theirs already, or blank: a fix to a line
  // of someone else's script, or an address added to their list, leaves the rest to the prompt.
  // Typing changes a piece at every key, so what was written is trusted once the owner stops, as
  // far as the site still has it: never the steps on the way.
  /** Each text written, with the text it was first written from, or null when that was blank. */
  const written = new Map<string, string | null>();
  let writing: ReturnType<typeof setTimeout> | undefined;
  /** What was written being trusted now, which an export or a Preview waits for. */
  let trusting: Promise<void> = Promise.resolve();
  const trustNow = async (entries: readonly (readonly [string, string | null])[]) => {
    const current = textsOf(session.history.document.getState());
    const kept = entries.filter(([text]) => current.has(text));
    const origins = [...new Set(kept.flatMap(([, origin]) => (origin === null ? [] : [origin])))];
    const untrusted = await untrustedAt(origins);
    const theirs = new Set(origins.filter((_, index) => !untrusted.has(index)));
    const texts = kept.flatMap(([text, origin]) =>
      origin === null || theirs.has(origin) ? [text] : [],
    );
    if (texts.length > 0 && (await trust(texts))) void checkAllowList();
  };
  const trustWritten = () => {
    clearTimeout(writing);
    writing = undefined;
    const entries = [...written];
    written.clear();
    const next = trusting.then(() => trustNow(entries));
    trusting = next;
    return next;
  };
  const onWritten = (before: string, after: string) => {
    // Written over text written just now: from where that was written.
    const earlier = written.get(before);
    written.set(after, before.trim() === "" ? null : earlier !== undefined ? earlier : before);
    clearTimeout(writing);
    writing = setTimeout(() => void trustWritten(), WRITTEN_DELAY_MS);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastAllowList: string | undefined;
  const followAllowList = (site: SiteDoc) => {
    const text = allowListOf(site)?.text;
    if (text === lastAllowList) return;
    lastAllowList = text;
    clearTimeout(timer);
    timer = setTimeout(() => void checkAllowList(), ALLOW_LIST_DELAY_MS);
  };

  return {
    question,
    allowListConfirmed,
    onTrusted(listener) {
      trustedListeners.add(listener);
      return () => {
        trustedListeners.delete(listener);
      };
    },
    async confirm(site) {
      // What the owner has just written is theirs: it's never asked about.
      await (writing === undefined ? trusting : trustWritten());
      const pieces = siteCodePieces(site);
      const untrusted = await untrustedOf(pieces);
      if (untrusted.length === 0) {
        return { go: true, keeps: () => true, allowListConfirmed: true };
      }
      const answer = await ask(untrusted);
      if (answer === "keep") {
        if (!(await trust(untrusted.map((piece) => piece.text)))) {
          notify("trust-failed");
          return { go: false };
        }
        void checkAllowList();
        return { go: true, keeps: () => true, allowListConfirmed: true };
      }
      if (answer === "leave") {
        const left = new Set(untrusted.map((piece) => piece.text));
        return {
          go: true,
          keeps: (text) => !left.has(text),
          allowListConfirmed: !untrusted.some((piece) => piece.kind === "allowList"),
        };
      }
      const [first] = untrusted;
      if (answer === "review" && first !== undefined) review(first);
      return { go: false };
    },
    connect() {
      const stopWatching = session.onCodeWritten(onWritten);
      const stopFollowing = session.history.document.subscribe(followAllowList);
      lastAllowList = allowListOf(session.history.document.getState())?.text;
      void checkAllowList();
      return () => {
        // What was written just before the site closes, or the window, is still the owner's.
        if (writing !== undefined) void trustWritten();
        clearTimeout(timer);
        asked++;
        stopWatching();
        stopFollowing();
        question.getState().question?.answer("cancel");
      };
    },
  };
}
