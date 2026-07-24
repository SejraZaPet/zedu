import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, FileText, LayoutTemplate, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  listSharedWithMe,
  acceptShare,
  type SharedWithMeItem,
} from "@/lib/content-shares";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";

export default function SharedWithMe() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<SharedWithMeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/prihlaseni");
          return;
        }
        const rows = await listSharedWithMe(session.user.id);
        setItems(rows);
      } catch (e: any) {
        toast({
          title: "Načtení selhalo",
          description: e.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, toast]);

  async function handleAdd(item: SharedWithMeItem) {
    setAddingId(item.id);
    try {
      const { kind } = await acceptShare(item);
      toast({ title: "Přidáno do vašich materiálů" });
      if (kind === "textbook") navigate("/ucitel/ucebnice");
      else if (kind === "worksheet") navigate("/ucitel/pracovni-listy");
      else navigate("/ucitel/plany-hodin");
    } catch (e: any) {
      toast({
        title: "Přidání selhalo",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />
      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Sdíleno se mnou</h1>
          <p className="text-sm text-muted-foreground">
            Obsah, který s vámi sdíleli konkrétní kolegové. Přidáním vznikne vaše vlastní editovatelná kopie.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Nikdo s vámi zatím nic přímo nesdílel.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((i) => {
              const Icon =
                i.kind === "textbook"
                  ? BookOpen
                  : i.kind === "worksheet"
                  ? FileText
                  : LayoutTemplate;
              return (
                <div
                  key={i.id}
                  className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {i.kind === "textbook"
                        ? "Učebnice"
                        : i.kind === "worksheet"
                        ? "Pracovní list"
                        : "Prezentace"}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm line-clamp-2">
                    {i.target_title ?? "Bez názvu"}
                  </h3>
                  <div className="text-xs text-muted-foreground">
                    Od: {i.sharer_name ?? "—"} ·{" "}
                    {formatDistanceToNow(new Date(i.created_at), {
                      addSuffix: true,
                      locale: cs,
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {i.kind === "textbook" && i.includes_worksheets && (
                      <Badge variant="outline" className="text-[10px]">
                        + pracovní listy
                      </Badge>
                    )}
                    {i.kind === "textbook" && i.includes_presentations && (
                      <Badge variant="outline" className="text-[10px]">
                        + prezentace
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="mt-auto"
                    onClick={() => handleAdd(i)}
                    disabled={addingId === i.id}
                  >
                    {addingId === i.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Přidat do mých materiálů
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
