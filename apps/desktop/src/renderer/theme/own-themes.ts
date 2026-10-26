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

/** My themes as the editor has them: the list on this computer, and the question open, if any. */
export type OwnThemesState = {
  /** The person's own themes on this computer, most recently kept first. */
  readonly themes: readonly OwnTheme[];
  readonly question: OwnThemeQuestion | null;
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
  /** Removes the theme with `id` from this computer. */
  remove(id: OwnTheme["own"]["id"]): void;
  /** Asks whether to delete the theme `name` from this computer. */
  confirmDelete(name: string, inUse: boolean): Promise<boolean>;
  /** Asks what to start a new theme from, and its name; `undefined` if the person cancels. */
  askNew(): Promise<NewTheme | undefined>;
  /** The person's answer to the question open: a name, a yes or no, or a new theme. */
  answer(answer: string | boolean | NewTheme | undefined): void;
};

/**
 * My themes for the window (2.23, PH2-17): the person's own themes, kept on this computer through
 * `api` (`window.webforge.themes`, asked for when it's needed), and the questions their dialogs
 * ask, one at a time: asking again cancels the one open. Not site content, so never an undo step.
 */
export function createOwnThemes(api: () => ThemesApi): OwnThemes {
  const store = createStore<OwnThemesState>()(() => ({ themes: [], question: null }));
  let settle: ((answer: string | boolean | NewTheme | undefined) => void) | null = null;

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

  return {
    store,
    async refresh() {
      try {
        store.setState({ themes: await api().list() });
      } catch {
        // My themes can't be read now: the list stays as it was.
      }
    },
    keep(theme) {
      const others = store.getState().themes.filter((each) => each.own.id !== theme.own.id);
      store.setState({ themes: [theme, ...others] });
      api()
        .keep(theme)
        .catch(() => undefined);
    },
    remove(id) {
      store.setState({ themes: store.getState().themes.filter((each) => each.own.id !== id) });
      api()
        .remove(id)
        .catch(() => undefined);
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
