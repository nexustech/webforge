import type { ThemeTokens } from "@webforge/model";
import { TOKEN_CONTROLS, type TokenControl, tokenKey } from "../theme-controls.js";
import { named } from "../theme-words.js";
import { TokenRow } from "./TokenRow.js";

/**
 * Groups shown elsewhere in Theme Studio: links are with the text; the buttons' tokens and the card
 * style with the Button and Card looks in Components (3.12).
 */
const ELSEWHERE = new Set(["links", "buttons", "cards"]);

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
