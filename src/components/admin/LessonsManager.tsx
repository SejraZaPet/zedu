import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

interface Lesson {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

const LessonsManager = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchLessons = async () => {
    const { data } = await supabase.from("lessons").select("*").order("sort_order");
    if (data) setLessons(data);
  };

  useEffect(() => { fetchLessons(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    if (isNew) {
      await supabase.from("lessons").insert({
        title: editing.title,
        content: editing.content,
        sort_order: editing.sort_order,
      });
    } else {
      await supabase.from("lessons").update({
        title: editing.title,
        content: editing.content,
        sort_order: editing.sort_order,
      }).eq("id", editing.id);
    }
    setEditing(null);
    setIsNew(false);
    fetchLessons();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tuto lekci?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    fetchLessons();
  };

  const startNew = () => {
    setEditing({ id: "", title: "", content: "", sort_order: lessons.length });
    setIsNew(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl">Lekce</h2>
        <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
      </div>

      {editing && (
        <div className="border border-border rounded-lg p-4 mb-6 bg-card space-y-3">
          <div>
            <Label>Název</Label>
            <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Obsah</Label>
            <Textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} rows={6} className="mt-1" />
          </div>
          <div>
            <Label>Pořadí</Label>
            <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: parseInt(e.target.value) || 0 })} className="mt-1 w-24" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Uložit</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}><X className="w-4 h-4 mr-1" /> Zrušit</Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {lessons.map((lesson) => (
          <div key={lesson.id} className="flex items-center justify-between border border-border rounded-lg p-3 bg-card">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{lesson.title}</p>
              <p className="text-xs text-muted-foreground truncate">{lesson.content.substring(0, 80)}...</p>
            </div>
            <div className="flex gap-1 ml-3">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(lesson); setIsNew(false); }}><Pencil className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(lesson.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {lessons.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Zatím žádné lekce.</p>}
      </div>
    </div>
  );
};

export default LessonsManager;
