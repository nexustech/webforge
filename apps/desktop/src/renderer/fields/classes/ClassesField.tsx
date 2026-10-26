import {
  Button,
  ClassesInput,
  describedBy,
  type FieldRenderer,
  type FieldRendererProps,
  Picker,
  type PickerItem,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { ThemeTokens } from "@webforge/model";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { CanvasApi } from "../../../shared/ipc/canvas.js";
import type { EditorSession } from "../../editor/editor-session.js";
import { useDocument } from "../../editor/use-document.js";
import { useClassCatalogue } from "./class-catalogue.js";
import { CLASS_CATEGORIES, classCategory, usesThemeColour } from "./class-categories.js";
import { type ClassCatalogue, closestClass, suggestClasses } from "./class-match.js";

/** What the field needs besides its props: the site's theme, and the canvas CSS worker (#276). */
type ClassesFieldContext = {
  readonly session: Pick<EditorSession, "history">;
  /** `window.webforge.canvas`, asked for as it's needed. */
  readonly canvas: () => CanvasApi;
};

/** The most classes the browser draws at once; a search finds the others. */
const BROWSED = 200;

/** The classes in a value, as typed. */
const classesOf = (value: string) => value.split(/\s+/).filter(Boolean);

/** The CSS each of `names` makes with `theme`, `null` for one that makes none; none if unknown. */
async function cssOf(
  canvas: () => CanvasApi,
  theme: ThemeTokens,
  names: readonly string[],
): Promise<readonly (string | null)[] | undefined> {
  try {
    const result = await canvas().classCss(theme, names);
    return result.status === "css" ? result.css : undefined;
  } catch {
    return undefined;
  }
}

/** A class's CSS, as the browser previews it, asked for when the person comes to it. */
function ClassPreview({
  name,
  theme,
  canvas,
}: {
  readonly name: string;
  readonly theme: ThemeTokens;
  readonly canvas: () => CanvasApi;
}) {
  const [css, setCss] = useState<{ readonly name: string; readonly css: string | null }>();
  useEffect(() => {
    let live = true;
    void cssOf(canvas, theme, [name]).then((answer) => {
      if (live) setCss({ name, css: answer?.[0] ?? null });
    });
    return () => {
      live = false;
    };
  }, [canvas, theme, name]);
  const shown = css?.name === name ? css : undefined;
  return (
    <>
      <p className="m-0 font-mono text-sm">{name}</p>
      <pre className="m-0 max-h-64 w-full overflow-auto rounded-sm bg-input p-2 font-mono text-2xs whitespace-pre-wrap">
        {shown === undefined
          ? t("editPanel.classes.previewLoading")
          : (shown.css ?? t("editPanel.classes.previewNone"))}
      </pre>
    </>
  );
}

/** What the field says about `unknown`, classes that make no style, with the closest to each. */
function warningsFor(unknown: readonly string[], catalogue: ClassCatalogue | undefined): string[] {
  return unknown.map((name) => {
    const suggestion = catalogue === undefined ? undefined : closestClass(catalogue, name);
    return suggestion === undefined
      ? t("editPanel.classes.unknownNoSuggestion", { name })
      : t("editPanel.classes.unknown", { name, suggestion });
  });
}

/**
 * The CSS classes field (Advanced mode, F-ED-11, #276). As a class is typed, the classes the site's
 * styles support that match it are suggested (Tailwind's and daisyUI's, the theme's colours
 * included); *Browse classes…* opens them by category in UX-15's shared picker, each previewed with
 * the CSS it makes. A class that makes no style is warned about, with the closest that does, and
 * still saved: the site's own code may use it. As the text field does, the value is checked and
 * kept when the person is done (Enter, or leaving the field), one undo step however it was typed.
 */
export function ClassesField({
  id,
  helpId,
  errorId,
  disabled = false,
  field,
  value,
  onChange,
  onCommit,
  session,
  canvas,
}: FieldRendererProps<"classes"> & ClassesFieldContext) {
  const stored = typeof value === "string" ? value : "";
  const theme = useDocument(session, (site) => site.theme);
  const catalogue = useClassCatalogue(canvas, theme);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [unknown, setUnknown] = useState<{ readonly value: string; readonly names: string[] }>();
  const checkId = useId();
  const warningsId = useId();

  // The classes kept that make no style, asked of the worker each time the value or theme changes.
  useEffect(() => {
    const names = classesOf(stored);
    if (names.length === 0) return;
    let live = true;
    void cssOf(canvas, theme, names).then((css) => {
      if (!live || css === undefined) return;
      setUnknown({ value: stored, names: names.filter((_, index) => css[index] === null) });
    });
    return () => {
      live = false;
    };
  }, [canvas, theme, stored]);
  const warnings =
    unknown?.value === stored && stored !== "" ? warningsFor(unknown.names, catalogue) : [];

  /** Keeps `text` if it's acceptable, else says why and leaves it to fix: one change. */
  const keep = (text: string) => {
    if (text === stored) {
      setDraft(null);
      setError(null);
      onCommit();
      return;
    }
    const problem = field.validate(text);
    if (problem !== undefined) {
      setDraft(text);
      setError(problem);
      return;
    }
    setDraft(null);
    setError(null);
    onChange(text);
    onCommit();
  };

  // Listed while the browser is open only: not again at every keystroke in the field.
  const items: (PickerItem & { readonly name: string })[] =
    catalogue === undefined || !browsing
      ? []
      : [...catalogue.classes]
          // The theme's colours first (`bg-primary`), then the rest as the catalogue has them.
          .sort((a, b) => Number(usesThemeColour(b)) - Number(usesThemeColour(a)))
          .map((name) => {
            const category = classCategory(name);
            return {
              id: name,
              label: name,
              name,
              ...(category === undefined
                ? {}
                : { category: t(`editPanel.classes.category.${category}`) }),
            };
          });

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ClassesInput
        id={id}
        value={draft ?? stored}
        placeholder={field.placeholder}
        disabled={disabled}
        invalid={error !== null || errorId !== undefined}
        describedBy={describedBy(
          error === null ? undefined : checkId,
          errorId,
          warnings.length === 0 ? undefined : warningsId,
          helpId,
        )}
        listLabel={t("editPanel.classes.suggestions")}
        suggest={(word) => (catalogue === undefined ? [] : suggestClasses(catalogue, word))}
        onValueChange={(text) => {
          setDraft(text);
          setError(null);
        }}
        onDone={() => {
          if (draft !== null) keep(draft);
        }}
        onRevert={() => {
          setDraft(null);
          setError(null);
        }}
      />
      {error === null ? null : (
        <p id={checkId} className="m-0 text-2xs text-destructive-text">
          {error}
        </p>
      )}
      <ul id={warningsId} aria-live="polite" className="m-0 flex list-none flex-col gap-0.5 p-0">
        {warnings.map((warning) => (
          <li key={warning} className="flex items-start gap-1 text-xs text-foreground">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warning" />
            {warning}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        aria-haspopup="dialog"
        disabled={disabled || catalogue === undefined}
        onClick={() => setBrowsing(true)}
      >
        {t("editPanel.classes.browse")}
      </Button>
      <Picker
        open={browsing}
        onOpenChange={setBrowsing}
        title={t("editPanel.classes.browseTitle")}
        description={t("editPanel.classes.browseDescription")}
        items={items}
        categories={CLASS_CATEGORIES.map((category) => t(`editPanel.classes.category.${category}`))}
        layout="list"
        limit={BROWSED}
        renderItem={() => null}
        renderPreview={(item) => <ClassPreview name={item.name} theme={theme} canvas={canvas} />}
        onChoose={(item) => {
          setBrowsing(false);
          const now = draft ?? stored;
          if (classesOf(now).includes(item.name)) return;
          keep([...classesOf(now), item.name].join(" "));
        }}
        emptyText={t("editPanel.classes.none")}
      />
    </div>
  );
}

/** The CSS classes field, with the site's theme from `session` and the canvas CSS worker. */
export function classesFieldRenderer(context: ClassesFieldContext): FieldRenderer<"classes"> {
  return function SiteClassesField(props: FieldRendererProps<"classes">) {
    return <ClassesField {...props} {...context} />;
  };
}
