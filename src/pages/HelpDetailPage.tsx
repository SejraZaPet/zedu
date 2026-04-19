import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Block } from "@/lib/textbook-config";

const HelpDetailPage = () => {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const [guide, setGuide] = useState<{ title: string; description: string; blocks: Block[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!guideId) return;
      const { data } = await supabase
        .from("help_guides")
        .select("title, description, blocks")
        .eq("id", guideId)
        .eq("status", "published")
        .single();
      if (data) {
        setGuide({ ...data, blocks: (data.blocks || []) as unknown as Block[] });
      }
      setLoading(false);
    };
    fetch();
  }, [guideId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 pb-16 flex items-center justify-center" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
          <p className="text-muted-foreground">Načítání…</p>
        </main>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 pb-16 flex flex-col items-center justify-center gap-4" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
          <p className="text-muted-foreground">Návod nenalezen.</p>
          <Button variant="outline" onClick={() => navigate("/napoveda")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na nápovědu
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pb-16" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="container mx-auto max-w-3xl px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/napoveda")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na nápovědu
          </Button>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">{guide.title}</h1>
          {guide.description && <p className="text-muted-foreground mb-8">{guide.description}</p>}
          <div className="space-y-6">
            {guide.blocks.filter(b => b.visible !== false).map((block, i) => (
              <LessonBlock key={block.id || i} block={block} blockIndex={i} />
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default HelpDetailPage;
