import { DOCUMENT_EXTENSIONS, FILE_MIME_TYPES, type FileMimeType } from "@webforge/model";

/**
 * Recognising the documents Media takes (1.28, F-ED-24): a file is one only when its extension
 * names a listed type and its bytes are that type's format. A renamed program, a macro-enabled
 * Office file or an installer is not one. Nothing here opens or runs a file: only its first bytes
 * and, for ZIP-based formats, the names of the files inside are read.
 */

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
/** Microsoft's Compound File (OLE): .doc, .xls and .ppt, but also installers (.msi). */
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04];
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END_OF_DIRECTORY = 0x06054b50;

/** The class id of a Windows Installer package (.msi, .msp), as the OLE root entry stores it. */
const INSTALLER_CLASS_IDS = [
  // {000C1084-0000-0000-C000-000000000046} (.msi) and {000C1086-…} (.msp), little-endian.
  [0x84, 0x10, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
  [0x86, 0x10, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46],
];

/** The folder each Office Open XML type keeps its parts in. */
const OOXML_PARTS: Partial<Record<FileMimeType, string>> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word/",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xl/",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt/",
};

const OLE_TYPES: ReadonlySet<FileMimeType> = new Set([
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
]);

const ODF_TYPES: ReadonlySet<FileMimeType> = new Set([
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
]);

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  signature.every((byte, index) => bytes[at + index] === byte);

const u16le = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const u32le = (bytes: Uint8Array, at: number) => u16le(bytes, at) + u16le(bytes, at + 2) * 0x10000;

const latin1 = (bytes: Uint8Array) => String.fromCharCode(...bytes);

/** The document type the file name's extension names, if it is one Media takes. */
function typeForName(fileName: string): FileMimeType | undefined {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase();
  return FILE_MIME_TYPES.find((type) => DOCUMENT_EXTENSIONS[type] === extension);
}

/**
 * Whether an OLE file is an installer rather than an Office document: its root directory entry
 * carries Windows Installer's class id. A file too short to say is not an installer.
 */
function isInstaller(bytes: Uint8Array): boolean {
  // The header gives the sector size (as a power of two) and the first directory sector; the root
  // entry is the directory's first, with its class id 80 bytes in.
  const sectorSize = 2 ** u16le(bytes, 0x1e);
  if (sectorSize < 128 || sectorSize > 65536) return false;
  const directory = (u32le(bytes, 0x30) + 1) * sectorSize;
  const classId = directory + 0x50;
  return INSTALLER_CLASS_IDS.some((id) => startsWith(bytes, id, classId));
}

/**
 * The names of the files in a ZIP archive, from its central directory, or `undefined` if it isn't
 * a well-formed one. The end-of-directory record is in the last 64 KB plus its own 22 bytes.
 */
export function zipEntryNames(bytes: Uint8Array): string[] | undefined {
  if (!startsWith(bytes, ZIP_LOCAL_HEADER)) return undefined;
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (u32le(bytes, at) === ZIP_END_OF_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end === -1) return undefined;
  const count = u16le(bytes, end + 10);
  let at = u32le(bytes, end + 16);
  const names: string[] = [];
  for (let index = 0; index < count; index++) {
    if (at + 46 > bytes.length || u32le(bytes, at) !== ZIP_CENTRAL_HEADER) return undefined;
    const nameLength = u16le(bytes, at + 28);
    const extraLength = u16le(bytes, at + 30);
    const commentLength = u16le(bytes, at + 32);
    if (at + 46 + nameLength > bytes.length) return undefined;
    names.push(latin1(bytes.subarray(at + 46, at + 46 + nameLength)));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

/**
 * The type an OpenDocument file says it is: its first entry must be `mimetype`, stored
 * uncompressed, holding the type (as the OpenDocument standard requires).
 */
function odfType(bytes: Uint8Array): string | undefined {
  if (!startsWith(bytes, ZIP_LOCAL_HEADER) || u16le(bytes, 8) !== 0) return undefined;
  const size = u32le(bytes, 18);
  const nameLength = u16le(bytes, 26);
  const start = 30 + nameLength + u16le(bytes, 28);
  if (latin1(bytes.subarray(30, 30 + nameLength)) !== "mimetype" || size > 100) return undefined;
  return latin1(bytes.subarray(start, start + size));
}

/** Whether `bytes` are text: no NUL and no control characters but tab, line and page breaks. */
function isText(bytes: Uint8Array): boolean {
  for (const byte of bytes) {
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d) {
      return false;
    }
    if (byte === 0x7f) return false;
  }
  return true;
}

/** Whether `bytes` are in the format of document type `type`. */
function hasFormat(bytes: Uint8Array, type: FileMimeType): boolean {
  if (type === "application/pdf") return startsWith(bytes, PDF_SIGNATURE);
  if (OLE_TYPES.has(type)) return startsWith(bytes, OLE_SIGNATURE) && !isInstaller(bytes);
  if (ODF_TYPES.has(type)) return odfType(bytes) === type;
  const part = OOXML_PARTS[type];
  if (part !== undefined) {
    const names = zipEntryNames(bytes) ?? [];
    return (
      names.includes("[Content_Types].xml") &&
      names.some((name) => name.startsWith(part)) &&
      // Macros make it a .docm, .xlsm or .pptm, whatever its name says.
      !names.some((name) => name.toLowerCase().endsWith("vbaproject.bin"))
    );
  }
  // Plain text and CSV: nothing else falls through to the text check.
  return (type === "text/plain" || type === "text/csv") && isText(bytes);
}

/**
 * The document type of a file, by its name's extension and its bytes, or `undefined` if it isn't
 * a document Media takes.
 */
export function sniffDocument(bytes: Uint8Array, fileName: string): FileMimeType | undefined {
  const type = typeForName(fileName);
  return type !== undefined && hasFormat(bytes, type) ? type : undefined;
}
