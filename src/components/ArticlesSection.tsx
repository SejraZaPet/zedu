import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Article {
  id: string;
  title: string;
  category: string;
  published_date: string;
  excerpt: string;
}

const ArticlesSection = () => {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, title, category, published_date, excerpt")
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
          <Coffee className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium uppercase tracking-widest text-primary">Ke kávě</span>
        </div>
        <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-12">
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
