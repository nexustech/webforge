import { z } from "zod";

/**
 * A string that the type checker tells apart from other strings, e.g. a page id from a slug. It is
 * zod's brand, so an id schema's `.brand()` parses to the id's type without a cast.
 */
export type Brand<T, B extends string> = T & z.$brand<B>;

/** Identifies a page for its whole life: links and menu items point at it, so a rename is safe. */
export type PageId = Brand<string, "PageId">;
/** Identifies an item in the site's Media. */
export type MediaId = Brand<string, "MediaId">;
/** Identifies an item of the navigation menu. */
export type MenuItemId = Brand<string, "MenuItemId">;
/** Identifies a shared section (F-ED-23): its linked copies point at it. */
export type SharedSectionId = Brand<string, "SharedSectionId">;
/** Identifies one of the person's own themes (2.23): in a site, and in My themes on a computer. */
export type ThemeId = Brand<string, "ThemeId">;

type IdTypes = {
  page: PageId;
  // A section's or element's id stays a plain string: Puck makes node ids too (`Heading-1b2c…`),
  // so a brand would need a cast wherever one comes back from the editor.
  node: string;
  media: MediaId;
  menuItem: MenuItemId;
  sharedSection: SharedSectionId;
  theme: ThemeId;
};

/** The kinds of id {@link newId} creates. */
export type IdKind = keyof IdTypes;

/**
 * What every id looks like: 1–64 letters, digits, `_` or `-`, starting with a letter or digit. The
 * first character rules out `__proto__`, so ids are safe as object keys. Puck's own node ids
 * (`Heading-1b2c…`) match too.
 */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Web Crypto, typed here because this package compiles without the DOM or Node type libraries. */
const webCrypto = (
  globalThis as unknown as { crypto: { getRandomValues(array: Uint8Array): Uint8Array } }
).crypto;

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ID_LENGTH = 16;

/**
 * A new random id: 16 characters from 62, about 95 bits, so collisions are not a practical concern.
 * Uses Web Crypto, which the renderer, the main process and Node tests all have.
 */
export function newId<K extends IdKind>(_kind: K): IdTypes[K] {
  // 62 × 4 = 248: values from 248 up are dropped so every character is equally likely.
  let id = "";
  while (id.length < ID_LENGTH) {
    for (const byte of webCrypto.getRandomValues(new Uint8Array(ID_LENGTH))) {
      if (byte < 248 && id.length < ID_LENGTH) {
        id += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return id as IdTypes[K];
}

/** Validates a string shaped like an id; `.brand()` gives it its kind's type. */
const idString = () => z.string().regex(ID_PATTERN);

/** Validates a {@link PageId}. */
export const pageIdSchema = idString().brand<"PageId">();
/** Validates the id of a section or element. */
export const nodeIdSchema = idString();
/** Validates a {@link MediaId}. */
export const mediaIdSchema = idString().brand<"MediaId">();
/** Validates a {@link MenuItemId}. */
export const menuItemIdSchema = idString().brand<"MenuItemId">();
/** Validates a {@link SharedSectionId}. */
export const sharedSectionIdSchema = idString().brand<"SharedSectionId">();
/** Validates a {@link ThemeId}. */
export const themeIdSchema = idString().brand<"ThemeId">();
