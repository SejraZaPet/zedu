import { describe, it, expect } from "vitest";
import { resolveImportRole, parseImportFile } from "@/components/admin/UsersManager";

const csv = `jmeno,prijmeni,email,skola,trida,rocnik,role
Jan,Novák,,ZŠ Test,3.A,3,Učitel
Petra,Malá,,ZŠ Test,,,UČITEL
Eva,Lektorová,,,,,lektor
Karel,Otec,,,,,Rodič
Anna,Žákyně,,ZŠ Test,3.A,3,žák
Tomáš,Prazdny,,ZŠ Test,3.A,3,
Chyba,Preklep,,ZŠ Test,3.A,3,ucitl
`;

describe("import role mapping", () => {
  it("resolves aliases", () => {
    expect(resolveImportRole("Učitel")).toBe("teacher");
    expect(resolveImportRole(" UČITEL ")).toBe("teacher");
    expect(resolveImportRole("teacher")).toBe("teacher");
    expect(resolveImportRole("lektor")).toBe("lektor");
    expect(resolveImportRole("Rodič")).toBe("rodic");
    expect(resolveImportRole("parent")).toBe("rodic");
    expect(resolveImportRole("žák")).toBe("user");
    expect(resolveImportRole("student")).toBe("user");
    expect(resolveImportRole("")).toBe("user");
    expect(resolveImportRole("ucitl")).toBeNull();
  });

  it("parses CSV and flags unknown role", async () => {
    const file = new File([csv], "users.csv", { type: "text/csv" });
    const rows = await parseImportFile(file);
    expect(rows.length).toBe(7);
    expect(rows.map(r => resolveImportRole(r.role))).toEqual([
      "teacher","teacher","lektor","rodic","user","user",null,
    ]);
    const bad = rows.filter(r => resolveImportRole(r.role) === null);
    expect(bad[0].__rowNum).toBe(8);
  });
});
