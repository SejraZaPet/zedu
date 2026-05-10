import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Trash2, Pencil, Globe, Lock, BookOpen } from "lucide-react";
import type { TextbookTemplate } from "@/lib/textbook-templates";

const TextbookTemplatesManager = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TextbookTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TextbookTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("textbook_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Smazat tuto šablonu?")) return;
    const { error } = await supabase.from("textbook_templates").delete().eq("id", id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Šablona smazána" }); load(); }
  };

  const handleTogglePublic = async (tpl: TextbookTemplate) => {
    const { error } = await supabase
      .from("textbook_templates")
      .update({ is_public: !tpl.is_public })
      .eq("id", tpl.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else load();
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("textbook_templates")
      .update({
        name: editing.name,
        description: editing.description,
        is_public: editing.is_public,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Uloženo" }); setEditing(null); load(); }
  };

  if (loading) {
    return <div className="py-12 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Šablony učebnic</h2>
        <p className="text-sm text-muted-foreground">Spravujte veřejné a soukromé šablony pro rychlou tvorbu učebnic.</p>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Žádné šablony.</p>
      ) : (
        <div className="grid gap-3">
          {templates.map((tpl) => {
            const chapters = tpl.structure_json?.chapters ?? [];
            const lessonCount = chapters.reduce((s, c) => s + (c.lessons?.length ?? 0), 0);
            return (
              <div key={tpl.id} className="border border-border rounded-lg p-4 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">{tpl.name}</h3>
                      {tpl.is_public ? (
                        <Badge variant="secondary" className="text-[10px] gap-1"><Globe className="w-3 h-3" /> Veřejná</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] gap-1"><Lock className="w-3 h-3" /> Soukromá</Badge>
                      )}
                    </div>
                    {tpl.description && <p className="text-xs text-muted-foreground mt-1">{tpl.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-[10px]">{chapters.length} kapitol</Badge>
                      <Badge variant="outline" className="text-[10px]">{lessonCount} lekcí</Badge>
                      {tpl.subject && <Badge variant="outline" className="text-[10px]">{tpl.subject}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleTogglePublic(tpl)}>
                      {tpl.is_public ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...tpl })}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(tpl.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upravit šablonu</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Název</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Popis</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1" rows={3} />
              </div>
              <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-muted/30">
                <Switch checked={editing.is_public} onCheckedChange={(v) => setEditing({ ...editing, is_public: v })} />
                <Label className="text-sm">Sdílet veřejně</Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditing(null)} className="flex-1">Zrušit</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? "Ukládám…" : "Uložit"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TextbookTemplatesManager;
