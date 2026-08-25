import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, Zap, Loader2, Clock } from "lucide-react";

export const BEZLISTART_TAGLINE =
  "BezliStart — krátká aktivita na rozproudění myšlení, ideální na začátek hodiny";

export const BEZLISTART_CATEGORIES = [
  { value: "vizualni", label: "Vizuální" },
  { value: "verbalni", label: "Verbální" },
  { value: "pohybova", label: "Pohybová" },
  { value: "tymova", label: "Týmová" },
  { value: "jina", label: "Jiná" },
] as const;

export const zedstartCategoryLabel = (value?: string | null) =>
  BEZLISTART_CATEGORIES.find((c) => c.value === value)?.label ?? "Bez kategorie";

interface Prompt {
  id: string;
  category: string | null;
  prompt_text: string;
  suggested_duration_minutes: number;
  created_at: string;
}

const TeacherBezliStart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [formCategory, setFormCategory] = useState<string>("jina");
  const [formText, setFormText] = useState("");
  const [formDuration, setFormDuration] = useState("5");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("zedstart_prompts")
      .select("id, category, prompt_text, suggested_duration_minutes, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Nepodařilo se načíst aktivity", description: error.message, variant: "destructive" });
    } else {
      setPrompts((data as Prompt[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(
    () => (filter === "all" ? prompts : prompts.filter((p) => (p.category ?? "jina") === filter)),
    [prompts, filter]
  );

  const openNew = () => {
    setEditing(null);
    setFormCategory("jina");
    setFormText("");
    setFormDuration("5");
    setDialogOpen(true);
  };

  const openEdit = (p: Prompt) => {
    setEditing(p);
    setFormCategory(p.category ?? "jina");
    setFormText(p.prompt_text);
    setFormDuration(String(p.suggested_duration_minutes));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!formText.trim()) {
      toast({ title: "Doplňte zadání aktivity", variant: "destructive" });
      return;
    }
    if (!user) return;
    setSaving(true);
    const payload = {
      teacher_id: user.id,
      category: formCategory,
      prompt_text: formText.trim(),
      suggested_duration_minutes: Math.max(1, Math.min(60, Number(formDuration) || 5)),
    };
    const { error } = editing
      ? await supabase.from("zedstart_prompts").update(payload).eq("id", editing.id)
      : await supabase.from("zedstart_prompts").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Nepodařilo se uložit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Aktivita upravena" : "Aktivita přidána" });
    setDialogOpen(false);
    load();
  };

  const remove = async (p: Prompt) => {
    const { error } = await supabase.from("zedstart_prompts").delete().eq("id", p.id);
    if (error) {
      toast({ title: "Nepodařilo se smazat", description: error.message, variant: "destructive" });
      return;
    }
    setPrompts((prev) => prev.filter((x) => x.id !== p.id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate("/ucitel")}>
          <ArrowLeft size={16} /> Zpět
        </Button>

        <header className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" /> BezliStart
          </h1>
          <p className="text-muted-foreground mt-1">{BEZLISTART_TAGLINE}</p>
        </header>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kategorie</SelectItem>
              {BEZLISTART_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-2">
            <Plus size={16} /> Přidat aktivitu
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítám…
          </p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Zatím tu nemáte žádné BezliStart aktivity. Přidejte první zadání – pak ji vložíte do živé
              prezentace jedním klikem.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2 flex-row items-start justify-between gap-3 space-y-0">
                  <CardTitle className="text-base font-medium leading-snug">{p.prompt_text}</CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Pencil size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(p)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{zedstartCategoryLabel(p.category)}</Badge>
                  <span className="flex items-center gap-1">
                    <Clock size={13} /> {p.suggested_duration_minutes} min
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Upravit aktivitu" : "Nová BezliStart aktivita"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BEZLISTART_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zs-text">Zadání aktivity</Label>
              <Textarea
                id="zs-text"
                rows={4}
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder="Např. Nakresli jedním slovem, jak se dnes cítíš."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zs-dur">Doporučená délka (minuty)</Label>
              <Input
                id="zs-dur"
                type="number"
                min={1}
                max={60}
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
                className="w-28"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Zrušit
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Uložit
            </Button>
          </DialogFooter>
        </DialogContent>

      </Dialog>
    </div>
  );
};

export default TeacherBezliStart;
