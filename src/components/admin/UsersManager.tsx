import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Ban, UserCheck, Shield, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  school: string;
  field_of_study: string;
  year: number | null;
  status: string;
  created_at: string;
  role?: string;
}

const statusLabels: Record<string, string> = {
  pending: "Čeká na schválení",
  approved: "Schválený",
  blocked: "Zablokovaný",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  blocked: "bg-red-500/20 text-red-400 border-red-500/30",
};

const UsersManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch roles for all users
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) ?? []);

    const enriched = (profiles ?? []).map(p => ({
      ...p,
      status: p.status as string,
      role: roleMap.get(p.id) || "user",
    }));

    setUsers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (userId: string, newStatus: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus as any })
      .eq("id", userId);

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Uloženo", description: `Stav uživatele změněn na: ${statusLabels[status]}` });
    fetchUsers();
  };

  const filtered = users.filter(u => {
    const matchesSearch = !search || 
      `${u.first_name} ${u.last_name} ${u.email} ${u.school}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || u.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="text-muted-foreground p-4">Načítání uživatelů...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hledat jméno, email, školu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtr stavu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny stavy</SelectItem>
            <SelectItem value="pending">Čeká na schválení</SelectItem>
            <SelectItem value="approved">Schválený</SelectItem>
            <SelectItem value="blocked">Zablokovaný</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Celkem: {filtered.length} uživatel{filtered.length === 1 ? "" : filtered.length < 5 ? "é" : "ů"}
      </div>

      <div className="space-y-2">
        {filtered.map((user) => (
          <div key={user.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {user.first_name} {user.last_name}
                  </span>
                  {user.role === "admin" && (
                    <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                      <Shield className="w-3 h-3 mr-1" /> Admin
                    </Badge>
                  )}
                  <Badge variant="outline" className={`text-xs ${statusColors[user.status] || ""}`}>
                    {statusLabels[user.status] || user.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {user.email}
                  {user.school && <> · {user.school}</>}
                  {user.field_of_study && <> · {user.field_of_study}</>}
                  {user.year && <> · {user.year}. ročník</>}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Registrace: {new Date(user.created_at).toLocaleDateString("cs-CZ")}
                </div>
              </div>

              {user.role !== "admin" && (
                <div className="flex gap-2 flex-shrink-0">
                  {user.status !== "approved" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(user.id, "approved")}
                      className="text-green-400 border-green-500/30 hover:bg-green-500/10">
                      <UserCheck className="w-4 h-4 mr-1" /> Schválit
                    </Button>
                  )}
                  {user.status !== "blocked" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(user.id, "blocked")}
                      className="text-red-400 border-red-500/30 hover:bg-red-500/10">
                      <Ban className="w-4 h-4 mr-1" /> Blokovat
                    </Button>
                  )}
                  {user.status !== "pending" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(user.id, "pending")}
                      className="text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10">
                      Čekající
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Žádní uživatelé nenalezeni.
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersManager;
