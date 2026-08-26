import { BetaBadge } from "@/components/common/BetaBadge";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Calendar, Flag, UserPlus, Pencil } from "lucide-react";
import { useMySchool, useSchoolColleagues, colleagueLabel } from "@/hooks/useMySchool";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Todo {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  type: string;
  status: string;
  priority: string;
  created_at: string;
  user_id?: string;
  assigned_by?: string | null;
}


const typeLabel: Record<string, string> = {
  task: "Úkol",
  test: "Test",
  homework: "Domácí úkol",
  project: "Projekt",
  other: "Jiné",
};

const priorityColor: Record<string, string> = {
  high: "text-red-500",
  normal: "text-yellow-500",
  low: "text-green-500",
};

const TodoPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { schoolId, hasSchool } = useMySchool();
  const { colleagues } = useSchoolColleagues(schoolId);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [delegated, setDelegated] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateSaving, setDelegateSaving] = useState(false);
  const [delegateForm, setDelegateForm] = useState({
    assignee: "",
    title: "",
    description: "",
    due_date: "",
    priority: "normal",
  });
  const [filter, setFilter] = useState<"all" | "pending" | "done" | "today">(
    "all",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    due_date: "",
    type: "task",
    priority: "normal",
  });
  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    due_date: "",
    type: "task",
    priority: "normal",
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchTodos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const fetchTodos = async () => {
    if (!user) return;
    const [mineRes, delegatedRes] = await Promise.all([
      supabase
        .from("todos")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("todos")
        .select("*")
        .eq("assigned_by", user.id)
        .neq("user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);
    if (mineRes.error) {
      toast({ title: "Chyba", description: mineRes.error.message, variant: "destructive" });
    } else {
      setTodos((mineRes.data as Todo[]) || []);
    }
    setDelegated((delegatedRes.data as Todo[]) || []);
    setLoading(false);
  };

  const delegateTodo = async () => {
    if (!user) return;
    if (!delegateForm.assignee || !delegateForm.title.trim()) {
      toast({ title: "Vyberte kolegu a zadejte název", variant: "destructive" });
      return;
    }
    setDelegateSaving(true);
    const { error } = await supabase.from("todos").insert({
      user_id: delegateForm.assignee,
      assigned_by: user.id,
      title: delegateForm.title.trim(),
      description: delegateForm.description || null,
      due_date: delegateForm.due_date || null,
      type: "task",
      priority: delegateForm.priority,
      status: "pending",
    });
    setDelegateSaving(false);
    if (error) {
      toast({ title: "Zadání se nepodařilo", description: error.message, variant: "destructive" });
      return;
    }
    setDelegateForm({ assignee: "", title: "", description: "", due_date: "", priority: "normal" });
    setDelegateOpen(false);
    toast({ title: "Úkol byl zadán kolegovi" });
    fetchTodos();
  };


  const addTodo = async () => {
    if (!newTodo.title.trim() || !user) return;
    const { error } = await supabase.from("todos").insert({
      user_id: user.id,
      title: newTodo.title.trim(),
      description: newTodo.description || null,
      due_date: newTodo.due_date || null,
      type: newTodo.type,
      priority: newTodo.priority,
      status: "pending",
    });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setNewTodo({ title: "", description: "", due_date: "", type: "task", priority: "normal" });
    setAddOpen(false);
    fetchTodos();
  };

  const toggleTodo = async (todo: Todo) => {
    const newStatus = todo.status === "done" ? "pending" : "done";
    const { error } = await supabase
      .from("todos")
      .update({ status: newStatus })
      .eq("id", todo.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    fetchTodos();
  };

  const deleteTodo = async (id: string) => {
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    fetchTodos();
  };

  const today = new Date().toISOString().split("T")[0];
  const overdue = todos.filter(
    (t) => t.due_date && t.due_date < today && t.status === "pending",
  ).length;

  const filtered = todos.filter((t) => {
    if (filter === "pending") return t.status === "pending";
    if (filter === "done") return t.status === "done";
    if (filter === "today") return t.due_date === today;
    return true;
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-3xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-3xl font-bold">Moje úkoly</h1>
            {overdue > 0 && (
              <p className="text-sm text-red-500 mt-1">
                ⚠️ {overdue} {overdue === 1 ? "úkol" : overdue < 5 ? "úkoly" : "úkolů"} po termínu
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {hasSchool && (
              <Button variant="outline" onClick={() => setDelegateOpen(true)} className="gap-2">
                <UserPlus className="w-4 h-4" />
                Zadat úkol kolegovi
                <BetaBadge context="Zadat úkol kolegovi" />
              </Button>
            )}
            <Button onClick={() => setAddOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Přidat úkol
            </Button>
          </div>
        </div>


        <div className="flex gap-2 mb-6 flex-wrap">
          {(["all", "pending", "done", "today"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "Vše" : f === "pending" ? "Čeká" : f === "done" ? "Hotovo" : "Dnes"}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Načítání...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Žádné úkoly</p>
          ) : (
            filtered.map((todo) => (
              <div
                key={todo.id}
                className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
              >
                <Checkbox
                  checked={todo.status === "done"}
                  onCheckedChange={() => toggleTodo(todo)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium ${
                        todo.status === "done" ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {todo.title}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {typeLabel[todo.type] || todo.type}
                    </span>
                    <Flag
                      className={`w-3.5 h-3.5 ${priorityColor[todo.priority] || ""}`}
                    />
                    {todo.assigned_by && todo.assigned_by !== user?.id && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        Zadal(a):{" "}
                        {colleagueLabel(
                          colleagues.find((c) => c.id === todo.assigned_by),
                        ) || "kolega"}
                      </span>
                    )}
                  </div>

                  {todo.description && (
                    <p className="text-sm text-muted-foreground mt-1">{todo.description}</p>
                  )}
                  {todo.due_date && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(todo.due_date).toLocaleDateString("cs-CZ")}</span>
                      {todo.due_date < today && todo.status === "pending" && (
                        <span className="text-red-500 font-medium"> – po termínu!</span>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTodo(todo.id)}
                  className="text-red-500 hover:bg-red-50 h-8 w-8 p-0 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        {hasSchool && delegated.length > 0 && (
          <div className="mt-10">
            <h2 className="font-heading text-xl font-bold mb-3 flex items-center gap-2">Zadané kolegům <BetaBadge context="Zadané kolegům" /></h2>
            <div className="space-y-2">
              {delegated.map((todo) => (
                <div
                  key={todo.id}
                  className="bg-muted/40 border border-border rounded-xl p-4 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{todo.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-background text-muted-foreground">
                        {colleagueLabel(colleagues.find((c) => c.id === todo.user_id)) ||
                          "kolega"}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          todo.status === "done"
                            ? "bg-green-500/15 text-green-600"
                            : "bg-yellow-500/15 text-yellow-700"
                        }`}
                      >
                        {todo.status === "done" ? "Hotovo" : "Čeká"}
                      </span>
                    </div>
                    {todo.due_date && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(todo.due_date).toLocaleDateString("cs-CZ")}</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTodo(todo.id)}
                    className="text-red-500 hover:bg-red-50 h-8 w-8 p-0 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Dialog open={delegateOpen} onOpenChange={setDelegateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Zadat úkol kolegovi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Kolega *</Label>
                <Select
                  value={delegateForm.assignee}
                  onValueChange={(v) => setDelegateForm({ ...delegateForm, assignee: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Vyberte kolegu ze školy" />
                  </SelectTrigger>
                  <SelectContent>
                    {colleagues
                      .filter((c) => c.id !== user?.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {colleagueLabel(c)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Název *</Label>
                <Input
                  value={delegateForm.title}
                  onChange={(e) => setDelegateForm({ ...delegateForm, title: e.target.value })}
                  placeholder="Co má kolega udělat?"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Popis</Label>
                <Input
                  value={delegateForm.description}
                  onChange={(e) =>
                    setDelegateForm({ ...delegateForm, description: e.target.value })
                  }
                  placeholder="Volitelný popis"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Termín</Label>
                  <Input
                    type="date"
                    value={delegateForm.due_date}
                    onChange={(e) =>
                      setDelegateForm({ ...delegateForm, due_date: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Priorita</Label>
                  <Select
                    value={delegateForm.priority}
                    onValueChange={(v) => setDelegateForm({ ...delegateForm, priority: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">🔴 Vysoká</SelectItem>
                      <SelectItem value="normal">🟡 Normální</SelectItem>
                      <SelectItem value="low">🟢 Nízká</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Úkol se objeví v seznamu úkolů kolegy. Vy uvidíte jeho stav, ale obsah už
                needitujete.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDelegateOpen(false)}>
                Zrušit
              </Button>
              <Button onClick={delegateTodo} disabled={delegateSaving}>
                {delegateSaving ? "Zadávám..." : "Zadat úkol"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Přidat úkol</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Název *</Label>
                <Input
                  value={newTodo.title}
                  onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                  placeholder="Co je potřeba udělat?"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Popis</Label>
                <Input
                  value={newTodo.description}
                  onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                  placeholder="Volitelný popis"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Termín</Label>
                  <Input
                    type="date"
                    value={newTodo.due_date}
                    onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Typ</Label>
                  <Select
                    value={newTodo.type}
                    onValueChange={(v) => setNewTodo({ ...newTodo, type: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">Úkol</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                      <SelectItem value="homework">Domácí úkol</SelectItem>
                      <SelectItem value="project">Projekt</SelectItem>
                      <SelectItem value="other">Jiné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Priorita</Label>
                <Select
                  value={newTodo.priority}
                  onValueChange={(v) => setNewTodo({ ...newTodo, priority: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 Vysoká</SelectItem>
                    <SelectItem value="normal">🟡 Normální</SelectItem>
                    <SelectItem value="low">🟢 Nízká</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Zrušit
              </Button>
              <Button onClick={addTodo}>Přidat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <SiteFooter />
    </div>
  );
};

export default TodoPage;
