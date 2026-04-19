import type { Block } from "@/lib/textbook-config";
import LessonLinkButton from "@/components/LessonLinkButton";
import DOMPurify from "dompurify";
import FlashcardsActivity from "@/components/activities/FlashcardsActivity";
import QuizActivity from "@/components/activities/QuizActivity";
import MatchingActivity from "@/components/activities/MatchingActivity";
import SortingActivity from "@/components/activities/SortingActivity";
import OrderingActivity from "@/components/activities/OrderingActivity";
import ImageHotspotActivity from "@/components/activities/ImageHotspotActivity";
import ImageLabelActivity from "@/components/activities/ImageLabelActivity";
import FillBlanksActivity from "@/components/activities/FillBlanksActivity";
import FillChoiceActivity from "@/components/activities/FillChoiceActivity";
import TrueFalseActivity from "@/components/activities/TrueFalseActivity";
import RevealCardsActivity from "@/components/activities/RevealCardsActivity";
import MemoryGameActivity from "@/components/activities/MemoryGameActivity";
import CrosswordActivity from "@/components/activities/CrosswordActivity";
import { LiveGameButton } from "@/components/game/LiveGameButton";
import type { GameQuestion } from "@/lib/game-types";
const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

const SafeHTML = ({ html, className }: { html: string; className?: string }) => (
  <div
    className={className}
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
  />
);

const CALLOUT_STYLES: Record<string, { icon: string; border: string; bg: string }> = {
  note: { icon: "📝", border: "border-muted-foreground/40", bg: "bg-muted/40" },
  warning: { icon: "⚠️", border: "border-destructive/40", bg: "bg-destructive/10" },
  tip: { icon: "💡", border: "border-primary/40", bg: "bg-primary/10" },
  remember: { icon: "🧠", border: "border-primary/40", bg: "bg-primary/10" },
};

export const LessonBlock = ({ block, blockIndex, onActivityComplete, isTeacher }: { 
  block: Block; 
  blockIndex?: number;
  onActivityComplete?: (activityIndex: number, activityType: string, score: number, maxScore: number) => void;
  isTeacher?: boolean;
}) => {
  const p = block.props;

  switch (block.type) {
    case "heading": {
      const Tag = `h${p.level || 2}` as keyof JSX.IntrinsicElements;
      const sizeClass = p.level === 1 ? "text-3xl md:text-4xl" : p.level === 3 ? "text-xl md:text-2xl" : p.level === 4 ? "text-lg md:text-xl" : "text-2xl md:text-3xl";
      // Support rich HTML text
      const isHtml = typeof p.text === "string" && p.text.includes("<");
      return isHtml
        ? <Tag className={`font-heading ${sizeClass} font-semibold text-foreground [&_*]:font-heading`}><SafeHTML html={p.text} className="inline" /></Tag>
        : <Tag className={`font-heading ${sizeClass} font-semibold text-foreground`}>{p.text}</Tag>;
    }
    case "paragraph":
      return (
        <SafeHTML
          html={p.text || ""}
          className="text-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_mark]:bg-primary/30 [&_mark]:text-foreground [&_p]:mb-2"
        />
      );
    case "bullet_list": {
      // Support rich HTML content (new) or legacy string[] items
      if (p.html) {
        return (
          <SafeHTML
            html={p.html}
            className="text-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_mark]:bg-primary/30 [&_mark]:text-foreground"
          />
        );
      }
      return (
        <ul className="list-disc list-inside space-y-1 text-foreground">
          {(p.items as string[])?.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    }
    case "image":
      return (
        <figure className={`${p.alignment === "center" ? "text-center" : p.alignment === "right" ? "text-right" : ""}`}>
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
          {(p.cards as { title: string; text: string; mode?: string; items?: string[] }[])?.map((card, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5">
              <h4 className="font-heading text-lg font-semibold mb-2 text-card-foreground">{card.title}</h4>
              {card.mode === "bullets" && card.items ? (
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {card.items.filter(Boolean).map((item, ii) => (
                    <li key={ii}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{card.text}</p>
              )}
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
    case "callout": {
      const ct = CALLOUT_STYLES[p.calloutType] || CALLOUT_STYLES.note;
      return (
        <div className={`rounded-lg border-l-4 ${ct.border} ${ct.bg} p-4 flex gap-3`}>
          <span className="text-xl flex-shrink-0">{ct.icon}</span>
          <SafeHTML
            html={p.text || ""}
            className="text-foreground text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1 [&_mark]:bg-primary/30"
          />
        </div>
      );
    }
    case "divider": {
      if (p.style === "dots") {
        return <div className="text-center py-4 text-muted-foreground tracking-[1em]">• • •</div>;
      }
      if (p.style === "space") {
        return <div className="py-8" />;
      }
      return <hr className="border-border my-2" />;
    }
    case "two_column":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SafeHTML
            html={p.left || ""}
            className="text-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:uppercase [&_h3]:font-heading [&_h3]:text-lg [&_h3]:uppercase [&_mark]:bg-primary/30 [&_p]:mb-2"
          />
          <SafeHTML
            html={p.right || ""}
            className="text-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:font-heading [&_h2]:text-xl [&_h2]:uppercase [&_h3]:font-heading [&_h3]:text-lg [&_h3]:uppercase [&_mark]:bg-primary/30 [&_p]:mb-2"
          />
        </div>
      );
    case "gallery": {
      const cols = p.columns || 3;
      const colClass = cols === 2 ? "grid-cols-2" : cols === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3";
      return (
        <div className={`grid gap-3 ${colClass}`}>
          {(p.images as { url: string; caption: string }[])?.filter(img => img.url).map((img, i) => (
            <figure key={i} className="text-center">
              <img src={img.url} alt={img.caption || ""} className="rounded-lg w-full object-cover aspect-square" />
              {img.caption && <figcaption className="text-xs text-muted-foreground mt-1">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      );
    }
    case "summary":
      return (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
          <h3 className="font-heading text-xl text-primary mb-3 uppercase tracking-wide">
            {p.title || "Shrnutí lekce"}
          </h3>
          <SafeHTML
            html={p.text || ""}
            className="text-foreground text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_mark]:bg-primary/30 [&_p]:mb-2"
          />
        </div>
      );
    case "activity": {
      const at = p.activityType || "flashcards";
      const handleComplete = (score: number, maxScore: number) => {
        if (onActivityComplete && blockIndex !== undefined) {
          onActivityComplete(blockIndex, at, score, maxScore);
        }
      };

      // Build game questions for live game support
      const supportsLiveGame = ["quiz", "true_false", "fill_choice", "matching"].includes(at);
      let gameQuestions: GameQuestion[] = [];
      if (supportsLiveGame) {
        if (at === "quiz" && p.quiz) {
          gameQuestions = [{
            question: p.quiz.question,
            answers: p.quiz.answers,
            type: "quiz",
            explanation: p.quiz.explanation,
          }];
        } else if (at === "true_false" && p.trueFalse?.statements) {
          gameQuestions = p.trueFalse.statements.map((s: any) => ({
            question: s.statement,
            answers: [
              { text: "Pravda", correct: s.correct === true },
              { text: "Nepravda", correct: s.correct === false },
            ],
            type: "true_false" as const,
          }));
        } else if (at === "fill_choice" && p.fillChoice) {
          gameQuestions = [{
            question: "Doplňte správné odpovědi",
            answers: (p.fillChoice.options || []).map((o: any, i: number) => ({
              text: o, correct: i === 0,
            })),
            type: "fill_choice" as const,
          }];
        }
      }

      const activityInner = (
        <div className="rounded-lg border border-primary/20 bg-card p-5 space-y-3">
          {p.title && <h3 className="font-heading text-lg text-primary uppercase tracking-wide">{p.title}</h3>}
          {p.instructions && (
            <p className="text-sm text-muted-foreground leading-relaxed bg-muted/30 rounded-md px-4 py-2.5">
              {p.instructions}
            </p>
          )}
          {at === "flashcards" && <FlashcardsActivity cards={p.flashcards || []} />}
          {at === "quiz" && <QuizActivity quiz={p.quiz} onComplete={handleComplete} />}
          {at === "matching" && <MatchingActivity matching={p.matching} onComplete={handleComplete} />}
          {at === "sorting" && <SortingActivity sorting={p.sorting} onComplete={handleComplete} />}
          {at === "ordering" && p.ordering && <OrderingActivity ordering={p.ordering} onComplete={handleComplete} />}
          {at === "image_label" && p.imageLabel && (
            <ImageLabelActivity
              imageUrl={p.imageLabel.imageUrl}
              markers={p.imageLabel.markers || []}
              tolerance={p.imageLabel.tolerance}
              shuffleWords={p.imageLabel.shuffleWords}
            />
          )}
          {at === "image_hotspot" && p.imageHotspot && (
            <ImageHotspotActivity
              imageUrl={p.imageHotspot.imageUrl}
              hotspots={p.imageHotspot.hotspots || []}
            />
          )}
          {at === "fill_blanks" && p.fillBlanks && (
            <FillBlanksActivity
              text={p.fillBlanks.text || ""}
              tokens={p.fillBlanks.tokens}
              caseSensitive={p.fillBlanks.caseSensitive}
              diacriticSensitive={p.fillBlanks.diacriticSensitive}
              onComplete={handleComplete}
            />
          )}
          {at === "fill_choice" && p.fillChoice && (
            <FillChoiceActivity
              tokens={p.fillChoice.tokens || []}
              options={p.fillChoice.options || []}
              onComplete={handleComplete}
            />
          )}
          {at === "true_false" && p.trueFalse && (
            <TrueFalseActivity statements={p.trueFalse.statements || []} onComplete={handleComplete} />
          )}
          {at === "reveal_cards" && p.revealCards && (
            <RevealCardsActivity cards={p.revealCards.cards || []} />
          )}
          {at === "memory_game" && p.memoryGame && (
            <MemoryGameActivity pairs={p.memoryGame.pairs || []} />
          )}
          {at === "crossword" && p.crossword && (
            <CrosswordActivity entries={p.crossword.entries || []} />
          )}
          {/* Live Game Button for teachers */}
          {isTeacher && supportsLiveGame && gameQuestions.length > 0 && (
            <div className="pt-3 border-t border-border">
              <LiveGameButton title={p.title || "Živá hra"} questions={gameQuestions} />
            </div>
          )}
        </div>
      );

      if (p.required === true) {
        return (
          <div className="relative rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-brand opacity-10 pointer-events-none rounded-xl" />
            <div className="relative border-2 border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-gradient-brand flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <span className="text-xs font-medium text-primary">Povinná aktivita</span>
              </div>
              {activityInner}
            </div>
          </div>
        );
      }

      return activityInner;
    }
    default:
      return null;
  }
};

export default LessonBlock;
