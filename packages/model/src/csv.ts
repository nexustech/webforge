/**
 * CSV as spreadsheets save it (RFC 4180, 6.10b's post import): fields separated by commas, or by
 * semicolons where a spreadsheet in a language with decimal commas saves them so, quoted with `"`
 * where they hold one, a separator or a line break, a quote doubled inside them. Rows end with
 * `\n` or `\r\n`; empty lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const separator = separatorOf(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let index = 0;
  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((each) => each.trim() !== "")) rows.push(row);
    row = [];
  };
  while (index < text.length) {
    const character = text[index] ?? "";
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
      } else {
        field += character;
      }
      index += 1;
      continue;
    }
    if (character === '"' && field === "") quoted = true;
    else if (character === separator) endField();
    else if (character === "\n") endRow();
    else if (character !== "\r") field += character;
    index += 1;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** The separator of `text`: a semicolon where its first line has more of them than commas. */
function separatorOf(text: string): "," | ";" {
  const first = text.split("\n", 1)[0] ?? "";
  const count = (character: string) => first.split(character).length - 1;
  return count(";") > count(",") ? ";" : ",";
}

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);

/**
 * The rows of a CSV with a header row as records by column name (in lower case, trimmed). A row
 * shorter than the header has its missing fields empty.
 */
export function csvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (header === undefined) return [];
  const names = header.map((name) => name.trim().toLowerCase());
  return rows.map((row) => {
    const record: Record<string, string> = {};
    names.forEach((name, column) => {
      // A column named after what every object has would change the record itself.
      if (name === "" || UNSAFE.has(name) || Object.hasOwn(record, name)) return;
      record[name] = row[column] ?? "";
    });
    return record;
  });
}
