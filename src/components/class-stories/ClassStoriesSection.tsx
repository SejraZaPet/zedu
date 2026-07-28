import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { Image as ImageIcon, Send, Trash2, X, MessageSquareText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Story {
  id: string;
  class_id: string;
  teacher_id: string;
  text: string;
  image_url: string | null;
  created_at: string;
}

const BUCKET = "lesson-images";

export default function ClassStoriesSection({
  classId,
  teacherId,
}: {
  classId: string;
  teacherId: string;
}) {
  const { toast } = useToast();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("class_stories" as any)
      .select("id, class_id, teacher_id, text, image_url, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(30);
    setStories(((data as any) ?? []) as Story[]);
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: "Obrázek je příliš velký", description: "Max. 8 MB.", variant: "destructive" });
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!file) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `class-stories/${classId}/${teacherId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!text.trim() && !file) {
      toast({ title: "Prázdný příspěvek", description: "Napište text nebo přidejte fotku.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const image_url = await uploadImage();
      const { error } = await supabase.from("class_stories" as any).insert({
        class_id: classId,
        teacher_id: teacherId,
        text: text.trim(),
        image_url,
      });
      if (error) throw error;
      toast({ title: "Příspěvek přidán", description: "Rodiče dostanou upozornění." });
      setText("");
      clearFile();
      await load();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message ?? "Nepodařilo se přidat příspěvek.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("class_stories" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setStories((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Smazáno" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareText className="h-5 w-5" />
          Denní příspěvek
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <Textarea
            placeholder="Co jste dnes dělali? Krátký update pro rodiče…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          {previewUrl && (
            <div className="relative inline-block">
              <img src={previewUrl} alt="" className="max-h-40 rounded-md" />
              <button
                type="button"
                onClick={clearFile}
                className="absolute -right-2 -top-2 rounded-full bg-background border border-border p-1 shadow-sm"
                aria-label="Odstranit obrázek"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePickFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <ImageIcon className="mr-1.5 h-4 w-4" />
              {file ? "Změnit fotku" : "Přidat fotku"}
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} size="sm">
              <Send className="mr-1.5 h-4 w-4" />
              {submitting ? "Odesílám…" : "Přidat"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Načítám…</p>
          ) : stories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím žádné příspěvky.</p>
          ) : (
            stories.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: cs })}
                  </span>
                  {s.teacher_id === teacherId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Smazat příspěvek?</AlertDialogTitle>
                          <AlertDialogDescription>Tuto akci nelze vrátit zpět.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Zrušit</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)}>Smazat</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                {s.text && <p className="mt-1 whitespace-pre-line text-sm">{s.text}</p>}
                {s.image_url && (
                  <img src={s.image_url} alt="" className="mt-2 max-h-64 rounded-md" loading="lazy" />
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
