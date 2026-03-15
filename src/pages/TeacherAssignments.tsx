import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Plus, CalendarIcon, Trash2, Send, Clock, Users, Shuffle, RotateCcw, Eye, EyeOff, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AssignmentResultsDashboard from "@/components/admin/AssignmentResultsDashboard";

interface Assignment {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string | null;
  max_attempts: number;
  randomize_choices: boolean;
  randomize_order: boolean;
  class_id: string | null;
  created_at: string;
  activity_data: any[];
}

const TeacherAssignments = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [randomizeChoices, setRandomizeChoices] = useState(false);
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [assignmentsRes, classesRes] = await Promise.all([
      supabase.from("assignments" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("classes").select("id, name").eq("archived", false),
    ]);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data as any);
    if (classesRes.data) setClasses(classesRes.data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast({ title: "Chyba", description: "Zadej název úlohy.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nepřihlášen");

      const { error } = await supabase.from("assignments" as any).insert({
        teacher_id: user.id,
        title: title.trim(),
        description: description.trim(),
        deadline: deadline?.toISOString() || null,
        max_attempts: maxAttempts,
        randomize_choices: randomizeChoices,
        randomize_order: randomizeOrder,
        class_id: selectedClassId || null,
        status: "draft",
        activity_data: [],
      } as any);

      if (error) throw error;
      toast({ title: "Úloha vytvořena" });
      setShowForm(false);
      resetForm();
      loadData();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDeadline(undefined);
    setMaxAttempts(1);
    setRandomizeChoices(false);
    setRandomizeOrder(false);
    setSelectedClassId("");
  };

  const handlePublish = async (id: string) => {
    const { error } = await supabase.from("assignments" as any).update({ status: "published" } as any).eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Úloha publikována" });
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("assignments" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Úloha smazána" });
      loadData();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Úlohy pro žáky</h1>
            <p className="text-sm text-muted-foreground">Vytvářej a spravuj zadání úloh</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Nová úloha
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Nová úloha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Název</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="např. Test – Zlomky" className="mt-1" />
              </div>
              <div>
                <Label>Popis (volitelný)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instrukce pro žáky…" className="mt-1" rows={2} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Deadline */}
                <div>
                  <Label>Termín odevzdání</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1 justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {deadline ? format(deadline, "d. M. yyyy", { locale: cs }) : "Bez termínu"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadline}
                        onSelect={setDeadline}
                        disabled={(date) => date < new Date()}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Max attempts */}
                <div>
                  <Label>Počet pokusů</Label>
                  <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="mt-1" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Class */}
                <div>
                  <Label>Třída (volitelné)</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Všichni žáci" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Všichni žáci</SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Randomization */}
              <div className="flex flex-col gap-3 p-3 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm">Zamíchat pořadí otázek</Label>
                  </div>
                  <Switch checked={randomizeOrder} onCheckedChange={setRandomizeOrder} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-sm">Zamíchat volby u otázek</Label>
                  </div>
                  <Switch checked={randomizeChoices} onCheckedChange={setRandomizeChoices} />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Vytvořit
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Zrušit</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assignments list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Zatím žádné úlohy. Klikni na „Nová úloha".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <Card key={a.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{a.title}</h3>
                        <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-xs">
                          {a.status === "published" ? "Publikováno" : "Koncept"}
                        </Badge>
                      </div>
                      {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {a.deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(a.deadline), "d. M. yyyy", { locale: cs })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          {a.max_attempts} {a.max_attempts === 1 ? "pokus" : "pokusy"}
                        </span>
                        {a.randomize_order && <span className="flex items-center gap-1"><Shuffle className="w-3 h-3" /> Míchání</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {a.status === "draft" && (
                        <Button size="sm" variant="outline" onClick={() => handlePublish(a.id)}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Publikovat
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherAssignments;
