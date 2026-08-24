import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, FileText, LayoutTemplate, UserCheck, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  listFollowedCreators,
  unfollowCreator,
  type FollowedCreator,
} from "@/lib/creator-follows";
import type { PublicShareItem, ShareTargetKind } from "@/lib/content-shares";

interface CreatorWithContent {
  creator: FollowedCreator;
  items: PublicShareItem[];
}

async function loadPublicSharesByCreators(creatorIds: string[]): Promise<PublicShareItem[]> {
  if (creatorIds.length === 0) return [];
  const { data, error } = await supabase
    .from("content_shares" as any)
    .select(
      `id, textbook_id, worksheet_id, lesson_plan_id, shared_by, shared_with,
       includes_worksheets, includes_presentations, status, created_at,
       teacher_textbooks:textbook_id ( title, subject ),
       worksheets:worksheet_id ( title, subject ),
       lesson_plans:lesson_plan_id ( title, subject )`,
    )
    .is("shared_with", null)
    .eq("status", "active")
    .in("shared_by", creatorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => {
    const kind: ShareTargetKind = r.textbook_id
      ? "textbook"
      : r.worksheet_id
      ? "worksheet"
      : "lesson_plan";
    const target =
      kind === "textbook"
        ? r.teacher_textbooks
        : kind === "worksheet"
        ? r.worksheets
        : r.lesson_plans;
    return {
      ...r,
      kind,
      target_title: target?.title ?? null,
      target_subject: target?.subject ?? null,
      target_grade_level: null,
      sharer_name: null,
    } as PublicShareItem;
  });
}

export default function FollowedCreators() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CreatorWithContent[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/prihlaseni");
          return;
        }
        const creators = await listFollowedCreators();
        const items = await loadPublicSharesByCreators(creators.map((c) => c.creator_id));
        const byCreator = new Map<string, PublicShareItem[]>();
        for (const it of items) {
          const arr = byCreator.get(it.shared_by) ?? [];
          arr.push(it);
          byCreator.set(it.shared_by, arr);
        }
        setGroups(
          creators.map((c) => ({
            creator: c,
            items: byCreator.get(c.creator_id) ?? [],
          })),
        );
      } catch (e: any) {
        toast({ title: "Načtení selhalo", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, toast]);

  async function handleUnfollow(creatorId: string) {
    try {
      await unfollowCreator(creatorId);
      setGroups((prev) => prev.filter((g) => g.creator.creator_id !== creatorId));
      toast({ title: "Odběr zrušen" });
    } catch (e: any) {
      toast({ title: "Nepodařilo se", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />
      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Sledovaní tvůrci</h1>
            <p className="text-sm text-muted-foreground">
              Autoři, jejichž veřejný obsah v BezliMarketu chcete sledovat.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Zatím nikoho nesledujete. V{" "}
            <button
              onClick={() => navigate("/Bezlimarket")}
              className="text-primary underline"
            >
              BezliMarketu
            </button>{" "}
            klikněte u autora na „Sledovat".
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(({ creator, items }) => (
              <section
                key={creator.creator_id}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <h2 className="font-semibold">{creator.display_name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {items.length === 0
                        ? "Zatím nemá žádný veřejný obsah."
                        : `${items.length} veřejných materiálů`}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUnfollow(creator.creator_id)}
                    className="gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    Zrušit odběr
                  </Button>
                </div>

                {items.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((i) => {
                      const Icon =
                        i.kind === "textbook"
                          ? BookOpen
                          : i.kind === "worksheet"
                          ? FileText
                          : LayoutTemplate;
                      return (
                        <button
                          key={i.id}
                          onClick={() => navigate("/Bezlimarket")}
                          className="text-left bg-background border border-border rounded-lg p-3 hover:border-primary transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-3.5 h-3.5 text-primary" />
                            <Badge variant="outline" className="text-[10px]">
                              {i.kind === "textbook"
                                ? "Učebnice"
                                : i.kind === "worksheet"
                                ? "Pracovní list"
                                : "Prezentace"}
                            </Badge>
                          </div>
                          <div className="text-sm font-medium line-clamp-2">
                            {i.target_title ?? "Bez názvu"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
