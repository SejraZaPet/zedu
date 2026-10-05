import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SlideCanvas from "@/components/admin/SlideCanvas";
import { slideWithFallbackBlocks } from "@/lib/slide-canvas-fallback";
import { FilePenLine, Plus, Send, Trash2, ImagePlus, X, Loader2 } from "lucide-react";

/**
 * Koncepty snímků pro běžící živou relaci.
 * Izolované od živého pořadí: ukládají se do `live_session_drafts`, které projektor
 * neodebírá. Teprve RPC `publish_live_draft` je jedním UPDATE zařadí do activity_data.
 */
interface Draft {
  id: string;
  slide: any;
  updated_at: string;
}

interface Props {
  sessionId: string;
  currentIndex: number;
  slidesCount: number;
}

export default function LiveDraftsPanel({ sessionId, currentIndex, slidesCount }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [position, setPosition] = useState<string>("next");
  const [goTo, setGoTo] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("live_session_drafts")
      .select("id, slide, updated_at")
      .eq("session_id", sessionId)
      .order("created_at");
    setDrafts((data as Draft[]) || []);
  }, [sessionId]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { load(); }, [load]);

  const active = drafts.find((d) => d.id === activeId) || null;

  const createDraft = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("live_session_drafts")
      .insert({
        session_id: sessionId,
        teacher_id: u.user.id,
        slide: { type: "explain", projector: { headline: "", body: "" } },
      })
      .select("id, slide, updated_at")
      .single();
    if (error || !data) {
      toast({ title: "Koncept se nepodařilo vytvořit", description: error?.message, variant: "destructive" });
      return;
    }
    setDrafts((ds) => [...ds, data as Draft]);
    setActiveId(data.id);
  };

  const persist = useCallback((id: string, slide: any) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      await supabase
        .from("live_session_drafts")
        .update({ slide, updated_at: new Date().toISOString() })
        .eq("id", id);
      setSaving(false);
    }, 500);
  }, []);

  const updateActive = (patch: (s: any) => any) => {
    if (!active) return;
    const slide = patch(active.slide || {});
    setDrafts((ds) => ds.map((d) => (d.id === active.id ? { ...d, slide } : d)));
    persist(active.id, slide);
  };

  const deleteDraft = async (id: string) => {
    await supabase.from("live_session_drafts").delete().eq("id", id);
    setDrafts((ds) => ds.filter((d) => d.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const uploadImage = async (file: File) => {
    const { data: u } = await supabase.auth.getUser();
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `presentations/${u.user?.id || "unknown"}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("lesson-images").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) {
      toast({ title: "Obrázek se nepodařilo nahrát", description: error.message, variant: "destructive" });
      return;
    }
    const url = supabase.storage.from("lesson-images").getPublicUrl(path).data.publicUrl;
    updateActive((s) => ({ ...s, backgroundOverride: { ...(s.backgroundOverride || {}), image: url } }));
  };

  // Povolená místa: jen za aktuální snímek (nikdy před/mezi odprezentované).
  const firstAllowed = Math.max(0, currentIndex + 1);
  const positions: number[] = [];
  for (let p = firstAllowed; p <= slidesCount; p++) positions.push(p);

  const publish = async () => {
    if (!active) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      await supabase.from("live_session_drafts").update({ slide: active.slide }).eq("id", active.id);
      setSaving(false);
    }
    setPublishing(true);
    const pos = position === "next" ? firstAllowed : Number(position);
    const { data, error } = await (supabase.rpc as any)("publish_live_draft", {
      _draft_id: active.id,
      _position: pos,
      _go_to: goTo,
    });
    setPublishing(false);
    if (error) {
      toast({ title: "Zveřejnění se nezdařilo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: goTo ? "Zveřejněno a zobrazeno" : "Zařazeno do prezentace", description: `Snímek ${Number(data) + 1}` });
    setDrafts((ds) => ds.filter((d) => d.id !== active.id));
    setActiveId(null);
    setPosition("next");
  };

  const headline = active?.slide?.projector?.headline || "";
  const body = active?.slide?.projector?.body || "";
  const image = active?.slide?.backgroundOverride?.image as string | undefined;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 border-dashed">
        <FilePenLine className="w-4 h-4" /> Koncepty
        {drafts.length > 0 && <Badge variant="secondary" className="ml-1">{drafts.length}</Badge>}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Koncepty – připravuji</SheetTitle>
            <SheetDescription>
              Žáci koncepty nevidí. Na projektor se snímek dostane až po kliknutí na „Zveřejnit“.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {drafts.map((d, i) => (
              <div
                key={d.id}
                className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2 ${d.id === activeId ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <button className="flex-1 text-left text-sm truncate" onClick={() => setActiveId(d.id)}>
                  Koncept {i + 1}: {d.slide?.projector?.headline || "Bez nadpisu"}
                </button>
                <Button size="icon" variant="ghost" aria-label="Smazat koncept" onClick={() => deleteDraft(d.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={createDraft} className="w-full gap-1.5">
              <Plus className="w-4 h-4" /> Nový koncept snímku
            </Button>
          </div>

          {active && (
            <div className="mt-6 space-y-4 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="draft-headline">Nadpis</Label>
                <Input
                  id="draft-headline"
                  value={headline}
                  onChange={(e) => updateActive((s) => ({ ...s, projector: { ...(s.projector || {}), headline: e.target.value } }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="draft-body">Text</Label>
                <Textarea
                  id="draft-body"
                  rows={5}
                  value={body}
                  onChange={(e) => updateActive((s) => ({ ...s, projector: { ...(s.projector || {}), body: e.target.value } }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Obrázek (celý snímek)</Label>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" disabled={uploading}>
                    <label className="cursor-pointer gap-1.5">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                      Nahrát obrázek
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
                      />
                    </label>
                  </Button>
                  {image && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateActive((s) => { const { backgroundOverride, ...rest } = s; return rest; })}
                    >
                      <X className="w-4 h-4 mr-1" /> Odebrat
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Náhled (jen pro vás){saving ? " · ukládám…" : ""}</p>
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <SlideCanvas slide={slideWithFallbackBlocks(active.slide)} darkMode />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="space-y-1.5">
                  <Label>Zařadit</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="next">Hned za aktuální snímek (doporučeno)</SelectItem>
                      {positions.slice(1).map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {p === slidesCount ? "Na konec prezentace" : `Před snímek ${p + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="draft-goto" checked={goTo} onCheckedChange={setGoTo} />
                  <Label htmlFor="draft-goto">Zveřejnit a hned na snímek přejít</Label>
                </div>
                <Button onClick={publish} disabled={publishing} className="w-full gap-1.5">
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Zveřejnit
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
