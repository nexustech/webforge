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
 * A binding to a field of the item the element is drawn for (6.10a, ADR 0025): `item.title`, or
 * one of its collection's fields, `item.date`. Elements of a collection's design have them.
 */
export type ItemBinding = `item.${string}`;

const ITEM_BINDING = /^item\.[a-z][a-zA-Z0-9]{0,39}$/;

/** Whether `value` is an {@link ItemBinding}. */
export const isItemBinding = (value: unknown): value is ItemBinding =>
  typeof value === "string" && ITEM_BINDING.test(value);

/** What a field can be bound to: a Site Settings value, or a field of the item it is drawn for. */
export type Binding = BindableSetting | ItemBinding;

const isBinding = (value: unknown): value is Binding =>
  bindableSettingSchema.safeParse(value).success || isItemBinding(value);

/**
 * An element's bindings: which of its fields show a Site Settings value or an item's field instead
 * of their own, e.g. `{ siteName: "general.name" }` or `{ text: "item.title" }`. Stored beside the
 * fields (in `props.bindings`), so a field keeps its own value for when the binding is removed, and
 * the canvas's inline text editing only ever sees strings.
 */
export type Bindings = Record<string, Binding>;

/**
 * The valid entries of an element's `props.bindings`. An entry this version doesn't know (a
 * setting added later) is left out on its own, so it doesn't unbind the element's other fields.
 */
export function validBindings(bindings: unknown): Bindings {
  if (typeof bindings !== "object" || bindings === null || Array.isArray(bindings)) {
    return {};
  }
  // fromEntries defines own properties, so even a "__proto__" entry stays a plain key.
  return Object.fromEntries(
    Object.entries(bindings).filter((entry): entry is [string, Binding] => isBinding(entry[1])),
  );
}

/** The Site Settings value field `name` is bound to in an element's `props.bindings`, if any. */
export function bindingOf(bindings: unknown, name: string): BindableSetting | undefined {
  const valid = validBindings(bindings);
  const binding = Object.hasOwn(valid, name) ? valid[name] : undefined;
  return binding === undefined || isItemBinding(binding) ? undefined : binding;
}

/**
 * The item field (`title`, `date`) field `name` is bound to in an element's `props.bindings`, if
 * any (ADR 0025, decision 3).
 */
export function itemBindingOf(bindings: unknown, name: string): string | undefined {
  const valid = validBindings(bindings);
  const binding = Object.hasOwn(valid, name) ? valid[name] : undefined;
  return binding !== undefined && isItemBinding(binding)
    ? binding.slice("item.".length)
    : undefined;
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
