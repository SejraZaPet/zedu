import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import BlockEditor from "./BlockEditor";
import PodcastPreviewDialog from "./PodcastPreviewDialog";
import { Plus, Pencil, Trash2, X, Save, ArrowLeft, Upload, Search, Eye } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

interface Episode {
  id: string;
  title: string;
  published_date: string;
  duration: string;
  status: string;
  audio_url: string;
  thumbnail_url: string;
  excerpt: string;
  blocks: Block[];
  sort_order: number;
}

const PodcastManager = () => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Episode | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [thumbUploading, setThumbUploading] = useState(false);

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("podcast_episodes")
      .select("*")
      .order("published_date", { ascending: false });

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data } = await query;
    let results = (data ?? []).map((d: any) => ({ ...d, blocks: (d.blocks as Block[]) || [] }));

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      results = results.filter((ep: Episode) => ep.title.toLowerCase().includes(q));
    }

    setEpisodes(results);
    setLoading(false);
  }, [filterStatus, searchQuery]);

  useEffect(() => { fetchEpisodes(); }, [fetchEpisodes]);

  const startNew = () => {
    setEditing({
      id: "",
      title: "",
      published_date: new Date().toISOString().split("T")[0],
      duration: "",
      status: "draft",
      audio_url: "",
      thumbnail_url: "",
      excerpt: "",
      blocks: [],
      sort_order: 0,
    });
    setIsNew(true);
  };

  const save = async () => {
    if (!editing) return;
    const payload = {
      title: editing.title,
      published_date: editing.published_date,
      duration: editing.duration,
      status: editing.status,
      audio_url: editing.audio_url,
      thumbnail_url: editing.thumbnail_url,
      excerpt: editing.excerpt,
      blocks: editing.blocks as any,
      sort_order: editing.sort_order,
    };
    if (isNew) {
      await supabase.from("podcast_episodes").insert(payload);
    } else {
      await supabase.from("podcast_episodes").update(payload).eq("id", editing.id);
    }
    setEditing(null);
    setIsNew(false);
    fetchEpisodes();
  };

  const deleteEpisode = async (id: string) => {
    if (!confirm("Opravdu smazat tuto epizodu?")) return;
    await supabase.from("podcast_episodes").delete().eq("id", id);
    fetchEpisodes();
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbUploading(true);
    const ext = file.name.split(".").pop();
    const path = `podcast/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("lesson-images").getPublicUrl(path);
      setEditing({ ...editing, thumbnail_url: data.publicUrl });
    }
    setThumbUploading(false);
  };

  const hasFilters = filterStatus !== "all" || searchQuery.trim() !== "";

  // === Editor View ===
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}>
            <ArrowLeft className="w-4 h-4 mr-1" />Zpět
          </Button>
          <span className="text-sm text-muted-foreground">{isNew ? "Nová epizoda" : "Úprava epizody"}</span>
        </div>

        <div className="border border-border rounded-lg p-4 bg-card space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Název epizody</Label>
              <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Datum publikace</Label>
              <Input type="date" value={editing.published_date} onChange={(e) => setEditing({ ...editing, published_date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Délka (např. 32 min)</Label>
              <Input value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: e.target.value })} className="mt-1" placeholder="32 min" />
            </div>
            <div>
              <Label>Stav</Label>
              <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Koncept</SelectItem>
                  <SelectItem value="published">Publikováno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Odkaz na audio / embed URL</Label>
              <Input value={editing.audio_url} onChange={(e) => setEditing({ ...editing, audio_url: e.target.value })} className="mt-1" placeholder="https://..." />
            </div>
          </div>

          <div>
            <Label>Thumbnail obrázek</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={editing.thumbnail_url}
                onChange={(e) => setEditing({ ...editing, thumbnail_url: e.target.value })}
                placeholder="URL…"
                className="flex-1"
              />
              <Button size="sm" variant="outline" className="relative" disabled={thumbUploading}>
                <Upload className="w-4 h-4 mr-1" />{thumbUploading ? "…" : "Nahrát"}
                <input type="file" accept="image/*" onChange={handleThumbUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              </Button>
            </div>
            {editing.thumbnail_url && (
              <img src={editing.thumbnail_url} alt="" className="mt-2 max-h-20 rounded border border-border" />
            )}
          </div>

          <div>
            <Label>Perex (krátký popis)</Label>
            <Textarea
              value={editing.excerpt}
              onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
              className="mt-1"
              rows={2}
              placeholder="Krátký popis epizody…"
            />
          </div>

          <div>
            <Label className="mb-2 block">Obsah epizody</Label>
            <BlockEditor
              blocks={editing.blocks}
              onChange={(blocks) => setEditing({ ...editing, blocks })}
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={save}><Save className="w-4 h-4 mr-1" />Uložit</Button>
            <PodcastPreviewDialog episode={editing} />
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setIsNew(false); }}><X className="w-4 h-4 mr-1" />Zrušit</Button>
          </div>
        </div>
      </div>
    );
  }

  // === List View ===
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl">Epizody podcastu</h2>
        <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" />Přidat epizodu</Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div>
          <Label className="text-xs">Stav</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny</SelectItem>
              <SelectItem value="draft">Koncept</SelectItem>
              <SelectItem value="published">Publikováno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Hledat</Label>
          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Název epizody…"
              className="pl-8"
            />
          </div>
        </div>
        {hasFilters && (
          <div className="flex items-end">
            <Button size="sm" variant="ghost" onClick={() => { setFilterStatus("all"); setSearchQuery(""); }}>
              <X className="w-4 h-4 mr-1" />Zrušit filtry
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Načítání…</p>
      ) : episodes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {hasFilters ? "Žádné epizody pro zvolený filtr." : "Zatím žádné epizody."}
        </p>
      ) : (
        <div className="space-y-2">
          {episodes.map((ep) => (
            <div key={ep.id} className="flex items-center gap-3 border border-border rounded-lg p-3 bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{ep.title || "Bez názvu"}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(ep.published_date).toLocaleDateString("cs-CZ")}
                  {ep.duration && ` · ${ep.duration}`}
                </p>
              </div>
              <Badge variant={ep.status === "published" ? "default" : "secondary"} className="text-xs shrink-0">
                {ep.status === "published" ? "Publikováno" : "Koncept"}
              </Badge>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(ep); setIsNew(false); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deleteEpisode(ep.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PodcastManager;
