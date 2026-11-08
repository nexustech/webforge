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
import { plural, t } from "@webforge/i18n";
import { DEFAULT_THEME, SITE_NAME_MAX } from "@webforge/model";
import { TEMPLATE_CATEGORIES, type TemplateCategory, type TemplateId } from "@webforge/templates";
import { THEME_PRESETS } from "@webforge/themes";
import { FileIcon } from "lucide-react";
import { useId, useState } from "react";
import type { NewSiteRequest } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { StartingPointCard } from "./StartingPointCard.js";
import { TemplateDetails } from "./TemplateDetails.js";
import { TemplatePreview } from "./TemplatePreview.js";
import { ThemeOption } from "./ThemeOption.js";
import { TEMPLATE_GRID, templateName } from "./template-labels.js";

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
        // The name replaces the template's sample business (QS-2), in its copy as well.
        onCreate({
          name: trimmed,
          theme,
          business: {},
          ...(chosen === null ? {} : { template: chosen }),
        });
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
              <div className={TEMPLATE_GRID}>
                <StartingPointCard
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
                <div className={TEMPLATE_GRID}>
                  {shown.map((template) => (
                    <StartingPointCard
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
