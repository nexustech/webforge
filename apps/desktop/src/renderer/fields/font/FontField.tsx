import {
  Button,
  type FieldRendererProps,
  fieldControlClass,
  Picker,
  type PickerItem,
} from "@webforge/editor-ui";
import { type MessageKey, t } from "@webforge/i18n";
import { fontRefSchema } from "@webforge/model";
import { type CatalogueFont, catalogueFamily, FONT_CATALOGUE, fontRefOf } from "@webforge/themes";
import { useEffect, useId, useState } from "react";
import { addFontPreviews, previewFamily } from "./font-previews.js";

/** A category's name in the picker: `fonts.category.<category>`, for each the catalogue has. */
const categoryName = (font: CatalogueFont) => t(`fonts.category.${font.category}` as MessageKey);

/** A font as the picker lists it: by its name, under its category. */
type FontItem = PickerItem & { readonly font: CatalogueFont };

const FONT_ITEMS: readonly FontItem[] = FONT_CATALOGUE.map((font) => ({
  id: font.id,
  label: font.family,
  category: categoryName(font),
  keywords: [font.category],
  font,
}));

/** The categories the catalogue has, in its order. */
const CATEGORIES = [...new Set(FONT_ITEMS.flatMap((item) => item.category ?? []))];

/**
 * A theme font in the Theme tab (2.3a, F-DS-2): the font, shown in itself, and a button that opens
 * the font picker (UX-15's shared picker): the app's fonts by category, each shown in itself, and a
 * larger preview of the one the person is on in sample text they can change. A choice is one change.
 */
export function FontField({
  id,
  labelId,
  disabled = false,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"font">) {
  const [picking, setPicking] = useState(false);
  const [sample, setSample] = useState(() => t("fonts.picker.sample"));
  const actionId = useId();
  const sampleId = useId();
  const parsed = fontRefSchema.safeParse(value);
  const current = parsed.success ? parsed.data : undefined;
  const font = current === undefined ? undefined : catalogueFamily(current.family);

  // The fonts' previews: on the editor's page, once, as soon as a font field shows.
  useEffect(() => addFontPreviews(document), []);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Button
        id={id}
        type="button"
        size="sm"
        variant="outline"
        className="min-w-0 justify-start"
        // "Headings, Change font (Inter)…": the field's label, then what the button does.
        aria-labelledby={`${labelId} ${actionId}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setPicking(true)}
      >
        <span
          id={actionId}
          className="truncate"
          style={font === undefined ? undefined : { fontFamily: previewFamily(font) }}
        >
          {current === undefined ? t("fonts.choose") : t("fonts.change", { name: current.family })}
        </span>
      </Button>
      <Picker
        open={picking}
        onOpenChange={setPicking}
        title={t("fonts.picker.title")}
        description={t("fonts.picker.description")}
        items={FONT_ITEMS}
        categories={CATEGORIES}
        layout="list"
        value={font?.id ?? null}
        renderItem={(item) => (
          <span aria-hidden className="text-lg" style={{ fontFamily: previewFamily(item.font) }}>
            {t("fonts.picker.tile")}
          </span>
        )}
        renderPreview={(item) => (
          <p className="m-0 text-2xl break-words" style={{ fontFamily: previewFamily(item.font) }}>
            {sample.trim() === "" ? item.label : sample}
          </p>
        )}
        actions={
          <div className="flex min-w-0 items-center gap-1.5">
            <label htmlFor={sampleId} className="shrink-0 text-xs text-muted-foreground">
              {t("fonts.picker.sampleLabel")}
            </label>
            <input
              id={sampleId}
              className={`${fieldControlClass} h-7 w-48 text-xs`}
              value={sample}
              maxLength={80}
              onChange={(event) => setSample(event.currentTarget.value)}
            />
          </div>
        }
        onChoose={(item) => {
          setPicking(false);
          if (item.font.family === current?.family) return;
          onChange(fontRefOf(item.font));
          onCommit();
        }}
        emptyText={t("fonts.picker.none")}
      />
    </div>
  );
}
