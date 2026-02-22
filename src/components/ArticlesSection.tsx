import { FileText } from "lucide-react";

const articles = [
  {
    title: "Jak zapojit studenty do výuky gastronomie",
    category: "Didaktika",
    date: "15. 2. 2026",
    excerpt: "Praktické tipy, jak zvýšit motivaci studentů při odborné výuce potravinářských předmětů.",
  },
  {
    title: "Moderní trendy ve světové gastronomii",
    category: "Gastronomie",
    date: "8. 2. 2026",
    excerpt: "Přehled aktuálních směrů v kuchyních po celém světě a jejich vliv na výuku.",
  },
  {
    title: "Výživové mýty ve školním stravování",
    category: "Výživa",
    date: "1. 2. 2026",
    excerpt: "Rozbor nejčastějších mýtů o výživě, které se šíří mezi studenty i pedagogy.",
  },
];

const ArticlesSection = () => {
  return (
    <section id="clanky" className="section-padding bg-gradient-surface">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium uppercase tracking-widest text-primary">Články</span>
        </div>
        <h2 className="font-heading text-3xl md:text-4xl font-semibold mb-12">
          Odborné články
        </h2>

        <div className="space-y-8">
          {articles.map((article, i) => (
            <article
              key={i}
              className="group cursor-pointer border-b border-border pb-8 last:border-0 transition-all duration-200"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider text-primary">{article.category}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{article.date}</span>
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
      </div>
    </section>
  );
};

export default ArticlesSection;