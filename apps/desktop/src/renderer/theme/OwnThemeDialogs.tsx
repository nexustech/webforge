import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  FormDialog,
  type FormSpec,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { THEME_NAME_MAX, type ThemeTokens } from "@webforge/model";
import { THEME_PRESETS } from "@webforge/themes";
import { z } from "zod";
import { useStore } from "zustand";
import type { OwnTheme } from "../../shared/ipc/themes.js";
import { NameDialog } from "../shell/NameDialog.js";
import type { NewTheme, OwnThemes } from "./own-themes.js";
import { presetName, themeName } from "./theme-edits.js";

/** The New theme form's values: what it starts from (`site`, a preset, `own:<id>`) and its name. */
type NewThemeValues = { readonly base: string; readonly name: string };

/** The site's theme, as the New theme form's first choice. */
const SITE = "site";

/** The value of one of the person's own themes in the New theme form. */
const ownValue = (theme: OwnTheme) => `own:${theme.own.id}`;

/** The theme `value` names: the site's, one of the person's own, or a preset. */
function baseOf(value: string, site: ThemeTokens, own: readonly OwnTheme[]): ThemeTokens {
  if (value === SITE) return site;
  return (
    own.find((theme) => ownValue(theme) === value) ??
    THEME_PRESETS.find((preset) => preset.preset === value) ??
    site
  );
}

/**
 * Theme Studio's *New theme* (2.23, PH2-17): what it starts from (the site's theme, one of the
 * person's own, or a built-in one) and its name, checked as it's typed.
 */
function NewThemeDialog({
  site,
  own,
  onCreate,
  onCancel,
}: {
  readonly site: ThemeTokens;
  readonly own: readonly OwnTheme[];
  readonly onCreate: (theme: NewTheme) => void;
  readonly onCancel: () => void;
}) {
  const schema = z.strictObject({
    base: z.string(),
    name: z.string().trim().min(1).max(THEME_NAME_MAX),
  });
  const spec: FormSpec<NewThemeValues, z.infer<typeof schema>> = {
    fields: [
      {
        kind: "select",
        name: "base",
        label: t("theme.own.startFrom"),
        options: [
          { label: t("theme.own.siteTheme", { name: themeName(site) }), value: SITE },
          ...own.map((theme) => ({ label: theme.own.name, value: ownValue(theme) })),
          ...THEME_PRESETS.map((preset) => ({
            label: presetName(preset.preset),
            value: preset.preset,
          })),
        ],
      },
      { kind: "text", name: "name", label: t("theme.own.name"), maxLength: THEME_NAME_MAX },
    ],
    schema,
    toModel: (values) => values,
    validateOn: "change",
  };
  return (
    <FormDialog
      open
      title={t("theme.own.newTitle")}
      description={t("theme.own.newDescription")}
      confirm={t("theme.own.create")}
      spec={spec}
      initial={{ base: SITE, name: t("theme.own.newName", { name: themeName(site) }) }}
      onSave={({ base, name }) => onCreate({ base: baseOf(base, site, own), name })}
      onCancel={onCancel}
    />
  );
}

/**
 * The questions My themes asks (2.23), drawn once for the window: a name for the person's own
 * version of a built-in theme or for a rename, whether to delete one of their themes, and New
 * theme. `site` is the site's theme now, for New theme's first choice.
 */
export function OwnThemeDialogs({
  ownThemes,
  site,
}: {
  readonly ownThemes: OwnThemes;
  readonly site: ThemeTokens;
}) {
  const { question, themes } = useStore(ownThemes.store);
  return (
    <>
      <NameDialog
        open={question?.kind === "name"}
        title={question?.kind === "name" ? question.title : ""}
        {...(question?.kind === "name" && question.description !== undefined
          ? { description: question.description }
          : {})}
        label={t("theme.own.name")}
        initialValue={question?.kind === "name" ? question.initial : ""}
        confirm={question?.kind === "name" ? question.confirm : ""}
        maxLength={THEME_NAME_MAX}
        onSubmit={(name) => ownThemes.answer(name)}
        onCancel={() => ownThemes.answer(undefined)}
      />
      <AlertDialog
        open={question?.kind === "delete"}
        onOpenChange={(open) => {
          if (!open) ownThemes.answer(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {question?.kind === "delete"
                ? t("theme.own.deleteTitle", { name: question.name })
                : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {question?.kind === "delete" && question.inUse
                ? t("theme.own.deleteInUse")
                : t("theme.own.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirm.siteWide.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => ownThemes.answer(true)}>
              {t("theme.own.deleteButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {question?.kind === "new" ? (
        <NewThemeDialog
          site={site}
          own={themes}
          onCreate={(theme) => ownThemes.answer(theme)}
          onCancel={() => ownThemes.answer(undefined)}
        />
      ) : null}
    </>
  );
}
