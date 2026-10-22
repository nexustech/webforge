import { t } from "@webforge/i18n";
import type { FileMimeType } from "@webforge/model";
import { FileSpreadsheetIcon, FileTextIcon, type LucideIcon, PresentationIcon } from "lucide-react";

/**
 * How the Media panel shows a document (1.28, F-ED-24): an icon for its kind, the name of its type
 * and its size. Documents are never opened or previewed in the editor.
 */

/** Each document type's icon and its name ("Word document"). */
const DOCUMENT_TYPES: Readonly<
  Record<FileMimeType, { readonly icon: LucideIcon; readonly name: () => string }>
> = {
  "application/pdf": { icon: FileTextIcon, name: () => t("site.media.type.pdf") },
  "application/msword": { icon: FileTextIcon, name: () => t("site.media.type.word") },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    icon: FileTextIcon,
    name: () => t("site.media.type.word"),
  },
  "application/vnd.ms-excel": { icon: FileSpreadsheetIcon, name: () => t("site.media.type.excel") },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    icon: FileSpreadsheetIcon,
    name: () => t("site.media.type.excel"),
  },
  "application/vnd.ms-powerpoint": {
    icon: PresentationIcon,
    name: () => t("site.media.type.powerPoint"),
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    icon: PresentationIcon,
    name: () => t("site.media.type.powerPoint"),
  },
  "application/vnd.oasis.opendocument.text": {
    icon: FileTextIcon,
    name: () => t("site.media.type.odt"),
  },
  "application/vnd.oasis.opendocument.spreadsheet": {
    icon: FileSpreadsheetIcon,
    name: () => t("site.media.type.ods"),
  },
  "application/vnd.oasis.opendocument.presentation": {
    icon: PresentationIcon,
    name: () => t("site.media.type.odp"),
  },
  "text/plain": { icon: FileTextIcon, name: () => t("site.media.type.text") },
  "text/csv": { icon: FileSpreadsheetIcon, name: () => t("site.media.type.csv") },
};

/** The icon for a document of type `mimeType`. */
export const documentIcon = (mimeType: FileMimeType): LucideIcon => DOCUMENT_TYPES[mimeType].icon;

/** The name of a document's type, as the Media panel shows it ("Excel spreadsheet"). */
export const documentTypeName = (mimeType: FileMimeType): string => DOCUMENT_TYPES[mimeType].name();

/** A file size for people: "820 KB", "1.4 MB". */
export function fileSizeLabel(bytes: number): string {
  // In the editor's language, which is English for now, not the computer's: "1.4 MB" in an
  // English sentence, never "1,4 MB".
  const format = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  if (bytes < 1024 * 1024) {
    return t("site.media.size.kb", { size: format.format(Math.max(1, Math.round(bytes / 1024))) });
  }
  return t("site.media.size.mb", { size: format.format(bytes / (1024 * 1024)) });
}
