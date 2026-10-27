import { type FormPart, type FormSpec, type FormValues, formPart } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";

/** Where a part of Settings is listed (LF-12): the app's own, or the open site's. */
export type SettingsHeading = "app" | "site";

/** A part of Settings as the dialog opens: its form, and how to keep what Save gives it. */
export type OpenSettings = {
  readonly form: FormPart;
  /** Keeps the part's checked output: preferences saved, a site's settings one undo step. */
  readonly save: (output: unknown) => void;
};

/** A part of Settings, as an area registers it (LF-12, the registry deferred from 2.21). */
type SettingsEntry = {
  /** Unique: "interface", "devices", "site". */
  readonly id: string;
  readonly heading: SettingsHeading;
  /** Its place under its heading, lowest first; ties keep registration order. */
  readonly order?: number;
  /**
   * Its part, made as the dialog opens from what it shows then (R9), or undefined while it has
   * nothing to show.
   */
  readonly open: () => OpenSettings | undefined;
};

/** A request to open the Settings dialog on one section, and what to tell when it closes. */
type SettingsShowRequest = {
  /** The part's id ("site"), and the id of the section (its form's group) to open on. */
  readonly part: string;
  readonly group: string;
  /** Called once the dialog closes: `true` if the person saved. */
  readonly closed: (saved: boolean) => void;
};

/** The registry: the window's Settings dialog shows what areas register here. */
export type SettingsRegistry = {
  /** Adds a part and returns a function that removes it. Ids must be unique. */
  register(entry: SettingsEntry): () => void;
  /** The parts, App's before This site's, each in its order. */
  list(): readonly SettingsEntry[];
  /** Calls `listener` after a part is added or removed; returns a function that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Opens the Settings dialog on `group` of the part `part`, as a step that needs a setting does
   * (the export's web address, X3), and resolves once it closes: `true` if the person saved. With
   * no dialog to open (none drawn yet), resolves `false` at once.
   */
  show(part: string, group: string): Promise<boolean>;
  /** The dialog's host: told of each {@link show}. Returns a function that stops it. */
  onShow(listener: (request: SettingsShowRequest) => void): () => void;
};

/** Creates an empty registry. */
export function createSettingsRegistry(): SettingsRegistry {
  const entries = new Map<string, SettingsEntry>();
  const listeners = new Set<() => void>();
  let host: ((request: SettingsShowRequest) => void) | undefined;
  const changed = () => {
    for (const listener of listeners) listener();
  };
  const HEADINGS: readonly SettingsHeading[] = ["app", "site"];
  return {
    register(entry) {
      if (entries.has(entry.id)) {
        throw new Error(`Settings "${entry.id}" are already registered`);
      }
      entries.set(entry.id, entry);
      changed();
      return () => {
        if (entries.get(entry.id) !== entry) return;
        entries.delete(entry.id);
        changed();
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    show(part, group) {
      const shows = host;
      if (shows === undefined) return Promise.resolve(false);
      return new Promise((resolve) => shows({ part, group, closed: resolve }));
    },
    onShow(listener) {
      host = listener;
      return () => {
        if (host === listener) host = undefined;
      };
    },
    list: () =>
      HEADINGS.flatMap((heading) =>
        [...entries.values()]
          .filter((entry) => entry.heading === heading)
          // A stable sort: ties keep registration order.
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      ),
  };
}

/**
 * A part of Settings from its form: listed under `heading`, named `label` where its spec has no
 * groups of its own, saving its output with `save`.
 */
export function settingsPart<V extends FormValues, Out>({
  id,
  heading,
  label,
  spec,
  initial,
  save,
}: {
  readonly id: string;
  readonly heading: SettingsHeading;
  readonly label: string;
  readonly spec: FormSpec<V, Out>;
  readonly initial: V;
  readonly save: (output: Out) => void;
}): OpenSettings {
  return {
    form: formPart({ id, heading: t(`settings.heading.${heading}`), label, spec, initial }),
    // The output is what this part's own schema passed: its `Out`.
    save: (output) => save(output as Out),
  };
}
