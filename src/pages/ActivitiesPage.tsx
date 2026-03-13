import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import {
  CheckCircle2,
  ToggleLeft,
  Link2,
  ListOrdered,
  PenLine,
  MessageSquare,
  Image,
  Layers,
  Table2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const categories = [
  { id: "all", label: "Všechny aktivity" },
  { id: "quiz", label: "Kvízy" },
  { id: "practice", label: "Procvičování" },
  { id: "text", label: "Textové aktivity" },
  { id: "visual", label: "Vizuální aktivity" },
];

const activities = [
  {
    id: "quiz",
    title: "Kvíz s výběrem odpovědi",
    description: "Student vybírá správnou odpověď z více možností.",
    icon: CheckCircle2,
    category: "quiz",
    preview: "quiz",
  },
  {
    id: "truefalse",
    title: "Pravda / Nepravda",
    description: "Rychlá aktivita na ověření porozumění.",
    icon: ToggleLeft,
    category: "quiz",
    preview: "truefalse",
  },
  {
    id: "matching",
    title: "Spojování dvojic",
    description: "Propojení pojmů a odpovědí.",
    icon: Link2,
    category: "practice",
    preview: "matching",
  },
  {
    id: "ordering",
    title: "Seřazení kroků",
    description: "Student skládá správné pořadí postupu.",
    icon: ListOrdered,
    category: "practice",
    preview: "ordering",
  },
  {
    id: "fillblanks",
    title: "Doplňovačka",
    description: "Doplňování chybějících slov do textu.",
    icon: PenLine,
    category: "text",
    preview: "fillblanks",
  },
  {
    id: "open",
    title: "Otevřená odpověď",
    description: "Student napíše vlastní odpověď.",
    icon: MessageSquare,
    category: "text",
    preview: "open",
  },
  {
    id: "imagelabel",
    title: "Obrázek s popisem",
    description: "Aktivita založená na práci s obrázkem.",
    icon: Image,
    category: "visual",
    preview: "imagelabel",
  },
  {
    id: "flashcards",
    title: "Flashcards",
    description: "Kartičky pro procvičování pojmů.",
    icon: Layers,
    category: "practice",
    preview: "flashcards",
  },
  {
    id: "table",
    title: "Interaktivní tabulka",
    description: "Aktivita s doplňováním dat do tabulky.",
    icon: Table2,
    category: "visual",
    preview: "table",
  },
  {
    id: "summary",
    title: "Shrnutí lekce",
    description: "Krátké zopakování hlavních poznatků.",
    icon: FileText,
    category: "text",
    preview: "summary",
  },
];

/* ── Mini preview components ─────────────────────────────── */

const PreviewQuiz = () => (
  <div className="space-y-1.5">
    {["Odpověď A", "Odpověď B", "Odpověď C"].map((t, i) => (
      <div
        key={i}
        className={cn(
          "rounded-md px-2.5 py-1 text-[10px] font-medium border",
          i === 1
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border bg-muted/40 text-muted-foreground"
        )}
      >
        {t}
      </div>
    ))}
  </div>
);

const PreviewTrueFalse = () => (
  <div className="flex gap-2">
    <div className="flex-1 rounded-md py-1.5 text-[10px] font-semibold text-center border border-green-500/40 bg-green-500/10 text-green-600">
      Pravda
    </div>
    <div className="flex-1 rounded-md py-1.5 text-[10px] font-semibold text-center border border-red-500/40 bg-red-500/10 text-red-500">
      Nepravda
    </div>
  </div>
);

const PreviewMatching = () => (
  <div className="flex gap-3 items-center">
    <div className="space-y-1">
      {["Pojem A", "Pojem B"].map((t, i) => (
        <div key={i} className="rounded px-2 py-0.5 text-[9px] font-medium bg-primary/10 text-primary border border-primary/20">
          {t}
        </div>
      ))}
    </div>
    <div className="flex flex-col items-center gap-2 text-muted-foreground">
      <span className="text-[10px]">⟷</span>
      <span className="text-[10px]">⟷</span>
    </div>
    <div className="space-y-1">
      {["Definice 1", "Definice 2"].map((t, i) => (
        <div key={i} className="rounded px-2 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground border border-border">
          {t}
        </div>
      ))}
    </div>
  </div>
);

const PreviewOrdering = () => (
  <div className="space-y-1">
    {["1. Krok první", "2. Krok druhý", "3. Krok třetí"].map((t, i) => (
      <div key={i} className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[9px] font-medium bg-muted/50 text-muted-foreground border border-border">
        <span className="text-primary font-bold">{i + 1}</span> {t.slice(3)}
      </div>
    ))}
  </div>
);

const PreviewFillBlanks = () => (
  <p className="text-[10px] text-muted-foreground leading-relaxed">
    Hlavní město ČR je{" "}
    <span className="inline-block border-b-2 border-primary/50 px-2 text-primary font-medium">______</span>{" "}
    a leží na řece Vltavě.
  </p>
);

const PreviewOpen = () => (
  <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-[10px] text-muted-foreground italic">
    Napište svou odpověď…
  </div>
);

const PreviewImageLabel = () => (
  <div className="relative rounded-md bg-muted/40 border border-border h-12 flex items-center justify-center">
    <Image className="w-4 h-4 text-muted-foreground/50" />
    <div className="absolute top-1 right-1 rounded bg-primary/15 text-primary text-[8px] px-1 font-medium">
      A
    </div>
    <div className="absolute bottom-1 left-1 rounded bg-primary/15 text-primary text-[8px] px-1 font-medium">
      B
    </div>
  </div>
);

const PreviewFlashcards = () => (
  <div className="flex gap-1.5">
    {["Pojem", "?"].map((t, i) => (
      <div
        key={i}
        className={cn(
          "flex-1 rounded-md border py-2 text-center text-[9px] font-medium",
          i === 0
            ? "border-primary/30 bg-primary/5 text-primary"
            : "border-border bg-muted/40 text-muted-foreground"
        )}
      >
        {t}
      </div>
    ))}
  </div>
);

const PreviewTable = () => (
  <div className="border border-border rounded-md overflow-hidden text-[9px]">
    <div className="grid grid-cols-3 bg-muted/60 text-muted-foreground font-semibold">
      <div className="px-1.5 py-0.5 border-r border-border">Název</div>
      <div className="px-1.5 py-0.5 border-r border-border">Rok</div>
      <div className="px-1.5 py-0.5">Hodnota</div>
    </div>
    <div className="grid grid-cols-3 text-muted-foreground">
      <div className="px-1.5 py-0.5 border-r border-t border-border">—</div>
      <div className="px-1.5 py-0.5 border-r border-t border-border">—</div>
      <div className="px-1.5 py-0.5 border-t border-border">—</div>
    </div>
  </div>
);

const PreviewSummary = () => (
  <div className="space-y-1">
    <div className="h-1.5 rounded-full bg-primary/20 w-full" />
    <div className="h-1.5 rounded-full bg-primary/15 w-4/5" />
    <div className="h-1.5 rounded-full bg-primary/10 w-3/5" />
  </div>
);

const previewMap: Record<string, React.FC> = {
  quiz: PreviewQuiz,
  truefalse: PreviewTrueFalse,
  matching: PreviewMatching,
  ordering: PreviewOrdering,
  fillblanks: PreviewFillBlanks,
  open: PreviewOpen,
  imagelabel: PreviewImageLabel,
  flashcards: PreviewFlashcards,
  table: PreviewTable,
  summary: PreviewSummary,
};

const ActivitiesPage = () => {
  const [activeCategory, setActiveCategory] = useState("all");
  const navigate = useNavigate();

  const filtered =
    activeCategory === "all"
      ? activities
      : activities.filter((a) => a.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pt-[90px] pb-16">
        {/* Header */}
        <div className="container mx-auto px-4 md:px-8 text-center mb-10">
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-foreground mb-3">
            Interaktivní aktivity
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Vyberte si typ aktivity, který chcete do lekce přidat.
          </p>
        </div>

        {/* Filters */}
        <div className="container mx-auto px-4 md:px-8 mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border",
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filtered.map((activity) => {
              const Icon = activity.icon;
              const Preview = previewMap[activity.preview];
              return (
                <div
                  key={activity.id}
                  className="group bg-card border border-border rounded-2xl p-5 flex flex-col transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1"
                >
                  {/* Icon + title */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #6EC6D9, #9B6CFF)",
                      }}
                    >
                      <Icon size={20} className="text-white" />
                    </div>
                    <h3 className="font-heading text-sm font-semibold text-foreground leading-tight">
                      {activity.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {activity.description}
                  </p>

                  {/* Preview */}
                  <div className="rounded-xl border border-border bg-muted/20 p-3 mb-4 flex-1">
                    {Preview && <Preview />}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => {
                      /* navigate to editor – placeholder for now */
                    }}
                    className="w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200 border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    Použít aktivitu
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default ActivitiesPage;
