import { describe, expect, it } from "vitest";
import {
  attachmentContentType,
  validateAssignmentAttachment,
} from "@/components/assignments/AttachmentsUploader";

const file = (name: string, type = "", size = 1) => ({ name, type, size });

describe("přílohy žákovského úkolu", () => {
  it.each([
    ["tabulka.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["tabulka.xls", "application/vnd.ms-excel"],
    ["data.csv", "text/csv"],
  ])("povolí %s a odvodí správný typ", (name, mime) => {
    const candidate = file(name, "");
    expect(validateAssignmentAttachment(candidate)).toBeNull();
    expect(attachmentContentType(candidate)).toBe(mime);
  });

  it("opraví typ dodaný prohlížečem podle přípony", () => {
    expect(attachmentContentType(file("data.csv", "application/vnd.ms-excel"))).toBe("text/csv");
  });

  it("odmítne makro sešit i soubor větší než 10 MB", () => {
    expect(validateAssignmentAttachment(file("makra.xlsm"))).toContain("Nepovolený typ");
    expect(validateAssignmentAttachment(file("tabulka.xlsx", "", 10 * 1024 * 1024 + 1))).toContain("10 MB");
  });
});