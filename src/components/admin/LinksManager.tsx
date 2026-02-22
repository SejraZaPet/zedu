import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

interface SectionLink {
  id: string;
  section_name: string;
  label: string;
  url: string;
  sort_order: number;
}

const LinksManager = () => {
  const [links, setLinks] = useState<SectionLink[]>([]);
  const [editing, setEditing] = useState<SectionLink | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fetchLinks = async () => {
    const { data } = await supabase.from("section_links").select("*").order("section_name").order("sort_order");
    if (data) setLinks(data);
  };

  useEffect(() => { fetchLinks(); }, []);

  const handleSave = async () => {
    if (!editing) return;
    const payload = {
      section_name: editing.section_name,
      label: editing.label,
      url: editing.url,
      sort_order: editing.sort_order,
    };
    if (isNew) {
      await supabase.from("section_links").insert(payload);
    } else {
      await supabase.from("section_links").update(payload).eq("id", editing.id);
    }
    setEditing(null);
    setIsNew(false);
    fetchLinks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu smazat tento odkaz?")) return;
    await supabase.from("section_links").delete().eq("id", id);
    fetchLinks();
  };

  const startNew = () => {
    setEditing({ id: "", section_name: "", label: "", url: "", sort_order: 0 });
    setIsNew(true);
  };

  const sections = [...new Set(links.map(l => l.section_name))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl">Odkazy v sekcích</h2>
        <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Přidat</Button>
      </div>

      {editing && (
        <div className="border border-border rounded-lg p-4 mb-6 bg-card space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Sekce (např. ucebnice, podcast)</Label>
              <Input value={editing.section_name} onChange={(e) => setEditing({ ...editing, section_name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Popisek</Label>
              <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>URL</Label>
            <Input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} className="mt-1" />
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

      {sections.length > 0 ? sections.map((section) => (
        <div key={section} className="mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-primary mb-2">{section}</h3>
          <div className="space-y-2">
            {links.filter(l => l.section_name === section).map((link) => (
              <div key={link.id} className="flex items-center justify-between border border-border rounded-lg p-3 bg-card">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{link.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                </div>
                <div className="flex gap-1 ml-3">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(link); setIsNew(false); }}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(link.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )) : <p className="text-sm text-muted-foreground text-center py-8">Zatím žádné odkazy.</p>}
    </div>
  );
};

export default LinksManager;
