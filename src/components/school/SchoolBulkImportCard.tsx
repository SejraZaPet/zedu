import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, Download } from "lucide-react";
import { parseImportFile, resolveImportRole } from "@/components/admin/UsersManager";
import { summarizeClasses, downloadImportTemplate } from "@/lib/import-users";

/** Role, které smí správce školy zakládat. Ostatní řádky se přeskočí. */
const SCHOOL_ALLOWED_ROLES = ["user", "teacher"] as const;
type SchoolRole = (typeof SCHOOL_ALLOWED_ROLES)[number];

const ROLE_LABELS: Record<SchoolRole, string> = { user: "Žák", teacher: "Učitel" };

interface PreviewRow {
  __rowNum: number;
  __nameProblem?: string;
  jmeno: string;
  prijmeni: string;
  email?: string;
  rocnik?: string;
  trida?: string;
  role?: string;
  resolved: SchoolRole | null;
  problem?: string;
}


interface ResultRow {
  row_ref: number | string | null;
  name: string;
  ok: boolean;
  error?: string;
  email?: string;
  password?: string;
  username?: string;
  student_code?: string;
  pin?: string;
  role?: string;
  class_name?: string;
  class_warning?: string;
}

const SchoolBulkImportCard = ({ onImported }: { onImported: () => void }) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [classesConfirmed, setClassesConfirmed] = useState(false);
  const [yearOverrides, setYearOverrides] = useState<Record<string, string>>({});

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setResults(null);
    setClassesConfirmed(false);
    setYearOverrides({});
    try {
      const parsed = await parseImportFile(file);
      setRows(
        parsed.map((r: any) => {
          const resolved = resolveImportRole(r.role);
          const allowed = resolved && (SCHOOL_ALLOWED_ROLES as readonly string[]).includes(resolved);
          return {
            ...r,
            resolved: allowed ? (resolved as SchoolRole) : null,
            problem: !resolved
              ? `Neznámá role „${r.role ?? ""}“ – řádek bude přeskočen.`
              : !allowed
                ? `Roli „${r.role}“ nesmí zakládat správce školy – řádek bude přeskočen.`
                : r.__nameProblem
                  ? `${r.__nameProblem}`
                  : undefined,
          } as PreviewRow;
        }),
      );
    } catch (err: any) {
      setRows([]);
      setParseError(err?.message ?? "Soubor se nepodařilo přečíst.");
    }
  };

  const valid = rows.filter((r) => r.resolved);
  const skipped = rows.filter((r) => !r.resolved);
  const classSummary = useMemo(() => summarizeClasses(rows), [rows]);

  const runImport = async () => {
    if (valid.length === 0) return;
    setImporting(true);
    const { data, error } = await supabase.functions.invoke("create-school-user", {
      body: {
        users: valid.map((r) => ({
          first_name: r.jmeno,
          last_name: r.prijmeni,
          email: r.email || undefined,
          role: r.resolved,
          year: r.rocnik || yearOverrides[String(r.trida ?? "").trim()] || undefined,
          field_of_study: r.trida || undefined,
          row_ref: r.__rowNum,
        })),
      },
    });

    setImporting(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Import selhal",
        description: (data as any)?.error ?? error?.message ?? "Neznámá chyba",
        variant: "destructive",
      });
      return;
    }

    const list = ((data as any)?.results ?? []) as ResultRow[];
    setResults(list);
    const created = list.filter((r) => r.ok).length;
    const classesCreated = Number((data as any)?.classes_created ?? 0);
    const membersAdded = Number((data as any)?.class_members_added ?? 0);
    const parts = [
      membersAdded ? `Zařazeno ${membersAdded} žáků do tříd (nově vytvořeno ${classesCreated}).` : null,
      skipped.length ? `Přeskočeno ${skipped.length} řádků s nepovolenou rolí.` : null,
    ].filter(Boolean);
    toast({
      title: `Vytvořeno ${created} z ${valid.length}`,
      description: parts.length ? parts.join(" ") : undefined,
    });
    onImported();
  };

  const reset = () => {
    setRows([]);
    setResults(null);
    setFileName(null);
    setParseError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" /> Hromadný import žáků a učitelů
        </CardTitle>
        <CardDescription>
          Nahrajte Excel nebo CSV se sloupci <strong>Jméno</strong>, <strong>Příjmení</strong> a
          volitelně <strong>E-mail</strong>, <strong>Role</strong>, <strong>Ročník</strong>,{" "}
          <strong>Třída</strong>. Podporujeme i export z Bakalářů se sloučeným sloupcem
          „Příjmení a jméno“ a zkratkou třídy (např. Č1.A) — ročník odvodíme automaticky.
          Bez uvedené role se zakládá žák. Zakládat lze pouze žáky a učitele
          — a vždy jen do vaší školy.
        </CardDescription>

      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Vybrat soubor
          </Button>
          <Button variant="ghost" onClick={() => void downloadImportTemplate()}>
            <Download className="w-4 h-4 mr-1" /> Stáhnout šablonu
          </Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}

          {rows.length > 0 && (
            <Button variant="ghost" size="sm" onClick={reset}>
              Vyčistit
            </Button>
          )}
        </div>

        {parseError && (
          <p className="text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {parseError}
          </p>
        )}

        {rows.length > 0 && !results && (
          <>
            <div className="text-sm text-muted-foreground">
              Náhled: {valid.length} k založení
              {skipped.length > 0 && `, ${skipped.length} bude přeskočeno`}
            </div>
            {classSummary.length > 0 && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">Rozpoznané třídy</p>
                <p className="text-xs text-muted-foreground">
                  Pro každou třídu použijeme existující třídu školy se stejným názvem, jinak ji
                  založíme — a žáky do ní hned zařadíme.
                </p>
                {classSummary.map((c) => {
                  const year = c.rocnik ?? (yearOverrides[c.trida] ? parseInt(yearOverrides[c.trida], 10) : null);
                  return (
                    <div
                      key={c.trida}
                      className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${c.rocnik == null ? "bg-amber-500/10 border border-amber-500/30" : ""}`}
                    >
                      <span className="font-medium">{c.trida}</span>
                      <span className="text-muted-foreground">
                        → ročník {year ?? "neurčen"}, {c.count} žáků
                        {c.obor_zkratka && ` · obor ${c.obor_zkratka}${c.skupina ? `/${c.skupina}` : ""}`}
                      </span>
                      {c.rocnik == null && (
                        <Input
                          type="number"
                          min={1}
                          max={13}
                          placeholder="ročník"
                          className="h-7 w-24 ml-auto"
                          value={yearOverrides[c.trida] ?? ""}
                          onChange={(e) => setYearOverrides((prev) => ({ ...prev, [c.trida]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
                {!classesConfirmed && (
                  <Button size="sm" onClick={() => setClassesConfirmed(true)}>
                    Vypadá to správně, importovat
                  </Button>
                )}
              </div>
            )}

            <div className="border border-border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Řádek</TableHead>
                    <TableHead>Jméno</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Role v souboru</TableHead>
                    <TableHead>Odvozená role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.__rowNum} className={r.resolved ? "" : "bg-destructive/10"}>
                      <TableCell className="text-muted-foreground text-xs">{r.__rowNum}</TableCell>
                      <TableCell className="font-medium">
                        {r.jmeno} {r.prijmeni}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.email || <span className="italic">vygeneruje se</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.role || "—"}</TableCell>
                      <TableCell>
                        {r.resolved ? (
                          <Badge variant="outline">
                            {ROLE_LABELS[r.resolved]} ({r.resolved})
                          </Badge>
                        ) : (
                          <span className="text-xs text-destructive">{r.problem}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={runImport} disabled={importing || valid.length === 0 || (classSummary.length > 0 && !classesConfirmed)}>
              {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Importovat {valid.length} uživatelů
            </Button>
          </>
        )}

        {results && (
          <div className="space-y-2">
            <div className="border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jméno</TableHead>
                    <TableHead>Přihlášení</TableHead>
                    <TableHead>Heslo</TableHead>
                    <TableHead>Kód / PIN</TableHead>
                    <TableHead>Třída</TableHead>
                    <TableHead>Stav</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs">
                        {r.ok ? (
                          <>
                            {r.email}
                            <br />
                            <span className="text-muted-foreground">{r.username}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.password ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.ok ? [r.student_code, r.pin].filter(Boolean).join(" / ") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.class_name ? (
                          <Badge variant="outline">{r.class_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {r.class_warning && (
                          <span className="block text-destructive">{r.class_warning}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.ok ? (
                          <Badge>Vytvořeno</Badge>
                        ) : (
                          <span className="text-destructive">{r.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              Hesla si opište nebo vytiskněte — po opuštění stránky je už nezobrazíme.
            </p>
            <Button variant="outline" onClick={reset}>
              Importovat další soubor
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolBulkImportCard;
