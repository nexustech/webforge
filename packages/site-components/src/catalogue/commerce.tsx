import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { httpsAddress } from "../form.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";
import {
  ENTRANCE_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
  HOVER_FIELD,
  hoverClasses,
} from "../motion.js";
import { Picture } from "../picture.js";
import { BUTTON_CLASSES } from "../typography.js";
import { ALIGNMENT_FIELD, BUTTON_ALIGN_CLASS } from "./elements.js";

/** Its items across its section, as its button sits: the Button's alignment, in a column. */
const ITEMS_ALIGN_CLASS = { left: "items-start", centre: "items-center", right: "items-end" };

/**
 * A Buy button (F-CM-2, M1): what's for sale, its price, an image of it if there is one, and a
 * button to the payment page Stripe, PayPal or a shop gives: a plain link in a new tab, no script.
 * Only an `https://` link is used. Without one it still draws, so it can be set up, but its button
 * goes nowhere and the canvas says what to add.
 */
const buyButton = defineComponent({
  label: t("element.buyButton"),
  category: t("category.shop"),
  fields: {
    label: { kind: "text", label: t("field.buyLabel") },
    price: { kind: "text", label: t("field.price"), help: t("field.price.help") },
    image: { kind: "media", label: t("field.image") },
    link: { kind: "text", label: t("field.paymentLink"), help: t("field.paymentLink.help") },
    alignment: ALIGNMENT_FIELD,
    hover: HOVER_FIELD,
    margin: MARGIN_FIELD,
    ...ENTRANCE_FIELDS,
  },
  defaults: {
    label: t("starter.buyLabel"),
    price: t("starter.price"),
    link: "",
    alignment: "left",
  },
  behaviours: entranceBehaviours,
  render: ({ values, context }) => {
    const label = values.label.trim();
    const price = values.price.trim();
    const link = httpsAddress(values.link);
    const placed = values.image;
    const image = placed === undefined ? null : context.image(placed.mediaId);
    const hint = link === undefined ? context.elementHint?.("paymentLink") : undefined;
    const button = `${BUTTON_CLASSES.primary}${hoverClasses(values.hover)}`;
    return (
      <div
        className={`site-buy-button flex flex-col gap-3 ${ITEMS_ALIGN_CLASS[values.alignment]}${marginClasses(values.margin)}${entranceClasses(values)}`}
        {...entranceAttributes(values)}
      >
        {image === null ? null : (
          <Picture
            image={image}
            alt={placed?.alt ?? image.alt}
            sizes="(min-width: 768px) 20rem, 100vw"
            className="h-auto w-full max-w-xs rounded-box"
          />
        )}
        {price === "" ? null : <p className="text-lg font-semibold">{price}</p>}
        {label === "" ? null : (
          <div className={`flex w-full ${BUTTON_ALIGN_CLASS[values.alignment]}`}>
            {link === undefined ? (
              // Nowhere to pay yet: no link, only its text, drawn as a disabled button.
              <span className={`${button} btn-disabled`}>{label}</span>
            ) : (
              <a className={button} href={link} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            )}
          </div>
        )}
        {hint === undefined || hint === null ? null : <p>{hint}</p>}
      </div>
    );
  },
});

/** The commerce family (2.11): selling from the site with a payment link, no shop of its own. */
export const commerceComponents: Readonly<Record<string, ComponentDef>> = {
  BuyButton: buyButton,
};
