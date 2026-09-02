import ExcelJS from "exceljs";

/**
 * Rozdělí sloučené jméno (formát Bakalářů „Příjmení Jméno“) podle POSLEDNÍHO mezerníku.
 * Poslední slovo = jméno, zbytek = příjmení.
 * Jedno slovo bez mezery → příjmení = slovo, jméno prázdné + problém k ruční kontrole.
 */
export function splitFullName(raw: unknown): { jmeno: string; prijmeni: string; problem?: string } {
  const value = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return { jmeno: "", prijmeni: "", problem: "nelze rozdělit jméno – zkontrolujte ručně" };
  const idx = value.lastIndexOf(" ");
  if (idx === -1) {
    return { jmeno: "", prijmeni: value, problem: "nelze rozdělit jméno – zkontrolujte ručně" };
  }
  return { prijmeni: value.slice(0, idx).trim(), jmeno: value.slice(idx + 1).trim() };
}

/**
 * Rozebere zkratku třídy ve formátu [písmena][číslice].[písmeno] (Č1.A, H4.A, P1.B).
 * `obor_zkratka` a `skupina` jsou zatím jen informativní (appka nemá pole pro obor per uživatel).
 */
export function parseClassCode(
  trida: unknown,
): { rocnik: number | null; obor_zkratka: string | null; skupina: string | null } {
  const value = String(trida ?? "").trim();
  const m = value.match(/^([\p{L}]+)\s*(\d+)\s*[.\-/]?\s*([\p{L}]?)$/u);
  if (!m) return { rocnik: null, obor_zkratka: null, skupina: null };
  const rocnik = parseInt(m[2], 10);
  return {
    rocnik: Number.isFinite(rocnik) ? rocnik : null,
    obor_zkratka: m[1] || null,
    skupina: m[3] ? m[3].toUpperCase() : null,
  };
}

export interface ClassSummaryEntry {
  trida: string;
  rocnik: number | null;
  obor_zkratka: string | null;
  skupina: string | null;
  count: number;
}

/** Souhrn rozpoznaných tříd s odvozeným ročníkem a počtem žáků pro náhled před importem. */
export function summarizeClasses(rows: Array<Record<string, any>>): ClassSummaryEntry[] {
  const map = new Map<string, ClassSummaryEntry>();
  for (const row of rows) {
    const trida = String(row.trida ?? "").trim();
    if (!trida) continue;
    const existing = map.get(trida);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const parsed = parseClassCode(trida);
    const explicit = row.rocnik ? parseInt(String(row.rocnik), 10) : NaN;
    map.set(trida, {
      trida,
      rocnik: Number.isFinite(explicit) ? explicit : parsed.rocnik,
      obor_zkratka: parsed.obor_zkratka,
      skupina: parsed.skupina,
      count: 1,
    });
  }
  return [...map.values()].sort((a, b) => a.trida.localeCompare(b.trida, "cs"));
}

/** Vygeneruje a stáhne vzorovou XLSX šablonu importu (ukázkový řádek parser vyhodí). */
export async function downloadImportTemplate(fileName = "bezli-import-sablona.xlsx") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import");
  ws.columns = [
    { header: "jmeno", key: "jmeno", width: 18 },
    { header: "prijmeni", key: "prijmeni", width: 18 },
    { header: "email", key: "email", width: 28 },
    { header: "trida", key: "trida", width: 12 },
    { header: "rocnik", key: "rocnik", width: 10 },
    { header: "role", key: "role", width: 12 },
    { header: "poznamka", key: "poznamka", width: 34 },
  ];
  ws.getRow(1).font = { bold: true, name: "Arial" };
  ws.addRow({
    jmeno: "Vzorový",
    prijmeni: "Žák",
    email: "vzor@example.com",
    trida: "Č1.A",
    rocnik: 1,
    role: "zak",
    poznamka: "Příklad řádku – smažte před importem",
  });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
