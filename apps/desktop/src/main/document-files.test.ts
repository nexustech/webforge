import { minimalDocx, oleFile, zipArchive as zip } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { sniffDocument, zipEntryNames } from "./document-files.js";

const ascii = (text: string) => new TextEncoder().encode(text);

const docx = minimalDocx();
const odt = zip([
  { name: "mimetype", data: "application/vnd.oasis.opendocument.text" },
  { name: "content.xml", data: "<office:document-content/>" },
]);

describe("sniffDocument (1.28)", () => {
  it("recognises each type by its extension and its bytes", () => {
    expect(sniffDocument(ascii("%PDF-1.7"), "menu.pdf")).toBe("application/pdf");
    expect(sniffDocument(docx, "Price list.DOCX")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(sniffDocument(odt, "notes.odt")).toBe("application/vnd.oasis.opendocument.text");
    expect(sniffDocument(oleFile(), "old.doc")).toBe("application/msword");
    expect(sniffDocument(oleFile(), "old.xls")).toBe("application/vnd.ms-excel");
    expect(sniffDocument(ascii("name,price\r\nBread,2.50\r\n"), "prices.csv")).toBe("text/csv");
    // Windows-1252 text from Excel is text too.
    expect(sniffDocument(new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x0a]), "menu.txt")).toBe(
      "text/plain",
    );
  });

  it("rejects a renamed program, and a file whose bytes aren't its name's type", () => {
    const program = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // MZ: a Windows program
    for (const name of ["report.pdf", "report.docx", "report.doc", "report.txt", "report.csv"]) {
      expect(sniffDocument(program, name)).toBeUndefined();
    }
    expect(sniffDocument(ascii("%PDF-1.7"), "menu.docx")).toBeUndefined();
    expect(sniffDocument(docx, "menu.xlsx")).toBeUndefined();
    expect(sniffDocument(odt, "notes.ods")).toBeUndefined();
    expect(sniffDocument(ascii("#!/bin/sh\0"), "run.txt")).toBeUndefined();
  });

  it("rejects types that aren't listed, macro-enabled Office files and installers", () => {
    expect(sniffDocument(ascii("%PDF-1.7"), "menu")).toBeUndefined();
    expect(sniffDocument(ascii("hello"), "page.html")).toBeUndefined();
    expect(sniffDocument(ascii("echo hi"), "run.bat")).toBeUndefined();
    const docm = zip([
      { name: "[Content_Types].xml", data: "<Types/>" },
      { name: "word/document.xml", data: "<w:document/>" },
      { name: "word/vbaProject.bin", data: "macros" },
    ]);
    expect(sniffDocument(docm, "letter.docx")).toBeUndefined();
    const msi = [0x84, 0x10, 0x0c, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46];
    expect(sniffDocument(oleFile(msi), "setup.doc")).toBeUndefined();
  });
});

describe("zipEntryNames", () => {
  it("lists the names in a ZIP's central directory, or nothing for a broken one", () => {
    expect(zipEntryNames(docx)).toEqual(["[Content_Types].xml", "word/document.xml"]);
    expect(zipEntryNames(docx.subarray(0, docx.length - 30))).toBeUndefined();
    expect(zipEntryNames(ascii("not a zip"))).toBeUndefined();
  });
});
