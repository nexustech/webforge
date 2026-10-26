import { Check, cn, fieldControlClass, ToggleGroup, ToggleGroupItem } from "@webforge/editor-ui";
import type { ThemeTokens } from "@webforge/model";
import { radiusCss, shadowCss } from "@webforge/themes";
import { type CSSProperties, type ReactNode, useId } from "react";
import { TOKEN_CONTROLS, type TokenControl, tokenKey, tokenValue } from "../theme-controls.js";
import { named } from "../theme-words.js";

/** Groups shown elsewhere in Theme Studio: links are with the text. */
const ELSEWHERE = new Set(["links"]);

/** A sample of a scale's step: a corner size or a shadow, drawn as the site draws it. */
function sampleStyle(control: TokenControl, value: string): CSSProperties | undefined {
  if (control.group === "radius") {
    return { borderRadius: radiusCss(value as ThemeTokens["radius"]["box"]) };
  }
  if (control.group === "shadow") return { boxShadow: shadowCss(value as ThemeTokens["shadow"]) };
  return undefined;
}

/** One token's row: its name and its control, a scale of samples where its values draw one. */
function TokenRow({
  control,
  theme,
  onChange,
}: {
  readonly control: TokenControl;
  readonly theme: ThemeTokens;
  readonly onChange: (control: TokenControl, value: unknown) => void;
}) {
  const labelId = useId();
  const key = tokenKey(control);
  const value = tokenValue(theme, control);
  const label = named(`theme.token.${key}`) ?? key;
  const valueLabel = (each: string) => named(`theme.token.${key}.${each}`) ?? each;
  let drawn: ReactNode;
  if (control.values === "toggle") {
    drawn = (
      <Check
        label={label}
        checked={value === true}
        onChange={(checked) => onChange(control, checked)}
      />
    );
  } else if (control.group === "radius" || control.group === "shadow") {
    drawn = (
      <ToggleGroup
        type="single"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-1"
        value={String(value)}
        onValueChange={(next) => {
          if (next !== "") onChange(control, next);
        }}
      >
        {control.values.map((each) => (
          <ToggleGroupItem
            key={each}
            value={each}
            title={valueLabel(each)}
            className="flex h-auto flex-col items-center gap-1 px-1.5 py-1 text-2xs"
          >
            <span
              aria-hidden
              className="block h-7 w-11 border border-border-strong bg-panel"
              style={sampleStyle(control, each)}
            />
            {valueLabel(each)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    );
  } else {
    drawn = (
      <select
        aria-labelledby={labelId}
        className={cn(fieldControlClass, "h-7 w-44 text-xs")}
        value={String(value)}
        onChange={(event) => onChange(control, event.currentTarget.value)}
      >
        {control.values.map((each) => (
          <option key={each} value={each}>
            {valueLabel(each)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] items-center gap-3 py-1">
      {/* A checkbox names itself, beside it. */}
      <span id={labelId} className="text-xs text-muted-foreground">
        {control.values === "toggle" ? null : label}
      </span>
      <div className="min-w-0">{drawn}</div>
    </div>
  );
}

/**
 * Theme Studio's styles (F-DS-7): the theme's other tokens by group, from the model's schema as
 * the Theme tab has them, the corner and shadow scales drawn as samples. Each change is one step.
 */
export function StudioStyles({
  theme,
  onChange,
}: {
  readonly theme: ThemeTokens;
  readonly onChange: (control: TokenControl, value: unknown) => void;
}) {
  const groups = [
    ...new Set(
      TOKEN_CONTROLS.map((control) => control.group).filter((group) => !ELSEWHERE.has(group)),
    ),
  ];
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <section key={group} aria-label={named(`theme.group.${group}`) ?? group}>
          <h3 className="m-0 mb-1 text-xs font-semibold">
            {named(`theme.group.${group}`) ?? group}
          </h3>
          {TOKEN_CONTROLS.filter((control) => control.group === group).map((control) => (
            <TokenRow key={tokenKey(control)} control={control} theme={theme} onChange={onChange} />
          ))}
        </section>
      ))}
    </div>
  );
}
