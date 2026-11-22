import { Button } from "@webforge/editor-ui";
import { plural, t } from "@webforge/i18n/components";
import type { OwnColor } from "@webforge/model";
import { oklchCss } from "@webforge/themes";
import { useId, useState } from "react";
import { AddToColours, newColourName } from "../../fields/index.js";

/** A use of a one-off, as the list shows it: where it is, in words, and how to go to it. */
type ShownUse = { readonly key: string; readonly where: string };

/** A one-off colour on the site (`#rrggbb`) and its uses. */
type ShownOneOff = { readonly hex: string; readonly uses: readonly ShownUse[] };

/** Props of {@link StudioOneOffColours}. */
export type StudioOneOffColoursProps = {
  /** Every one-off on the site, the most used first. */
  readonly colours: readonly ShownOneOff[];
  /** The person's colours: a new one's name can't repeat one, and the nearest is offered. */
  readonly own: readonly OwnColor[];
  /** The one of the person's colours nearest `hex`; none while they have none. */
  readonly nearest: (hex: string) => OwnColor | undefined;
  /** Makes `hex` the person's colour `name`, every use with it; false if the list is full. */
  readonly onAdd: (hex: string, name: string) => Promise<boolean>;
  /** Gives every use of `hex` the nearest of the person's colours. */
  readonly onUseNearest: (hex: string) => void;
  /** Goes to a use on the canvas, selected: Theme Studio closes first. */
  readonly onShow: (hex: string, key: string) => void;
};

/**
 * Theme Studio's *Colours outside your theme* (5.32, TC-4): every one-off colour the site uses,
 * each with where (a use goes to its element on the canvas), *Add to Your Colours…* (as the Edit
 * panel's, TC-3) and *Use ‹name› Instead*, the nearest of the person's colours. Each is one undo
 * step across all its uses. What a one-off costs is said, not enforced: it stays the same when the
 * theme changes. Empty, it says the site uses its theme's colours only.
 */
export function StudioOneOffColours(props: StudioOneOffColoursProps) {
  const { colours } = props;
  const id = useId();
  const [adding, setAdding] = useState<string | undefined>(undefined);
  return (
    <section aria-labelledby={`${id}-title`} className="mb-4 flex flex-col gap-2">
      <h3 id={`${id}-title`} className="m-0 text-xs font-semibold">
        {t("theme.studio.oneOff.title")}
      </h3>
      <p className="m-0 text-xs text-muted-foreground">
        {colours.length === 0 ? t("theme.studio.oneOff.none") : t("theme.studio.oneOff.about")}
      </p>
      {colours.length === 0 ? null : (
        <ul
          aria-label={t("theme.studio.oneOff.title")}
          className="m-0 flex max-h-96 list-none flex-col gap-1.5 overflow-y-auto p-0"
        >
          {colours.map(({ hex, uses }) => {
            const nearest = props.nearest(hex);
            return (
              <li
                key={hex}
                aria-label={hex}
                className="flex flex-col gap-1.5 rounded-sm border border-border p-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className="size-5 shrink-0 rounded-sm border border-border-strong"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="font-mono">{hex}</span>
                  <span className="text-muted-foreground">
                    {plural("theme.studio.oneOff.uses", uses.length)}
                  </span>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {nearest === undefined ? null : (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={t("theme.studio.oneOff.nearestLabel", {
                          hex,
                          name: nearest.name,
                        })}
                        onClick={() => props.onUseNearest(hex)}
                      >
                        <span
                          aria-hidden
                          className="size-3.5 shrink-0 rounded-sm border border-border-strong"
                          style={{ backgroundColor: oklchCss(nearest.color) }}
                        />
                        {t("theme.studio.oneOff.nearest", { name: nearest.name })}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setAdding(hex)}>
                      {t("theme.studio.oneOff.add")}
                    </Button>
                  </div>
                </div>
                {adding === hex ? (
                  <AddToColours
                    uses={uses.length}
                    initialName={newColourName(props.own)}
                    taken={props.own.map((each) => each.name)}
                    onAdd={async (name) => {
                      const added = await props.onAdd(hex, name);
                      if (added) setAdding(undefined);
                      return added;
                    }}
                    onLater={() => setAdding(undefined)}
                  />
                ) : null}
                <ul
                  aria-label={t("theme.studio.oneOff.where", { hex })}
                  className="m-0 flex list-none flex-col gap-0.5 p-0"
                >
                  {uses.map((use) => (
                    <li key={use.key}>
                      <button
                        type="button"
                        className="min-h-6 text-left [overflow-wrap:anywhere] hover:underline focus-visible:underline"
                        aria-label={t("theme.studio.oneOff.show", { where: use.where })}
                        onClick={() => props.onShow(hex, use.key)}
                      >
                        {use.where}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
