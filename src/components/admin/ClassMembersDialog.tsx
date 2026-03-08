import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, UserPlus, X } from "lucide-react";

interface ClassItem {
  id: string;
  name: string;
}

interface MemberProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  school: string;
  field_of_study: string;
  year: number | null;
}

interface Props {
  classItem: ClassItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const ClassMembersDialog = ({ classItem, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [allStudents, setAllStudents] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);

    // Get current members
    const { data: memberLinks } = await supabase
      .from("class_members")
      .select("user_id")
      .eq("class_id", classItem.id);

    const memberIds = new Set(memberLinks?.map((m: any) => m.user_id) ?? []);

    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, school, field_of_study, year")
      .order("last_name");

    const allProfiles: MemberProfile[] = (profiles ?? []) as MemberProfile[];

    setMembers(allProfiles.filter((p) => memberIds.has(p.id)));
    setAllStudents(allProfiles.filter((p) => !memberIds.has(p.id)));
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchData();
      setSearch("");
    }
  }, [open, classItem.id]);

  const addMember = async (userId: string) => {
    const { error } = await supabase.from("class_members").insert({
      class_id: classItem.id,
      user_id: userId,
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    fetchData();
    onUpdated();
  };

  const removeMember = async (userId: string) => {
    const { error } = await supabase
      .from("class_members")
      .delete()
      .eq("class_id", classItem.id)
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    fetchData();
    onUpdated();
  };

  const filteredStudents = useMemo(() => {
    if (!search) return allStudents;
    const s = search.toLowerCase();
    return allStudents.filter(
      (p) => `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(s)
    );
  }, [allStudents, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Studenti – {classItem.name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-sm py-4">Načítání...</p>
        ) : (
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Current members */}
            <div>
              <p className="text-sm font-medium mb-2">Členové ({members.length})</p>
              {members.length === 0 ? (
                <p className="text-xs text-muted-foreground">Zatím žádní studenti.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => (
                    <Badge key={m.id} variant="secondary" className="text-xs py-1 px-2 gap-1">
                      {m.first_name} {m.last_name}
                      <button
                        onClick={() => removeMember(m.id)}
                        className="ml-1 hover:text-destructive transition-colors"
                        title="Odebrat"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Add students */}
            <div className="flex flex-col gap-2 min-h-0">
              <p className="text-sm font-medium">Přidat studenta</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat jméno nebo e-mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="overflow-y-auto max-h-[300px] border border-border rounded-md divide-y divide-border">
                {filteredStudents.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">
                    {allStudents.length === 0 ? "Všichni studenti jsou již přiřazeni." : "Žádný student nenalezen."}
                  </p>
                ) : (
                  filteredStudents.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 px-3 hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => addMember(s.id)} className="h-7 px-2 shrink-0">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClassMembersDialog;
