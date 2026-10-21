import { z } from "zod";
import type { SiteSettings } from "./settings.js";

/**
 * The Site Settings values an element's text can show instead of its own (1.17, F-SET-1): typed
 * once in Site Settings, they update every page that shows them.
 */
export const BINDABLE_SETTINGS = [
  "general.name",
  "contact.businessName",
  "contact.email",
  "contact.phone",
  "contact.address",
  "contact.openingHoursNote",
  "address.url",
] as const;

/** A Site Settings value an element can show. */
export type BindableSetting = (typeof BINDABLE_SETTINGS)[number];

/** Validates a {@link BindableSetting}. */
export const bindableSettingSchema = z.enum(BINDABLE_SETTINGS);

/**
 * An element's bindings: which of its text fields show a Site Settings value instead of their own
 * text, e.g. `{ siteName: "general.name" }`. Stored beside the fields (in `props.bindings`), so a
 * field keeps its own text for when the binding is removed, and the canvas's inline text editing
 * only ever sees strings.
 */
export const bindingsSchema = z.record(z.string(), bindableSettingSchema);

/** See {@link bindingsSchema}. */
export type Bindings = z.infer<typeof bindingsSchema>;

/** The binding of field `name` in an element's `props.bindings`, if it has a valid one. */
export function bindingOf(bindings: unknown, name: string): BindableSetting | undefined {
  const parsed = bindingsSchema.safeParse(bindings);
  return parsed.success ? parsed.data[name] : undefined;
}

/** The value of a bindable setting, or `undefined` while it is empty. */
export function settingValue(settings: SiteSettings, key: BindableSetting): string | undefined {
  const value = (() => {
    switch (key) {
      case "general.name":
        return settings.general.name;
      case "contact.businessName":
        return settings.contact.businessName;
      case "contact.email":
        return settings.contact.email;
      case "contact.phone":
        return settings.contact.phone;
      case "contact.address":
        return settings.contact.address;
      case "contact.openingHoursNote":
        return settings.contact.openingHoursNote;
      case "address.url":
        return settings.address.url;
    }
  })();
  return value === undefined || value.trim() === "" ? undefined : value;
}

/** Every bindable setting that has a value, for a site snapshot or the canvas. */
export function settingValues(settings: SiteSettings): Partial<Record<BindableSetting, string>> {
  const values: Partial<Record<BindableSetting, string>> = {};
  for (const key of BINDABLE_SETTINGS) {
    const value = settingValue(settings, key);
    if (value !== undefined) values[key] = value;
  }
  return values;
}
