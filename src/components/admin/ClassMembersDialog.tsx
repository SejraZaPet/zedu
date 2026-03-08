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
import { Search, UserPlus, X, UserCheck, Ban, CheckCheck } from "lucide-react";

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
  status: string;
}

interface Props {
  classItem: ClassItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const statusLabels: Record<string, string> = {
  pending: "Čeká",
  approved: "Schválený",
  blocked: "Blokovaný",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
};

const ClassMembersDialog = ({ classItem, open, onOpenChange, onUpdated }: Props) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [allStudents, setAllStudents] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"members" | "add">("members");

  const fetchData = async () => {
    setLoading(true);

    const { data: memberLinks } = await supabase
      .from("class_members")
      .select("user_id")
      .eq("class_id", classItem.id);

    const memberIds = new Set(memberLinks?.map((m: any) => m.user_id) ?? []);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, school, field_of_study, year, status")
      .order("last_name");

    const allProfiles: MemberProfile[] = (profiles ?? []).map((p: any) => ({
      ...p,
      status: p.status as string,
    }));

    setMembers(allProfiles.filter((p) => memberIds.has(p.id)));
    setAllStudents(allProfiles.filter((p) => !memberIds.has(p.id)));
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchData();
      setSearch("");
      setTab("members");
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

  const updateStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus as any })
      .eq("id", userId);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uloženo", description: `Stav studenta změněn na: ${statusLabels[newStatus]}` });
    fetchData();
    onUpdated();
  };

  const approveAllPending = async () => {
    const pendingMembers = members.filter((m) => m.status === "pending");
    if (pendingMembers.length === 0) return;

    const { error } = await supabase
      .from("profiles")
      .update({ status: "approved" as any })
      .in("id", pendingMembers.map((m) => m.id));

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uloženo", description: `Schváleno ${pendingMembers.length} studentů.` });
    fetchData();
    onUpdated();
  };

  const pendingCount = members.filter((m) => m.status === "pending").length;

  const filteredStudents = useMemo(() => {
    if (!search) return allStudents;
    const s = search.toLowerCase();
    return allStudents.filter(
      (p) => `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(s)
    );
  }, [allStudents, search]);

  const filteredMembers = useMemo(() => {
    if (!search) return members;
    const s = search.toLowerCase();
    return members.filter(
      (p) => `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(s)
    );
  }, [members, search]);

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
            {/* Tabs */}
            <div className="flex gap-2 border-b border-border pb-2">
              <Button
                variant={tab === "members" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab("members")}
              >
                Členové ({members.length})
              </Button>
              <Button
                variant={tab === "add" ? "default" : "ghost"}
                size="sm"
                onClick={() => setTab("add")}
              >
                <UserPlus className="w-4 h-4 mr-1" /> Přidat
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hledat jméno nebo e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {tab === "members" && (
              <div className="flex flex-col gap-2 min-h-0">
                {/* Approve all pending button */}
                {pendingCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start text-green-400 border-green-500/30 hover:bg-green-500/10"
                    onClick={approveAllPending}
                  >
                    <CheckCheck className="w-4 h-4 mr-1" />
                    Schválit všechny čekající ({pendingCount})
                  </Button>
                )}

                <div className="overflow-y-auto max-h-[400px] border border-border rounded-md divide-y divide-border">
                  {filteredMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      Zatím žádní studenti.
                    </p>
                  ) : (
                    filteredMembers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 px-3 hover:bg-muted/50 gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                        <Badge variant="outline" className={`text-xs shrink-0 ${statusColors[m.status] || ""}`}>
                          {statusLabels[m.status] || m.status}
                        </Badge>
                        <div className="flex gap-1 shrink-0">
                          {m.status !== "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus(m.id, "approved")}
                              className="h-7 px-1.5 text-green-400 hover:bg-green-500/10"
                              title="Schválit"
                            >
                              <UserCheck className="w-4 h-4" />
                            </Button>
                          )}
                          {m.status !== "blocked" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatus(m.id, "blocked")}
                              className="h-7 px-1.5 text-red-400 hover:bg-red-500/10"
                              title="Zablokovat"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeMember(m.id)}
                            className="h-7 px-1.5 text-muted-foreground hover:text-destructive"
                            title="Odebrat ze třídy"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === "add" && (
              <div className="overflow-y-auto max-h-[400px] border border-border rounded-md divide-y divide-border">
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
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClassMembersDialog;
