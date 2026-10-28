import {
  Button,
  Check,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  type FormState,
  ScrollArea,
  TextInput,
  ToggleGroup,
  ToggleGroupItem,
  useForm,
} from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n";
import { DEFAULT_THEME, SITE_DESCRIPTION_MAX, SITE_NAME_MAX } from "@webforge/model";
import { type BusinessDetails, TEMPLATE_CATEGORIES } from "@webforge/templates";
import { type ImageColour, imageColours, oklchCss, THEME_PRESETS } from "@webforge/themes";
import { FileIcon, ImageIcon } from "lucide-react";
import { type ChangeEvent, useId, useRef, useState } from "react";
import type { NewSiteRequest } from "../../shared/ipc/project.js";
import type { TemplateSummary } from "../../shared/ipc/templates.js";
import { hexOf } from "../fields/index.js";
import { recipeName } from "../site/index.js";
import { readPixels } from "../theme/index.js";
import {
  Card,
  presetLabel,
  TEMPLATE_GRID,
  TemplateDetails,
  TemplatePreview,
  ThemeOption,
  templateName,
} from "./NewSiteDialog.js";
import {
  emptyAnswers,
  palettesFor,
  type QuickStartAnswers,
  type QuickStartColours,
  quickStartRequest,
  recipesOffered,
  templatesOf,
  themeOf,
  withCategory,
  withTemplate,
} from "./quick-start.js";
import {
  type DetailsValues,
  detailsAnswers,
  detailsSpec,
  EMPTY_DETAILS,
} from "./quick-start-form.js";

/** The quick start's steps, in order (QS-1). */
const QUICK_START_STEPS = ["business", "look", "pages", "details"] as const;

/** One of {@link QUICK_START_STEPS}. */
export type QuickStartStep = (typeof QUICK_START_STEPS)[number];

/** Props of {@link QuickStartDialog}. */
export type QuickStartDialogProps = {
  readonly open: boolean;
  /** The templates the app ships, as main lists them. */
  readonly templates: readonly TemplateSummary[];
  readonly onCreate: (request: NewSiteRequest) => void;
  /** Opens a template's finished example site instead (PG-3). */
  readonly onTryExample: (template: TemplateSummary) => void;
  /** Opens New Site instead (QS-4): *Choose a template yourself*. */
  readonly onChooseTemplate: () => void;
  readonly onCancel: () => void;
  /** Reads a picture's pixels; drawn on a canvas by default. */
  readonly read?: (url: string) => Promise<ArrayLike<number>>;
  /** The step it opens on: the first, but for stories. */
  readonly initialStep?: QuickStartStep;
};

/**
 * The quick start (QS-1, 3.11b): four steps, *Your business*, *A look*, *Pages* and *Colours and
 * details*, whose answers drive the next step's choices; any can be skipped, and Create makes the
 * site from any step, with what's left as the template has it (QS-6). A dialog in New Site's layout
 * (LF-11). Main makes the site, with the person's business in place of the template's (QS-2).
 */
export function QuickStartDialog({ open, ...body }: QuickStartDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) body.onCancel();
      }}
    >
      {/* The content mounts with each opening, so the quick start starts afresh every time. */}
      <DialogContent className="flex h-[min(44rem,calc(100dvh-2rem))] flex-col sm:max-w-5xl">
        <QuickStartBody {...body} />
      </DialogContent>
    </Dialog>
  );
}

function QuickStartBody({
  templates,
  onCreate,
  onTryExample,
  onChooseTemplate,
  onCancel,
  read = readPixels,
  initialStep = "business",
}: Omit<QuickStartDialogProps, "open">) {
  const untitled = t("site.untitledName");
  const [answers, setAnswers] = useState(() => emptyAnswers(untitled));
  const [step, setStep] = useState(QUICK_START_STEPS.indexOf(initialStep));
  const [spec] = useState(detailsSpec);
  const details = useForm(spec, EMPTY_DETAILS);
  // Kept while the person moves between steps: the logo's colours once read, and their own colour.
  const [logo, setLogo] = useState<readonly ImageColour[] | null>(null);
  const [hex, setHex] = useState(() => hexOf(DEFAULT_THEME.colors.primary));
  const last = step === QUICK_START_STEPS.length - 1;
  const change = (patch: Partial<QuickStartAnswers>) =>
    setAnswers((current) => ({ ...current, ...patch }));

  const create = () => {
    // Details typed in the wrong form stop it, on the step that shows them.
    if (!details.submit().ok) {
      setStep(QUICK_START_STEPS.length - 1);
      return;
    }
    onCreate(quickStartRequest({ ...answers, ...detailsAnswers(details.values) }, untitled));
  };

  const current = QUICK_START_STEPS[step] ?? "business";
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (last) create();
        else setStep(step + 1);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("quickStart.title")}</DialogTitle>
        <DialogDescription>{t("quickStart.description")}</DialogDescription>
      </DialogHeader>
      <StepList step={step} onStep={setStep} />
      <div className="flex min-h-0 flex-1 flex-col">
        {current === "business" ? (
          <BusinessStep
            answers={answers}
            onChange={change}
            onCategory={(category) => setAnswers((now) => withCategory(now, category, templates))}
          />
        ) : current === "look" ? (
          <LookStep
            answers={answers}
            templates={templates}
            onTemplate={(template) => setAnswers((now) => withTemplate(now, template))}
            onTheme={(theme) => change({ theme })}
            onTryExample={onTryExample}
          />
        ) : current === "pages" ? (
          <PagesStep answers={answers} templates={templates} onChange={change} />
        ) : (
          <DetailsStep
            answers={answers}
            details={details}
            logo={logo}
            hex={hex}
            read={read}
            onColours={(colours) => change({ colours })}
            onLogo={(colours) => {
              setLogo(colours);
              change({ colours: { kind: "logo", colours } });
            }}
            onHex={(next) => {
              setHex(next);
              change({ colours: { kind: "colour", hex: next } });
            }}
          />
        )}
      </div>
      <DialogFooter className="items-center">
        <Button type="button" variant="link" className="mr-auto px-0" onClick={onChooseTemplate}>
          {t("quickStart.chooseTemplate")}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("quickStart.cancel")}
        </Button>
        {step === 0 ? null : (
          <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
            {t("quickStart.back")}
          </Button>
        )}
        {last ? null : (
          <Button type="button" variant="outline" onClick={create}>
            {t("quickStart.create")}
          </Button>
        )}
        <Button type="submit">{last ? t("quickStart.create") : t("quickStart.next")}</Button>
      </DialogFooter>
    </form>
  );
}

/** The steps, the one shown marked, each a button that goes to it: none has to be done first. */
function StepList({
  step,
  onStep,
}: {
  readonly step: number;
  readonly onStep: (step: number) => void;
}) {
  return (
    <ol aria-label={t("quickStart.steps")} className="m-0 grid list-none grid-cols-4 gap-3 p-0">
      {QUICK_START_STEPS.map((id, index) => (
        <li key={id}>
          <button
            type="button"
            aria-current={index === step ? "step" : undefined}
            onClick={() => onStep(index)}
            className={cn(
              "flex w-full flex-col gap-0.5 border-t-2 pt-2 text-left text-sm",
              "focus-visible:outline-2 focus-visible:outline-ring",
              index <= step ? "border-primary" : "border-border",
              index === step ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <span className="text-xs font-normal text-muted-foreground">
              {t("quickStart.stepOf", { step: index + 1, count: QUICK_START_STEPS.length })}
            </span>
            {t(`quickStart.step.${id}`)}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** *Your business*: the business type, the name and one line of what it does. */
function BusinessStep({
  answers,
  onChange,
  onCategory,
}: {
  readonly answers: QuickStartAnswers;
  readonly onChange: (patch: Partial<QuickStartAnswers>) => void;
  readonly onCategory: (category: QuickStartAnswers["category"]) => void;
}) {
  const typeId = useId();
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex max-w-2xl flex-col gap-5 p-px">
        <div className="flex flex-col gap-2">
          <p id={typeId} className="m-0 text-sm font-medium">
            {t("quickStart.businessType")}
          </p>
          <ToggleGroup
            type="single"
            aria-labelledby={typeId}
            className="flex-wrap justify-start"
            value={answers.category ?? ""}
            onValueChange={(next) =>
              onCategory(TEMPLATE_CATEGORIES.find((each) => each === next) ?? null)
            }
          >
            {TEMPLATE_CATEGORIES.map((each) => (
              <ToggleGroupItem key={each} value={each} className="h-9 px-3 text-sm">
                {t(`template.category.${each}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <TextInput
          label={t("quickStart.name")}
          value={answers.name}
          onChange={(name) => onChange({ name })}
          maxLength={SITE_NAME_MAX}
        />
        <TextInput
          label={t("quickStart.whatYouDo")}
          hint={t("quickStart.whatYouDoHint")}
          value={answers.whatYouDo}
          onChange={(whatYouDo) => onChange({ whatYouDo })}
          maxLength={SITE_DESCRIPTION_MAX}
        />
      </div>
    </ScrollArea>
  );
}

/**
 * *A look*: the business type's templates as pictures (every template while no type is chosen),
 * Blank, *Try an example* where the type has one, and the theme, which a template sets first.
 */
function LookStep({
  answers,
  templates,
  onTemplate,
  onTheme,
  onTryExample,
}: {
  readonly answers: QuickStartAnswers;
  readonly templates: readonly TemplateSummary[];
  readonly onTemplate: (template: TemplateSummary | null) => void;
  readonly onTheme: (theme: string) => void;
  readonly onTryExample: (template: TemplateSummary) => void;
}) {
  const [details, setDetails] = useState<TemplateSummary | null>(null);
  const themeId = useId();
  const choiceName = useId();
  const shown = templatesOf(templates, answers.category);
  const example = shown.find((template) => template.example);
  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <fieldset aria-labelledby={themeId} className="m-0 flex w-60 shrink-0 flex-col gap-1 p-0">
        <span id={themeId} className="text-xs text-muted-foreground">
          {t("quickStart.theme")}
        </span>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1 p-px">
            {THEME_PRESETS.map((preset) => (
              <ThemeOption
                key={preset.preset}
                preset={preset}
                name={`${choiceName}-theme`}
                checked={answers.theme === preset.preset}
                onChoose={() => onTheme(preset.preset)}
              />
            ))}
          </div>
        </ScrollArea>
      </fieldset>
      <ScrollArea className="min-h-0 flex-1 rounded-md border border-border bg-panel">
        <div className="flex flex-col gap-3 p-3">
          <h3 className="m-0 text-sm font-semibold">
            {answers.category === null
              ? t("quickStart.templates")
              : t("quickStart.templatesFor", {
                  type: t(`template.category.${answers.category}`),
                })}
          </h3>
          {example === undefined ? null : (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              <span className="mr-auto">
                {t("quickStart.exampleText", { name: templateName(example.id) })}
              </span>
              <Button type="button" variant="outline" onClick={() => onTryExample(example)}>
                {t("quickStart.tryExample")}
              </Button>
            </div>
          )}
          <div className={TEMPLATE_GRID}>
            {shown.map((template) => (
              <Card
                key={template.id}
                name={choiceName}
                checked={answers.template === template.id}
                onChoose={() => onTemplate(template)}
                preview={<TemplatePreview template={template} />}
                title={templateName(template.id)}
                // Its business type only while every type's are shown: the heading names it otherwise.
                subtitle={
                  answers.category === null
                    ? `${t(`template.category.${template.category}`)} · ${plural("newSite.pages", template.pages)}`
                    : plural("newSite.pages", template.pages)
                }
                details={() => setDetails(template)}
              />
            ))}
            <Card
              name={choiceName}
              checked={answers.template === null}
              onChoose={() => onTemplate(null)}
              preview={<FileIcon className="size-8 text-muted-foreground" aria-hidden />}
              title={t("newSite.blank")}
              subtitle={t("newSite.blankDescription")}
            />
          </div>
        </div>
      </ScrollArea>
      <TemplateDetails
        template={details}
        onUse={(template) => {
          onTemplate(template);
          setDetails(null);
        }}
        onClose={() => setDetails(null)}
      />
    </div>
  );
}

/**
 * *Pages*: the template's pages, ticked, the home page always kept; then the business type's page
 * recipes (QS-3), unticked.
 */
function PagesStep({
  answers,
  templates,
  onChange,
}: {
  readonly answers: QuickStartAnswers;
  readonly templates: readonly TemplateSummary[];
  readonly onChange: (patch: Partial<QuickStartAnswers>) => void;
}) {
  const template = templates.find((each) => each.id === answers.template);
  const offered = recipesOffered(answers.category);
  const leaveOut = (id: string, out: boolean) =>
    onChange({
      leaveOut: out ? [...answers.leaveOut, id] : answers.leaveOut.filter((each) => each !== id),
    });
  // In the recipes' own order, whichever was ticked first.
  const tick = (id: string, ticked: boolean) =>
    onChange({
      recipes: offered
        .map((recipe) => recipe.id)
        .filter((each) => (each === id ? ticked : answers.recipes.includes(each))),
    });
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex max-w-2xl flex-col gap-5 p-px">
        <p className="m-0 text-sm text-muted-foreground">{t("quickStart.pagesText")}</p>
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-semibold">
            {t("quickStart.templatePages", {
              name: template === undefined ? t("newSite.blank") : templateName(template.id),
            })}
          </h3>
          {template === undefined ? (
            <p className="m-0 text-sm text-muted-foreground">{t("quickStart.blankPages")}</p>
          ) : (
            template.pageList.map((page) => (
              <Check
                key={page.id}
                label={page.home ? t("quickStart.homePage", { title: page.title }) : page.title}
                checked={page.home || !answers.leaveOut.includes(page.id)}
                disabled={page.home}
                onChange={(checked) => leaveOut(page.id, !checked)}
              />
            ))
          )}
        </section>
        <section className="flex flex-col gap-2">
          {answers.category === null ? (
            <p className="m-0 text-sm text-muted-foreground">{t("quickStart.noType")}</p>
          ) : (
            <>
              <h3 className="m-0 text-sm font-semibold">
                {t("quickStart.suggested", { type: t(`template.category.${answers.category}`) })}
              </h3>
              {offered.map((recipe) => (
                <Check
                  key={recipe.id}
                  label={recipeName(recipe.id, recipe.title)}
                  checked={answers.recipes.includes(recipe.id)}
                  onChange={(checked) => tick(recipe.id, checked)}
                />
              ))}
            </>
          )}
        </section>
      </div>
    </ScrollArea>
  );
}

/**
 * *Colours and details*: the brand colours (the theme's own, three other presets', the logo's or
 * one of the person's own), then the optional contact details (QS-6) and the web address, with a
 * line on what search engines get (SEO-9).
 */
function DetailsStep({
  answers,
  details,
  logo,
  hex,
  read,
  onColours,
  onLogo,
  onHex,
}: {
  readonly answers: QuickStartAnswers;
  readonly details: FormState<DetailsValues, BusinessDetails>;
  readonly logo: readonly ImageColour[] | null;
  readonly hex: string;
  readonly read: (url: string) => Promise<ArrayLike<number>>;
  readonly onColours: (colours: QuickStartColours) => void;
  readonly onLogo: (colours: readonly ImageColour[]) => void;
  readonly onHex: (hex: string) => void;
}) {
  const coloursId = useId();
  const choiceName = useId();
  const file = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string>();
  const options: readonly { readonly colours: QuickStartColours; readonly label: string }[] = [
    { colours: { kind: "theme" }, label: t("quickStart.colours.theme") },
    ...palettesFor(answers.theme).map((preset) => ({
      colours: { kind: "palette", preset } as const,
      label: presetLabel(preset),
    })),
    ...(logo === null
      ? []
      : [
          {
            colours: { kind: "logo", colours: logo } as const,
            label: t("quickStart.colours.logoChosen"),
          },
        ]),
  ];

  // Read here, from a copy the browser holds; nothing is sent anywhere or kept (PG-2).
  const readLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const picture = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (picture === undefined) return;
    const url = URL.createObjectURL(picture);
    const colours = await read(url).then(
      (pixels) => imageColours(pixels),
      () => null,
    );
    URL.revokeObjectURL(url);
    if (colours === null || colours.length === 0) {
      setProblem(
        t(colours === null ? "quickStart.colours.unreadable" : "quickStart.colours.noColours"),
      );
      return;
    }
    setProblem(undefined);
    onLogo(colours);
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <fieldset aria-labelledby={coloursId} className="m-0 flex w-60 shrink-0 flex-col gap-1 p-0">
        <span id={coloursId} className="text-xs text-muted-foreground">
          {t("quickStart.colours")}
        </span>
        {options.map((option) => (
          <ColoursOption
            key={option.label}
            name={choiceName}
            label={option.label}
            answers={answers}
            colours={option.colours}
            onChoose={() => onColours(option.colours)}
          />
        ))}
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <ColoursOption
              name={choiceName}
              label={t("quickStart.colours.colour")}
              answers={answers}
              colours={{ kind: "colour", hex }}
              onChoose={() => onHex(hex)}
            />
          </div>
          <input
            type="color"
            aria-label={t("quickStart.colours.colour")}
            value={hex}
            onChange={(event) => onHex(event.currentTarget.value)}
            className="h-7 w-9 shrink-0 cursor-pointer rounded-sm border border-border bg-transparent"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-1 justify-start"
          onClick={() => file.current?.click()}
        >
          <ImageIcon />
          {t("quickStart.colours.logo")}
        </Button>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          tabIndex={-1}
          onChange={(event) => void readLogo(event)}
        />
        <p className="m-0 text-xs text-muted-foreground">{t("quickStart.colours.logoHint")}</p>
        {problem === undefined ? null : (
          <p role="alert" className="m-0 text-xs text-destructive-text">
            {problem}
          </p>
        )}
      </fieldset>
      <ScrollArea className="min-h-0 flex-1 rounded-md border border-border bg-panel">
        <div className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-sm font-semibold">{t("quickStart.details")}</h3>
            <p className="m-0 text-xs text-muted-foreground">{t("quickStart.detailsText")}</p>
          </div>
          <Form form={details} />
          <p className="m-0 text-xs text-muted-foreground">{t("quickStart.searchNote")}</p>
        </div>
      </ScrollArea>
    </div>
  );
}

/** The brand colours to choose: a radio with the colours they give the theme, Brand first. */
function ColoursOption({
  name,
  label,
  answers,
  colours,
  onChoose,
}: {
  readonly name: string;
  readonly label: string;
  readonly answers: QuickStartAnswers;
  readonly colours: QuickStartColours;
  readonly onChoose: () => void;
}) {
  const { colors } = themeOf({ ...answers, colours });
  return (
    <label
      className={cn(
        "flex min-w-0 cursor-pointer items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 text-sm",
        "hover:bg-hover has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={answers.colours.kind === colours.kind && sameChoice(answers.colours, colours)}
        onChange={onChoose}
        className="sr-only"
      />
      <span className="flex shrink-0" aria-hidden>
        {(["primary", "secondary", "accent"] as const).map((role) => (
          <span
            key={role}
            className="-ml-1 size-4 rounded-full border border-border-strong first:ml-0"
            style={{ backgroundColor: oklchCss(colors[role]) }}
          />
        ))}
      </span>
      <span className="truncate">{label}</span>
    </label>
  );
}

/** Whether two choices of colours are the same choice: a palette's by its preset. */
const sameChoice = (one: QuickStartColours, other: QuickStartColours) =>
  one.kind !== "palette" || other.kind !== "palette" || one.preset === other.preset;
