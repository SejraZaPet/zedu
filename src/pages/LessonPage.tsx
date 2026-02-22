import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Loader2 } from "lucide-react";
import { slugify } from "@/lib/slugify";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import type { Block } from "@/lib/textbook-config";
import LessonLinkButton from "@/components/LessonLinkButton";

const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

const LessonPage = () => {
  const { subjectId, grade, topicSlug, lessonSlug } = useParams<{
    subjectId: string;
    grade: string;
    topicSlug: string;
    lessonSlug: string;
  }>();

  // Find lesson by slug or ID
  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson-by-slug", topicSlug, lessonSlug],
    queryFn: async () => {
      // Try by ID
      const { data: byId } = await supabase
        .from("textbook_lessons")
        .select("*, textbook_topics!inner(id, title, subject, grade)")
        .eq("id", lessonSlug ?? "")
        .eq("status", "published")
        .maybeSingle();
      if (byId) return byId;

      // Fallback: find topic first, then match lesson slug
      const { data: allTopics } = await supabase
        .from("textbook_topics")
        .select("id, title, subject, grade")
        .eq("subject", subjectId ?? "")
        .eq("grade", Number(grade));

      const topic = allTopics?.find(
        (t) => slugify(t.title) === topicSlug || t.id === topicSlug
      );
      if (!topic) return null;

      const { data: lessons } = await supabase
        .from("textbook_lessons")
        .select("*, textbook_topics!inner(id, title, subject, grade)")
        .eq("topic_id", topic.id)
        .eq("status", "published");

      return lessons?.find((l) => slugify(l.title) === lessonSlug) ?? null;
    },
    enabled: !!lessonSlug,
  });

  const blocks: Block[] = (lesson?.blocks as unknown as Block[]) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pt-24 md:pt-28 pb-16 md:pb-24">
        <div className="container mx-auto max-w-3xl px-4">
          <Link
            to={`/ucebnice/${subjectId}/${grade}/${topicSlug}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Zpět na téma
          </Link>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Načítám lekci…</span>
            </div>
          ) : !lesson ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">Lekce zatím není dostupná.</p>
              <Link to={`/ucebnice/${subjectId}/${grade}/${topicSlug}`} className="text-primary hover:underline">
                ← Zpět na téma
              </Link>
            </div>
          ) : (
            <article>
              {lesson.hero_image_url && (
                <img
                  src={lesson.hero_image_url}
                  alt={lesson.title}
                  className="w-full rounded-lg mb-8 object-cover max-h-80"
                />
              )}
              <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
                {lesson.title}
              </h1>

              <div className="space-y-6">
                {blocks.filter((b) => b.visible !== false).map((block) => (
                  <LessonBlock key={block.id} block={block} />
                ))}
              </div>

              {blocks.length === 0 && (
                <p className="text-muted-foreground">Obsah lekce se připravuje.</p>
              )}
            </article>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

const LessonBlock = ({ block }: { block: Block }) => {
  const p = block.props;

  switch (block.type) {
    case "heading": {
      const Tag = `h${p.level || 2}` as keyof JSX.IntrinsicElements;
      return <Tag className="font-heading text-2xl md:text-3xl font-semibold text-foreground">{p.text}</Tag>;
    }
    case "paragraph":
      return <p className="text-foreground leading-relaxed whitespace-pre-wrap">{p.text}</p>;
    case "bullet_list":
      return (
        <ul className="list-disc list-inside space-y-1 text-foreground">
          {(p.items as string[])?.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "image":
      return (
        <figure className={`${p.alignment === "center" ? "text-center" : ""}`}>
          <img
            src={p.url}
            alt={p.caption || ""}
            className={`rounded-lg ${p.width === "full" ? "w-full" : p.width === "half" ? "w-1/2 inline-block" : "w-1/3 inline-block"}`}
          />
          {p.caption && <figcaption className="text-sm text-muted-foreground mt-2">{p.caption}</figcaption>}
        </figure>
      );
    case "image_text":
      return (
        <div className={`flex flex-col md:flex-row gap-6 ${p.imagePosition === "right" ? "md:flex-row-reverse" : ""}`}>
          <div className="md:w-1/2">
            <img src={p.imageUrl} alt="" className="rounded-lg w-full object-cover" />
          </div>
          <div className="md:w-1/2 text-foreground leading-relaxed whitespace-pre-wrap">{p.text}</div>
        </div>
      );
    case "card_grid":
      return (
        <div className={`grid gap-4 ${(p.columns || 2) === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
          {(p.cards as { title: string; text: string }[])?.map((card, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-heading text-lg font-semibold mb-2 text-card-foreground">{card.title}</h4>
              <p className="text-sm text-muted-foreground">{card.text}</p>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {(p.headers as string[])?.map((h, i) => (
                  <th key={i} className="border border-border bg-muted px-4 py-2 text-left text-sm font-semibold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(p.rows as string[][])?.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-border px-4 py-2 text-sm text-foreground">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "accordion":
      return (
        <div className="space-y-2">
          {(p.items as { title: string; content: string }[])?.map((item, i) => (
            <details key={i} className="border border-border rounded-lg">
              <summary className="px-4 py-3 cursor-pointer font-medium text-foreground hover:text-primary">
                {item.title}
              </summary>
              <div className="px-4 pb-3 text-sm text-muted-foreground">{item.content}</div>
            </details>
          ))}
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary pl-4 py-2 italic text-foreground">
          <p>{p.text}</p>
          {p.author && <cite className="text-sm text-muted-foreground not-italic">— {p.author}</cite>}
        </blockquote>
      );
    case "lesson_link":
      return <LessonLinkButton lessonId={p.lessonId} buttonText={p.buttonText} />;
    case "youtube": {
      const ytId = extractYouTubeId(p.url || "");
      if (!ytId) return null;
      const widthClass = p.width === "half" ? "max-w-sm" : p.width === "three_quarter" ? "max-w-2xl" : "w-full";
      return (
        <figure className={`mx-auto ${widthClass}`}>
          <div className="aspect-video w-full rounded-lg overflow-hidden">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${ytId}`}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              title={p.caption || "YouTube video"}
            />
          </div>
          {p.caption && <figcaption className="text-sm text-muted-foreground mt-2 text-center">{p.caption}</figcaption>}
        </figure>
      );
    }
    default:
      return null;
  }
};

export default LessonPage;
