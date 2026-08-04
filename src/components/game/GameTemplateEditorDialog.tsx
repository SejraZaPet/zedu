import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AddSlideSheet } from "@/components/game/AddSlideSheet";
import { GAME_PURPOSES, type GameTemplate } from "@/lib/game-templates";
import { GAME_MODES } from "@/lib/game-modes";
import { useTeacherSubjects } from "@/hooks/useTeacherSubjects";

const NONE = "__none__";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: GameTemplate | null;
  onSaved: () => void;
}

export const GameTemplateEditorDialog = ({ open, onOpenChange, template, onSaved }: Props) => {
  const { subjects } = useTeacherSubjects();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState<string>(NONE);
  const [mode, setMode] = useState("standard");
  const [teamMode, setTeamMode] = useState("none");
  const [slides, setSlides] = useState<any[]>([]);
  const [subject, setSubject] = useState<string>(NONE);
  const [topicId, setTopicId] = useState<string>(NONE);
  const [lessonId, setLessonId] = useState<string>(NONE);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [topics, setTopics] = useState<{ id: string; title: string }[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title ?? "");
    setDescription(template?.description ?? "");
    setPurpose(template?.purpose ?? NONE);
    setMode(template?.default_game_mode ?? "standard");
    setTeamMode(template?.default_team_mode ?? "none");
    setSlides(Array.isArray(template?.activity_data) ? template!.activity_data : []);
    setSubject(template?.subject ?? NONE);
    setTopicId(template?.curriculum_topic_id ?? NONE);
    setLessonId(template?.textbook_lesson_id ?? NONE);
  }, [open, template]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: topicRows }, { data: lessonRows }] = await Promise.all([
        supabase.from("curriculum_topics").select("id, title").order("sort_order"),
        supabase.from("teacher_textbook_lessons").select("id, title").order("sort_order"),
      ]);
      setTopics(((topicRows as any[]) || []).map((t) => ({ id: t.id, title: t.title })));
      setLessons(((lessonRows as any[]) || []).map((l) => ({ id: l.id, title: l.title })));
    })();
  }, [open]);

  const save = async () => {
    if (!title.trim()) {
      toast.error("Doplňte název hry.");
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Nejste přihlášeni.");
      const payload = {
        teacher_id: session.user.id,
        title: title.trim(),
        description: description.trim() || null,
        purpose: purpose === NONE ? null : purpose,
        activity_data: slides as any,
        default_game_mode: mode,
        default_team_mode: teamMode,
        subject: subject === NONE ? null : subject,
        curriculum_topic_id: topicId === NONE ? null : topicId,
        textbook_lesson_id: lessonId === NONE ? null : lessonId,
      };
      if (template) {
        const { error } = await supabase
          .from("teacher_game_templates" as any)
          .update(payload as any)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("teacher_game_templates" as any)
          .insert(payload as any);
        if (error) throw error;
      }
      toast.success("Hra uložena.");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Nepodařilo se uložit hru.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{template ? "Upravit hru" : "Nová hra"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-title">Název</Label>
              <Input
                id="tpl-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Např. Opakovací kvíz – zlomky"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Popis</Label>
              <Textarea
                id="tpl-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Volitelný popis, kdy hru použít"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Účel</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Neurčeno</SelectItem>
                  {GAME_PURPOSES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.emoji} {p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Výchozí herní režim</Label>
              <div className="grid grid-cols-2 gap-2">
                {GAME_MODES.map((m) => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={cn(
                        "text-left rounded-lg border p-2.5 transition",
                        active
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="text-sm font-semibold">{m.emoji} {m.name}</div>
                      <div className="text-[11px] text-muted-foreground">{m.scoringHint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Výchozí týmy</Label>
              <Select value={teamMode} onValueChange={setTeamMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez týmů</SelectItem>
                  <SelectItem value="random">Náhodné týmy</SelectItem>
                  <SelectItem value="manual">Ruční týmy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Content builder */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <Label>Obsah hry ({slides.length})</Label>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddOpen(true)}>
                  <Plus className="w-3.5 h-3.5" /> Přidat obsah
                </Button>
              </div>
              {slides.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Zatím žádný obsah. Přidejte kvíz, zeď, slovní mrak, anketu, diferencovanou
                  aktivitu nebo únikovou hru.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {slides.map((s, i) => (
                    <div key={s.slideId || i} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.projector?.headline || "Bez nadpisu"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.activitySpec?.activityType || s.type || "slide"}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setSlides(slides.filter((_, j) => j !== i))}
                        aria-label="Odebrat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Optional assignment */}
            <Collapsible className="border border-border rounded-lg">
              <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
                <span className="flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Přiřadit (volitelné)
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 border-t border-border space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Předmět</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger><SelectValue placeholder="Nepřiřazeno" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nepřiřazeno</SelectItem>
                        {subjects.map((s) => (
                          <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Téma ŠVP</Label>
                    <Select value={topicId} onValueChange={setTopicId}>
                      <SelectTrigger><SelectValue placeholder="Nepřiřazeno" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nepřiřazeno</SelectItem>
                        {topics.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Konkrétní lekce</Label>
                    <Select value={lessonId} onValueChange={setLessonId}>
                      <SelectTrigger><SelectValue placeholder="Nepřiřazeno" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nepřiřazeno</SelectItem>
                        {lessons.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Zrušit</Button>
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Uložit hru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddSlideSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        slides={slides}
        onAddSlides={(added) => setSlides((prev) => [...prev, ...added])}
      />
    </>
  );
};

export default GameTemplateEditorDialog;
