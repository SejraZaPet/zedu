import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

interface Story {
  id: string;
  class_id: string;
  text: string;
  image_url: string | null;
  created_at: string;
  className?: string;
}

/**
 * Feed of class stories visible to a parent — combines all classes the linked
 * children belong to, sorted chronologically. Parent-side RLS gates access.
 */
export default function ParentClassStoriesFeed({ studentIds }: { studentIds: string[] }) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (studentIds.length === 0) {
        setStories([]);
        setLoading(false);
        return;
      }
      // Find the classes the children belong to
      const { data: memberships } = await supabase
        .from("class_members")
        .select("class_id")
        .in("user_id", studentIds);
      const classIds = Array.from(new Set((memberships ?? []).map((m: any) => m.class_id)));
      if (classIds.length === 0) {
        setStories([]);
        setLoading(false);
        return;
      }

      const [{ data: rows }, { data: classRows }] = await Promise.all([
        supabase
          .from("class_stories" as any)
          .select("id, class_id, text, image_url, created_at")
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("classes").select("id, name").in("id", classIds),
      ]);

      const nameMap = new Map((classRows ?? []).map((c: any) => [c.id, c.name]));
      const list = (((rows as any) ?? []) as Story[]).map((s) => ({
        ...s,
        className: nameMap.get(s.class_id) as string | undefined,
      }));
      setStories(list);
      setLoading(false);
    })();
  }, [JSON.stringify(studentIds)]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareText className="h-5 w-5" />
          Co se dělo ve třídě
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Načítám…</p>
        ) : stories.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádné příspěvky ze třídy.</p>
        ) : (
          stories.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{s.className ?? "Třída"}</span>
                <span>{formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: cs })}</span>
              </div>
              {s.text && <p className="mt-1 whitespace-pre-line text-sm">{s.text}</p>}
              {s.image_url && (
                <img src={s.image_url} alt="" className="mt-2 max-h-64 rounded-md" loading="lazy" />
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
