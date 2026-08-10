import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, Search, School } from "lucide-react";

interface TeacherRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  /** Volný text školy zadaný při registraci */
  school: string | null;
}

const UnassignedTeachersManager = () => {
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [profRes, schoolRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, first_name, last_name, email, school")
        .is("school_id", null)
        .order("last_name"),
      supabase.from("schools").select("id, name").order("name"),
    ]);
    const ids = (profRes.data ?? []).map((p: any) => p.id);
    let teacherIds = new Set<string>();
    if (ids.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids)
        .in("role", ["teacher", "lektor"]);
      teacherIds = new Set((roles ?? []).map((r: any) => r.user_id));
    }
    setTeachers(((profRes.data as TeacherRow[]) ?? []).filter((p) => teacherIds.has(p.id)));
    setSchools((schoolRes.data as { id: string; name: string }[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      [t.first_name, t.last_name, t.email, t.school].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [teachers, search]);

  const assign = async (teacherId: string, schoolId: string) => {
    const { error } = await supabase.from("profiles").update({ school_id: schoolId }).eq("id", teacherId);
    if (error) {
      toast({ title: "Přiřazení selhalo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Učitel přiřazen ke škole" });
    setOpenFor(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl">Nepřiřazení učitelé</h2>
        <p className="text-sm text-muted-foreground">
          Učitelé a lektoři, kteří ještě nejsou navázaní na žádnou školu v systému.
        </p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Hledat podle jména, e-mailu nebo zadané školy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Žádní nepřiřazení učitelé.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Card key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  {`${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || "Bez jména"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.email ?? "—"}
                  {t.school ? ` · uvedená škola: ${t.school}` : ""}
                </p>
              </div>
              <Popover open={openFor === t.id} onOpenChange={(o) => setOpenFor(o ? t.id : null)}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" role="combobox" aria-expanded={openFor === t.id}>
                    <School className="w-4 h-4 mr-1" /> Přiřadit ke škole
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Hledat školu…" />
                    <CommandList>
                      <CommandEmpty>Škola nenalezena.</CommandEmpty>
                      <CommandGroup>
                        {schools.map((s) => (
                          <CommandItem key={s.id} value={s.name} onSelect={() => assign(t.id, s.id)}>
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            {s.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UnassignedTeachersManager;
