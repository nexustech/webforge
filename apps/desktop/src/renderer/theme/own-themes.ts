import { t } from "@webforge/i18n";
import type { ThemeTokens } from "@webforge/model";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { OwnTheme, ThemesApi } from "../../shared/ipc/themes.js";

/** What the person asks a name for: what the dialog says, and the name it starts with. */
type NameQuestion = {
  readonly title: string;
  readonly description?: string;
  readonly initial: string;
  readonly confirm: string;
};

/** A new theme: what it starts from, and its name. */
export type NewTheme = { readonly base: ThemeTokens; readonly name: string };

/** The question My themes' dialogs show, if any. */
type OwnThemeQuestion =
  /** A name: for the person's own version of a built-in theme, or a new name for one of theirs. */
  | ({ readonly kind: "name" } & NameQuestion)
  /** Whether to delete one of their themes from this computer; `inUse` if the site uses it. */
  | { readonly kind: "delete"; readonly name: string; readonly inUse: boolean }
  /** What to start a new theme from, and its name (Theme Studio's *New theme*). */
  | { readonly kind: "new" };

/** The id of one of the person's own themes. */
type OwnThemeId = OwnTheme["own"]["id"];

/** My themes as the editor has them: the list on this computer, and the question open, if any. */
export type OwnThemesState = {
  /** The person's own themes on this computer, most recently kept first. */
  readonly themes: readonly OwnTheme[];
  readonly question: OwnThemeQuestion | null;
  /**
   * Themes deleted in this window that the site still uses: not listed, and not kept again when
   * the site's theme changes, until the site uses another theme ({@link OwnThemes.siteThemeIs}).
   */
  readonly deleted: readonly OwnThemeId[];
};

/** What a theme change asks of My themes (2.23): a name for the person's own version. */
export type OwnThemeNames = {
  /** Asks for a name; `undefined` if the person cancels. */
  askName(question: NameQuestion): Promise<string | undefined>;
};

/** My themes (2.23, PH2-17): see {@link createOwnThemes}. */
export type OwnThemes = OwnThemeNames & {
  readonly store: StoreApi<OwnThemesState>;
  /** Reads the list again from this computer. */
  refresh(): Promise<void>;
  /** Keeps `theme`, the person's own, on this computer: first in the list, by its id. */
  keep(theme: OwnTheme): void;
  /** Sends every keep still waiting now; resolves once they're done (the window closing). */
  flush(): Promise<void>;
  /** Removes the theme with `id` from this computer. */
  remove(id: OwnThemeId): void;
  /** The site's theme is now the person's theme `id`, or a built-in one: forgets other deletions. */
  siteThemeIs(id: OwnThemeId | undefined): void;
  /** Asks whether to delete the theme `name` from this computer. */
  confirmDelete(name: string, inUse: boolean): Promise<boolean>;
  /** Asks what to start a new theme from, and its name; `undefined` if the person cancels. */
  askNew(): Promise<NewTheme | undefined>;
  /** The person's answer to the question open: a name, a yes or no, or a new theme. */
  answer(answer: string | boolean | NewTheme | undefined): void;
};

/** How long a theme waits before it's kept: a run of changes is one write (#500 review). */
const KEEP_DELAY_MS = 500;

/**
 * My themes for the window (2.23, PH2-17): the person's own themes, kept on this computer through
 * `api` (`window.webforge.themes`, asked for when it's needed), and the questions their dialogs
 * ask, one at a time: asking again cancels the one open. Not site content, so never an undo step.
 * A theme is kept {@link KEEP_DELAY_MS} after its last change; a list read meanwhile shows it as
 * changed. When keeping or removing one fails, or My themes is full, `notify` says so and the list
 * is read again, so it shows what this computer has.
 */
export function createOwnThemes(
  api: () => ThemesApi,
  options: { readonly notify?: (message: string) => void; readonly delayMs?: number } = {},
): OwnThemes {
  const delayMs = options.delayMs ?? KEEP_DELAY_MS;
  const notify = options.notify ?? (() => undefined);
  const store = createStore<OwnThemesState>()(() => ({ themes: [], question: null, deleted: [] }));
  let settle: ((answer: string | boolean | NewTheme | undefined) => void) | null = null;
  /** Themes changed but not kept yet, by id, with their timers. */
  const waiting = new Map<OwnThemeId, { theme: OwnTheme; timer: ReturnType<typeof setTimeout> }>();
  /** Counts changes to the list, so a list read before one is dropped when it comes. */
  let generation = 0;

  /** Shows `question`; resolves with what `read` makes of the answer, `undefined` if cancelled. */
  function ask<T>(
    question: OwnThemeQuestion,
    read: (answer: string | boolean | NewTheme | undefined) => T,
  ): Promise<T> {
    settle?.(undefined);
    return new Promise<T>((resolve) => {
      const mine = (answer: string | boolean | NewTheme | undefined) => {
        if (settle !== mine) return;
        settle = null;
        store.setState({ question: null });
        resolve(read(answer));
      };
      settle = mine;
      store.setState({ question });
    });
  }

  /** `listed` with the themes still waiting to be kept in front, as they now are. */
  const withWaiting = (listed: readonly OwnTheme[]) => {
    const changed = [...waiting.values()].map((each) => each.theme);
    const ids = new Set(changed.map((theme) => theme.own.id));
    return [...changed, ...listed.filter((theme) => !ids.has(theme.own.id))];
  };

  async function refresh() {
    const asked = generation;
    try {
      const listed = await api().list();
      if (asked === generation) store.setState({ themes: withWaiting(listed) });
    } catch {
      // My themes can't be read now: the list stays as it was.
    }
  }

  /** Says `message`, and reads the list again so it shows what this computer has. */
  const failed = (message: string) => {
    notify(message);
    void refresh();
  };

  /** Keeps `theme` on this computer now. */
  async function send(theme: OwnTheme) {
    waiting.delete(theme.own.id);
    try {
      if ((await api().keep(theme)) === "full") failed(t("theme.own.full"));
    } catch {
      failed(t("theme.own.keepFailed", { name: theme.own.name }));
    }
  }

  return {
    store,
    refresh,
    keep(theme) {
      if (store.getState().deleted.includes(theme.own.id)) return;
      generation += 1;
      const others = store.getState().themes.filter((each) => each.own.id !== theme.own.id);
      store.setState({ themes: [theme, ...others] });
      const before = waiting.get(theme.own.id);
      if (before !== undefined) clearTimeout(before.timer);
      waiting.set(theme.own.id, { theme, timer: setTimeout(() => void send(theme), delayMs) });
    },
    async flush() {
      const now = [...waiting.values()];
      for (const each of now) clearTimeout(each.timer);
      await Promise.all(now.map((each) => send(each.theme)));
    },
    remove(id) {
      generation += 1;
      const before = waiting.get(id);
      if (before !== undefined) clearTimeout(before.timer);
      waiting.delete(id);
      const { themes, deleted } = store.getState();
      store.setState({
        themes: themes.filter((each) => each.own.id !== id),
        deleted: deleted.includes(id) ? deleted : [...deleted, id],
      });
      api()
        .remove(id)
        .catch(() => failed(t("theme.own.removeFailed")));
    },
    siteThemeIs(id) {
      const { deleted } = store.getState();
      const kept = deleted.filter((each) => each === id);
      if (kept.length !== deleted.length) store.setState({ deleted: kept });
    },
    askName(question) {
      return ask({ kind: "name", ...question }, (answer) =>
        typeof answer === "string" ? answer : undefined,
      );
    },
    confirmDelete(name, inUse) {
      return ask({ kind: "delete", name, inUse }, (answer) => answer === true);
    },
    askNew() {
      return ask({ kind: "new" }, (answer) =>
        typeof answer === "object" && answer !== null ? answer : undefined,
      );
    },
    answer(answer) {
      settle?.(answer);
    },
  };
}
