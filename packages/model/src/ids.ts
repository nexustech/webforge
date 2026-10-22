import { z } from "zod";

/** A string that the type checker tells apart from other strings, e.g. a page id from a slug. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** Identifies a page for its whole life: links and menu items point at it, so a rename is safe. */
export type PageId = Brand<string, "PageId">;
/** Identifies a section or element (a node of a page or of the shared layout). */
export type NodeId = Brand<string, "NodeId">;
/** Identifies an item in the site's Media. */
export type MediaId = Brand<string, "MediaId">;
/** Identifies an item of the navigation menu. */
export type MenuItemId = Brand<string, "MenuItemId">;
/** Identifies a shared section (F-ED-23): its linked copies point at it. */
export type SharedSectionId = Brand<string, "SharedSectionId">;

type IdTypes = {
  page: PageId;
  node: NodeId;
  media: MediaId;
  menuItem: MenuItemId;
  sharedSection: SharedSectionId;
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

function idSchema<K extends IdKind>(): z.ZodType<IdTypes[K], string> {
  // A plain string check; the cast only adds the brand to the parsed type.
  return z.string().regex(ID_PATTERN) as unknown as z.ZodType<IdTypes[K], string>;
}

/** Validates a {@link PageId}. */
export const pageIdSchema = idSchema<"page">();
/** Validates a {@link NodeId}. */
export const nodeIdSchema = idSchema<"node">();
/** Validates a {@link MediaId}. */
export const mediaIdSchema = idSchema<"media">();
/** Validates a {@link MenuItemId}. */
export const menuItemIdSchema = idSchema<"menuItem">();
/** Validates a {@link SharedSectionId}. */
export const sharedSectionIdSchema = idSchema<"sharedSection">();
