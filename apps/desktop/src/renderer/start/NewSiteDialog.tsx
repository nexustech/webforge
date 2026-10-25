import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  fieldControlClass,
  ScrollArea,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
} from "@webforge/editor-ui";
import { isMessageKey, plural, t } from "@webforge/i18n";
import { DEFAULT_THEME, SITE_NAME_MAX, type ThemeTokens } from "@webforge/model";
import { TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateId } from "@webforge/templates";
import { oklchCss, THEME_PRESETS } from "@webforge/themes";
import { FileIcon } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import type { NewSiteRequest } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";

/** Props of {@link NewSiteDialog}. */
export type NewSiteDialogProps = {
  readonly open: boolean;
  /** The templates the app ships, as main lists them. */
  readonly templates: readonly TemplateSummary[];
  readonly onCreate: (request: NewSiteRequest) => void;
  readonly onCancel: () => void;
};

/** How the template grid is ordered (UX-29). */
const SORTS = ["name", "category"] as const;

/** One of {@link SORTS}. */
export type TemplateSort = (typeof SORTS)[number];

/**
 * The templates the grid shows: those of business type `category` (every one for `null`), by name,
 * or by business type and then name, as `names` gives them.
 */
export function arrangeTemplates<T extends { readonly category: string }>(
  templates: readonly T[],
  category: string | null,
  sort: TemplateSort,
  names: { readonly name: (template: T) => string; readonly category: (template: T) => string },
): T[] {
  return templates
    .filter((template) => category === null || template.category === category)
    .toSorted(
      (a, b) =>
        (sort === "category" ? names.category(a).localeCompare(names.category(b)) : 0) ||
        names.name(a).localeCompare(names.name(b)),
    );
}

/** A template's name, from its id. */
const templateName = (id: TemplateId): string => t(`template.${id}.name`);

/** A theme preset's name; the preset's own name for one the catalogue hasn't named yet. */
function presetLabel(preset: string): string {
  const key = `theme.preset.${preset}`;
  return isMessageKey(key) ? t(key) : preset;
}

/**
 * New Site (2.14a, F-SITE-1, LF-11, as Bootstrap Studio's New Design): the site's name and theme
 * on the left, with Create; on the right, *Blank site* and the templates, filtered by business
 * type and sorted by name or type, each with a Details preview. Choosing a template switches to
 * its theme, which can then be changed. Main makes the site.
 */
export function NewSiteDialog({ open, templates, onCreate, onCancel }: NewSiteDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      {/* The content mounts with each opening, so the dialog starts afresh every time. */}
      <DialogContent className="flex h-[min(44rem,calc(100dvh-2rem))] flex-col sm:max-w-5xl">
        <NewSiteBody templates={templates} onCreate={onCreate} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  );
}

function NewSiteBody({ templates, onCreate, onCancel }: Omit<NewSiteDialogProps, "open">) {
  const [name, setName] = useState(() => t("site.untitledName"));
  const [theme, setTheme] = useState(DEFAULT_THEME.preset);
  const [chosen, setChosen] = useState<TemplateId | null>(null);
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [sort, setSort] = useState<TemplateSort>("name");
  const [details, setDetails] = useState<TemplateSummary | null>(null);
  const themeId = useId();
  const choiceName = useId();
  const sortId = useId();

  const choose = (template: TemplateSummary | null) => {
    setChosen(template?.id ?? null);
    if (template !== null) setTheme(template.theme);
  };

  // Only the business types some template has.
  const categories = TEMPLATE_CATEGORIES.filter((each) =>
    templates.some((template) => template.category === each),
  );
  const shown = arrangeTemplates(templates, category, sort, {
    name: (template) => templateName(template.id),
    category: (template) => t(`template.category.${template.category}`),
  });
  const trimmed = name.trim();

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed === "") return;
        onCreate({ name: trimmed, theme, ...(chosen === null ? {} : { template: chosen }) });
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("newSite.title")}</DialogTitle>
        <DialogDescription>{t("newSite.description")}</DialogDescription>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-60 shrink-0 flex-col gap-3">
          <TextInput
            label={t("newSite.name")}
            value={name}
            onChange={setName}
            maxLength={SITE_NAME_MAX}
            required
          />
          <fieldset aria-labelledby={themeId} className="m-0 flex min-h-0 flex-col gap-1 p-0">
            <span id={themeId} className="text-xs text-muted-foreground">
              {t("newSite.theme")}
            </span>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-1 p-px">
                {THEME_PRESETS.map((preset) => (
                  <ThemeOption
                    key={preset.preset}
                    preset={preset}
                    name={`${choiceName}-theme`}
                    checked={theme === preset.preset}
                    onChoose={() => setTheme(preset.preset)}
                  />
                ))}
              </div>
            </ScrollArea>
          </fieldset>
          <DialogFooter className="mt-auto">
            <Button type="button" variant="secondary" onClick={onCancel}>
              {t("newSite.cancel")}
            </Button>
            <Button type="submit" disabled={trimmed === ""}>
              {t("newSite.create")}
            </Button>
          </DialogFooter>
        </div>
        <ScrollArea className="min-h-0 flex-1 rounded-md border border-border bg-panel">
          <div className="flex flex-col gap-4 p-3">
            <section className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold">{t("newSite.blankHeading")}</h3>
              <div className={GRID}>
                <Card
                  name={choiceName}
                  checked={chosen === null}
                  onChoose={() => choose(null)}
                  preview={<FileIcon className="size-8 text-muted-foreground" aria-hidden />}
                  title={t("newSite.blank")}
                  subtitle={t("newSite.blankDescription")}
                />
              </div>
            </section>
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 mr-auto text-sm font-semibold">
                  {t("newSite.templatesHeading")}
                </h3>
                <ToggleGroup
                  type="single"
                  aria-label={t("newSite.categories")}
                  value={category ?? "all"}
                  onValueChange={(next) =>
                    setCategory(categories.find((each) => each === next) ?? null)
                  }
                >
                  <ToggleGroupItem value="all">{t("newSite.category.all")}</ToggleGroupItem>
                  {categories.map((each) => (
                    <ToggleGroupItem key={each} value={each}>
                      {t(`template.category.${each}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <label htmlFor={sortId} className="text-xs text-muted-foreground">
                  {t("newSite.sort")}
                </label>
                <select
                  id={sortId}
                  className={cn(fieldControlClass, "w-auto")}
                  value={sort}
                  onChange={(event) =>
                    setSort(SORTS.find((each) => each === event.target.value) ?? "name")
                  }
                >
                  {SORTS.map((each) => (
                    <option key={each} value={each}>
                      {t(`newSite.sort.${each}`)}
                    </option>
                  ))}
                </select>
              </div>
              {shown.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">{t("newSite.noTemplates")}</p>
              ) : (
                <div className={GRID}>
                  {shown.map((template) => (
                    <Card
                      key={template.id}
                      name={choiceName}
                      checked={chosen === template.id}
                      onChoose={() => choose(template)}
                      preview={<TemplatePreview template={template} />}
                      title={templateName(template.id)}
                      subtitle={`${t(`template.category.${template.category}`)} · ${plural("newSite.pages", template.pages)}`}
                      details={() => setDetails(template)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </div>
      <TemplateDetails
        template={details}
        onUse={(template) => {
          choose(template);
          setDetails(null);
        }}
        onClose={() => setDetails(null)}
      />
    </form>
  );
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3";

/** The colours a theme's swatch row shows: its page, then its brand colours. */
const SWATCHES = ["base-100", "primary", "secondary", "accent"] as const;

/** A theme preset to choose: its name and a row of its main colours. */
function ThemeOption({
  preset,
  name,
  checked,
  onChoose,
}: {
  readonly preset: ThemeTokens;
  readonly name: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
}) {
  const { colors } = preset;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 text-sm",
        "hover:bg-hover has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
      )}
    >
      <input
        type="radio"
        name={name}
        value={preset.preset}
        checked={checked}
        onChange={onChoose}
        className="sr-only"
      />
      <span className="flex shrink-0" aria-hidden>
        {SWATCHES.map((role) => (
          <span
            key={role}
            className="-ml-1 size-4 rounded-full border border-border-strong first:ml-0"
            style={{ backgroundColor: oklchCss(colors[role]) }}
          />
        ))}
      </span>
      <span className="truncate">{presetLabel(preset.preset)}</span>
    </label>
  );
}

/** A starting point to choose (Blank, or a template): a radio drawn as a card. */
function Card({
  name,
  checked,
  onChoose,
  preview,
  title,
  subtitle,
  details,
}: {
  readonly name: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
  readonly preview: ReactNode;
  readonly title: string;
  readonly subtitle: string;
  /** Opens the larger preview; none for Blank. */
  readonly details?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-md border border-border bg-card",
        "hover:border-border-strong has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary",
        "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring",
      )}
    >
      <label className="flex cursor-pointer flex-col">
        <input type="radio" name={name} checked={checked} onChange={onChoose} className="sr-only" />
        <span className="flex aspect-video w-full items-center justify-center bg-muted">
          {preview}
        </span>
        <span className={cn("flex flex-col gap-0.5 p-2", details !== undefined && "pr-20")}>
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </label>
      {details === undefined ? null : (
        // Outside the label, so it opens the preview without choosing the card.
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="absolute right-1 bottom-2"
          aria-label={t("newSite.detailsOf", { name: title })}
          onClick={details}
        >
          {t("newSite.details")}
        </Button>
      )}
    </div>
  );
}

/**
 * A template's picture: its theme's colours until 2.14b's thumbnails, so cards in different themes
 * already look different.
 */
function TemplatePreview({ template }: { readonly template: TemplateSummary }) {
  const colors = (THEME_PRESETS.find((preset) => preset.preset === template.theme) ?? DEFAULT_THEME)
    .colors;
  return (
    <span
      className="flex size-full flex-col justify-end gap-1 p-3"
      style={{ backgroundColor: oklchCss(colors["base-100"]) }}
      aria-hidden
    >
      <span
        className="h-2 w-1/2 rounded-full"
        style={{ backgroundColor: oklchCss(colors["base-content"]) }}
      />
      <span
        className="h-2 w-1/3 rounded-full"
        style={{ backgroundColor: oklchCss(colors.primary) }}
      />
    </span>
  );
}

/** A template's larger preview, its description, and Use this template. */
function TemplateDetails({
  template,
  onUse,
  onClose,
}: {
  readonly template: TemplateSummary | null;
  readonly onUse: (template: TemplateSummary) => void;
  readonly onClose: () => void;
}) {
  return (
    <Dialog
      open={template !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {template === null ? null : (
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{templateName(template.id)}</DialogTitle>
            <DialogDescription>{t(`template.${template.id}.description`)}</DialogDescription>
          </DialogHeader>
          <span className="flex aspect-video w-full overflow-hidden rounded-md border border-border">
            <TemplatePreview template={template} />
          </span>
          <p className="m-0 text-xs text-muted-foreground">
            {`${t(`template.category.${template.category}`)} · ${plural("newSite.pages", template.pages)} · ${presetLabel(template.theme)}`}
          </p>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("newSite.cancel")}
            </Button>
            <Button type="button" onClick={() => onUse(template)}>
              {t("newSite.useTemplate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
