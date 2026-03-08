import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ArticleContent from "@/components/ArticleContent";

interface Article {
  id: string;
  title: string;
  category: string;
  published_date: string;
  excerpt: string;
  content: string;
}

const ArticlesSection = () => {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, title, category, published_date, excerpt, content")
        .eq("status", "published")
        .order("published_date", { ascending: false });
      if (data) setArticles(data);
    };
    fetch();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <section id="ke-kave" className="section-padding bg-gradient-surface">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Coffee className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium uppercase tracking-widest text-primary">Ke kávě</span>
        </div>
        <h2 className="font-heading text-2xl md:text-[32px] font-bold mb-12 text-foreground">
          Ke kávě
        </h2>

        {articles.length === 0 ? (
          <p className="text-muted-foreground text-sm">Zatím žádné články.</p>
        ) : (
          <div className="space-y-8">
            {articles.map((article) => (
              <article
                key={article.id}
                className="group cursor-pointer border-b border-border pb-8 last:border-0 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-primary">{article.category}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">{formatDate(article.published_date)}</span>
                </div>
                <h3 className="font-heading text-xl md:text-2xl font-semibold mb-2 text-card-foreground group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {article.excerpt}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ArticlesSection;
