import { Button, type FieldRendererProps, Picker } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { ICON_NAMES, iconTags, isIconName, LucideIcon } from "@webforge/site-components";
import { useId, useState } from "react";

/** The picker's items: every Lucide icon by its name in words, found by its tags too. */
const ICON_ITEMS = ICON_NAMES.map((name) => ({
  id: name,
  label: name.replaceAll("-", " "),
  keywords: iconTags(name),
}));

/**
 * The Edit panel's icon field (F-ED-22): the icon chosen, a button that opens the icon picker
 * (UX-15's picker, searched by name and by what the icon shows), and one that takes it away. Each
 * choice is one change.
 */
export function IconField({
  id,
  labelId,
  disabled = false,
  value,
  onChange,
  onCommit,
}: FieldRendererProps<"icon">) {
  const [picking, setPicking] = useState(false);
  const actionId = useId();
  const current = isIconName(value) ? value : undefined;

  /** One choice: the new icon, or none, then the end of the run, so it is one undo step. */
  const choose = (next: string | undefined) => {
    onChange(next);
    onCommit();
    setPicking(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current === undefined ? null : <LucideIcon name={current} className="size-5 shrink-0" />}
      <Button
        id={id}
        type="button"
        size="sm"
        variant="outline"
        // "Icon, Choose an icon…": the field's label, then what the button does.
        aria-labelledby={`${labelId} ${actionId}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setPicking(true)}
      >
        <span id={actionId}>
          {current === undefined
            ? t("site.icon.choose")
            : t("site.icon.change", { name: current.replaceAll("-", " ") })}
        </span>
      </Button>
      {current === undefined ? null : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={() => choose(undefined)}
        >
          {t("site.icon.remove")}
        </Button>
      )}
      <Picker
        open={picking}
        onOpenChange={setPicking}
        title={t("site.icon.picker.title")}
        description={t("site.icon.picker.description")}
        items={ICON_ITEMS}
        value={current ?? null}
        columns={6}
        renderItem={(item) => <LucideIcon name={item.id} className="size-6" />}
        renderPreview={(item) => (
          <>
            <LucideIcon name={item.id} className="size-16" />
            <p className="m-0 text-xs">{item.label}</p>
          </>
        )}
        onChoose={(item) => choose(item.id)}
        emptyText={t("site.icon.picker.none")}
      />
    </div>
  );
}
