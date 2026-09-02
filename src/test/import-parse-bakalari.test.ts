import { describe, it, expect } from "vitest";
import { parseImportFile } from "@/components/admin/UsersManager";

const csv = `Příjmení a jméno,Třída,E-mail
Balogová Natálie,Č1.A,
Dobreva Dora,Č1.A,
Novák Petr,H4.A,petr@skola.cz
Cher,P1.B,
`;

describe("parseImportFile – Bakaláři", () => {
  it("rozdělí jméno a odvodí ročník", async () => {
    const f = { name: "bakalari.csv", type: "text/csv", text: async () => csv } as unknown as File;
    const rows = await parseImportFile(f);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ prijmeni: "Balogová", jmeno: "Natálie", trida: "Č1.A", rocnik: "1" });
    expect(rows[2]).toMatchObject({ prijmeni: "Novák", jmeno: "Petr", rocnik: "4" });
    expect(rows[3].__nameProblem).toBeTruthy();
  });
});
