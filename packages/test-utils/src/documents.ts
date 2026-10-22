/**
 * Small Office-style files for tests of the document checks (1.28): a ZIP archive, as .docx and
 * .odt files are, and a Compound File (OLE) header, as .doc files have.
 */

const ascii = (text: string) => new TextEncoder().encode(text);

const u16 = (value: number) => [value & 0xff, (value >> 8) & 0xff];
const u32 = (value: number) => [...u16(value & 0xffff), ...u16(value >>> 16)];

/** A ZIP archive of `entries`, stored without compression, as Office and OpenDocument write. */
export function zipArchive(entries: readonly { name: string; data: string }[]): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  for (const entry of entries) {
    const name = [...ascii(entry.name)];
    const data = [...ascii(entry.data)];
    const offset = local.length;
    const sizes = [...u32(0), ...u32(data.length), ...u32(data.length)]; // CRC (unchecked), sizes
    local.push(0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u32(0), ...sizes);
    local.push(...u16(name.length), ...u16(0), ...name, ...data);
    central.push(0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0));
    central.push(...u32(0), ...sizes, ...u16(name.length), ...u16(0), ...u16(0));
    central.push(...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
  }
  const end = [0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(entries.length)];
  end.push(...u16(entries.length), ...u32(central.length), ...u32(local.length), ...u16(0));
  return new Uint8Array([...local, ...central, ...end]);
}

/** A Compound File (OLE) with 512-byte sectors whose root entry has class id `classId`. */
export function oleFile(classId: readonly number[] = new Array(16).fill(0)): Uint8Array {
  const bytes = new Uint8Array(1024);
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  bytes.set(u16(9), 0x1e); // 2^9 = 512-byte sectors
  bytes.set(u32(0), 0x30); // the directory starts in sector 0, after the header
  bytes.set(classId, 512 + 0x50);
  return bytes;
}

/** A minimal .docx: a ZIP with `[Content_Types].xml` and a `word/` part. */
export const minimalDocx = () =>
  zipArchive([
    { name: "[Content_Types].xml", data: "<Types/>" },
    { name: "word/document.xml", data: "<w:document/>" },
  ]);
