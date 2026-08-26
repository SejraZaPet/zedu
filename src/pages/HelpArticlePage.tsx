import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import MarkdownContent from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface Article {
  title: string;
  category: string;
  content: string;
  cover_image_url: string | null;
  is_published: boolean;
}

const HelpArticlePage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from("help_articles")
        .select("title, category, content, cover_image_url, is_published")
        .eq("slug", slug)
        .maybeSingle();
      setArticle(data as Article | null);
      setLoading(false);
    };
    load();
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pb-16" style={{ paddingTop: "calc(70px + 1.5rem)" }}>
        <div className="container mx-auto max-w-3xl px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/napoveda")} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na nápovědu
          </Button>

          {loading ? (
            <p className="text-muted-foreground">Načítání…</p>
          ) : !article ? (
            <p className="text-muted-foreground">Článek nenalezen.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{article.category}</Badge>
                {!article.is_published && <Badge variant="secondary">Koncept</Badge>}
              </div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-6">{article.title}</h1>
              {article.cover_image_url && (
                <img
                  src={article.cover_image_url}
                  alt={article.title}
                  className="rounded-lg w-full border border-border shadow-sm mb-6"
                />
              )}
              {article.content?.trim() ? (
                <MarkdownContent content={article.content} />
              ) : (
                <p className="text-muted-foreground">Obsah tohoto průvodce se právě připravuje.</p>
              )}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default HelpArticlePage;
