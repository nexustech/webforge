/** An exported document's path from a page: `files/price-list.pdf`, `../files/price-list.pdf`. */
const DOCUMENT_PATH = /^(?:\.\.\/)*files\/[a-z0-9-]+\.[a-z0-9]+$/;

/**
 * Whether a link goes to an exported document (1.28), the only kind of link that may say
 * `download`: on a link to a page, or to `#` (a document deleted from Media), it would save the
 * page's own HTML instead.
 */
export const isDocumentPath = (href: string): boolean => DOCUMENT_PATH.test(href);
