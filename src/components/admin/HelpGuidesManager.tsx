import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Trash2, Plus, Pencil, Search, GripVertical } from "lucide-react";
import BlockEditor from "@/components/admin/BlockEditor";
import type { Block } from "@/lib/textbook-config";
import { toast } from "sonner";

interface HelpGuide {
  id: string;
  title: string;
  role: string;
  category: string;
  description: string;
  blocks: Block[];
  sort_order: number;
  status: string;
}

const HelpGuidesManager = () => {
  const [guides, setGuides] = useState<HelpGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  const [editing, setEditing] = useState<HelpGuide | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("student");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [status, setStatus] = useState("draft");

  const fetchGuides = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("help_guides")
      .select("*")
      .order("sort_order", { ascending: true });
    if (!error && data) {
      setGuides(data.map(g => ({ ...g, blocks: (g.blocks || []) as unknown as Block[] })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchGuides(); }, [fetchGuides]);

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setRole("student");
    setCategory("");
    setDescription("");
    setBlocks([]);
    setStatus("draft");
    setSheetOpen(true);
  };

  const openEdit = (guide: HelpGuide) => {
    setEditing(guide);
    setTitle(guide.title);
    setRole(guide.role);
    setCategory(guide.category);
    setDescription(guide.description);
    setBlocks(guide.blocks);
    setStatus(guide.status);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Zadejte název návodu"); return; }

    const payload = {
      title: title.trim(),
      role,
      category: category.trim(),
      description: description.trim(),
      blocks: JSON.parse(JSON.stringify(blocks)),
      status,
      sort_order: editing?.sort_order ?? guides.length,
    };

    if (editing) {
      const { error } = await supabase.from("help_guides").update(payload).eq("id", editing.id);
      if (error) { toast.error("Chyba při ukládání"); return; }
      toast.success("Návod uložen");
    } else {
      const { error } = await supabase.from("help_guides").insert(payload);
      if (error) { toast.error("Chyba při vytváření"); return; }
      toast.success("Návod vytvořen");
    }
    setSheetOpen(false);
    fetchGuides();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tento návod?")) return;
    await supabase.from("help_guides").delete().eq("id", id);
    toast.success("Návod smazán");
    fetchGuides();
  };

  const toggleStatus = async (guide: HelpGuide) => {
    const newStatus = guide.status === "published" ? "draft" : "published";
    await supabase.from("help_guides").update({ status: newStatus }).eq("id", guide.id);
    fetchGuides();
  };

  const filtered = guides.filter(g => {
    if (filterRole !== "all" && g.role !== filterRole) return false;
    if (searchQuery && !g.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-semibold">Nápověda / Návody</h2>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nový návod</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Hledat návod…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny role</SelectItem>
            <SelectItem value="teacher">Učitel</SelectItem>
            <SelectItem value="student">Žák</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Načítání…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Žádné návody</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(guide => (
            <div key={guide.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{guide.title}</span>
                  <Badge variant={guide.role === "teacher" ? "default" : "secondary"} className="text-xs">
                    {guide.role === "teacher" ? "Učitel" : "Žák"}
                  </Badge>
                  {guide.category && <Badge variant="outline" className="text-xs">{guide.category}</Badge>}
                  <Badge variant={guide.status === "published" ? "default" : "outline"} className="text-xs">
                    {guide.status === "published" ? "Publikováno" : "Koncept"}
                  </Badge>
                </div>
                {guide.description && <p className="text-sm text-muted-foreground truncate">{guide.description}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => toggleStatus(guide)}>
                {guide.status === "published" ? "Skrýt" : "Publikovat"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => openEdit(guide)}><Pencil className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(guide.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Upravit návod" : "Nový návod"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Název</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Jak vytvořit učebnici" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Učitel</SelectItem>
                    <SelectItem value="student">Žák</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stav</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Koncept</SelectItem>
                    <SelectItem value="published">Publikováno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Kategorie (volitelné)</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Učebnice, Lekce, Aktivity…" />
            </div>
            <div>
              <Label>Krátký popis</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Krátký popis návodu…" rows={2} />
            </div>
            <div>
              <Label className="mb-2 block">Obsah návodu</Label>
              <BlockEditor blocks={blocks} onChange={setBlocks} />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Zrušit</Button>
              <Button onClick={handleSave}>Uložit</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default HelpGuidesManager;
