import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GRADE_LEVEL_OPTIONS } from "@/lib/content-shares";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StatRow {
  textbook_id: string;
  title: string | null;
  subject: string | null;
  grade_level: string[] | null;
  author: string | null;
  total_shares: number;
  public_shares: number;
  direct_shares: number;
  has_materials: boolean;
  used_in_classes: number;
}

export default function TextbookOverviewManager() {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<{ slug: string; label: string }[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [grade, setGrade] = useState("all");
  const [materials, setMaterials] = useState<"all" | "yes" | "no">("all");

  useEffect(() => {
    (async () => {
      const [{ data: subj }, { data, error }] = await Promise.all([
        supabase.from("textbook_subjects").select("slug,label").order("label"),
        supabase.from("textbook_marketplace_stats" as any).select("*"),
      ]);
      setSubjects((subj ?? []) as any);
      if (!error && data) setRows(data as unknown as StatRow[]);
      setLoading(false);
    })();
  }, []);

  const subjectLabel = useMemo(() => {
    const m = new Map(subjects.map((s) => [s.slug, s.label]));
    return (slug?: string | null) => (slug ? m.get(slug) ?? slug : "—");
  }, [subjects]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !(r.title ?? "").toLowerCase().includes(search.toLowerCase()))
        return false;
      if (subject !== "all" && r.subject !== subject) return false;
      if (grade !== "all" && !(r.grade_level ?? []).includes(grade)) return false;
      if (materials === "yes" && !r.has_materials) return false;
      if (materials === "no" && r.has_materials) return false;
      return true;
    });
  }, [rows, search, subject, grade, materials]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Přehled učebnic</h2>
        <p className="text-sm text-muted-foreground">
          Agregovaná čísla o sdílení a využití učebnic. Obsah lekcí není zobrazen.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Hledat podle názvu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger>
            <SelectValue placeholder="Předmět" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny předměty</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.slug} value={s.slug}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger>
            <SelectValue placeholder="Stupeň" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny stupně</SelectItem>
            {GRADE_LEVEL_OPTIONS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={materials} onValueChange={(v) => setMaterials(v as any)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Materiály: vše</SelectItem>
            <SelectItem value="yes">Má materiály</SelectItem>
            <SelectItem value="no">Bez materiálů</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Předmět</TableHead>
                <TableHead>Stupeň</TableHead>
                <TableHead className="text-right">Sdílení celkem</TableHead>
                <TableHead className="text-right">Veřejná</TableHead>
                <TableHead className="text-right">Přímá</TableHead>
                <TableHead>Materiály</TableHead>
                <TableHead className="text-right">Ve třídách</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Žádné učebnice odpovídající filtrům.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.textbook_id}>
                  <TableCell className="font-medium">{r.title ?? "—"}</TableCell>
                  <TableCell>{r.author ?? "—"}</TableCell>
                  <TableCell>{subjectLabel(r.subject)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.grade_level ?? []).map((g) => (
                        <Badge key={g} variant="secondary" className="text-[10px]">
                          {GRADE_LEVEL_OPTIONS.find((o) => o.value === g)?.label ?? g}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.total_shares}</TableCell>
                  <TableCell className="text-right">{r.public_shares}</TableCell>
                  <TableCell className="text-right">{r.direct_shares}</TableCell>
                  <TableCell>
                    {r.has_materials ? (
                      <Badge variant="outline">Ano</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.used_in_classes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
