import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Info, ChevronRight } from "lucide-react";
import ClassEngagementCard from "./ClassEngagementCard";

interface ClassRow {
  class_id: string;
  name: string;
  year: number | null;
  field_of_study: string | null;
  students: number;
  active_14d: number;
  inactive_14d: number;
  assignments_published: number;
  missed_total: number;
  avg_recent: number | null;
}

const SchoolEngagementTab = ({ schoolId }: { schoolId: string }) => {
  const [rows, setRows] = useState<ClassRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("school_engagement_overview", { _school_id: schoolId });
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((((data as any)?.classes ?? []) as ClassRow[]));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return (
    <div className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Žáci – statistiky zapojení</CardTitle>
          <CardDescription className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Agregovaný statistický přehled podle tříd. Slouží k podpoře výuky, nejde o hodnocení osobnosti žáků.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Načítám…
            </div>
          )}
          {error && <p className="text-sm text-destructive">Nepodařilo se načíst: {error}</p>}
          {!loading && !error && rows && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Škola nemá zatím žádné aktivní třídy.</p>
          )}
          {!loading && !error && rows && rows.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Třída</TableHead>
                    <TableHead className="text-right">Žáků</TableHead>
                    <TableHead className="text-right">Aktivních 14 d</TableHead>
                    <TableHead className="text-right">Neaktivních 14 d</TableHead>
                    <TableHead className="text-right">Zadaných úkolů</TableHead>
                    <TableHead className="text-right">Nesplněno po termínu</TableHead>
                    <TableHead className="text-right">Průměr 30 d</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.class_id}>
                      <TableCell className="font-medium">
                        {r.name}
                        {r.field_of_study && <span className="text-muted-foreground"> · {r.field_of_study}</span>}
                      </TableCell>
                      <TableCell className="text-right">{r.students}</TableCell>
                      <TableCell className="text-right">{r.active_14d}</TableCell>
                      <TableCell className="text-right">{r.inactive_14d}</TableCell>
                      <TableCell className="text-right">{r.assignments_published}</TableCell>
                      <TableCell className="text-right">{r.missed_total}</TableCell>
                      <TableCell className="text-right">{r.avg_recent === null ? "—" : `${r.avg_recent} %`}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setDetail(r)}>
                          Detail <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
          </DialogHeader>
          {detail && <ClassEngagementCard classId={detail.class_id} className="border-0 shadow-none" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchoolEngagementTab;
