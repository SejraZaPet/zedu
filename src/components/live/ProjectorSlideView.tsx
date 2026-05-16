import { BookOpen } from "lucide-react";
import WallProjectorView from "@/components/activities/WallProjectorView";
import { LessonBlock } from "@/components/LessonBlockRenderer";

interface Props {
  sessionId: string;
  session: any;
  currentSlide: any;
  currentIndex: number;
  slides: any[];
  players: any[];
  gameCode: string;
}

/**
 * Shared full-viewport projector slide layout.
 * Used by both LiveProjectorScreen and LiveTeacherScreen (under whiteboard overlay)
 * so that whiteboard strokes align identically in both views.
 */
const ProjectorSlideView = ({ sessionId, session, currentSlide, currentIndex, slides, players, gameCode }: Props) => {
  const progressPct = slides.length > 0 ? ((currentIndex + 1) / slides.length) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col text-white relative" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}>
      <div className="h-2 bg-white/10">
        <div className="h-full bg-purple-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex justify-between items-center px-12 py-6 text-gray-300">
        <span className="text-lg">{session.title}</span>
        <span className="text-lg font-medium">Slide {currentIndex + 1} / {slides.length}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-16 py-8 gap-8">
        {currentSlide.type === "explain" && (
          <div className="mb-2 inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm text-purple-300">
            <BookOpen className="w-4 h-4" /> Výklad
          </div>
        )}

        {currentSlide.blocks && currentSlide.blocks.length > 0 ? (
          <>
            {currentSlide.projector?.headline && (
              <h2 className="text-6xl font-bold text-center mb-10 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                {currentSlide.projector.headline}
              </h2>
            )}
            <div className="w-full max-w-6xl text-2xl space-y-6 [&_*]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_.bg-card]:!bg-white/10 [&_.bg-muted\/40]:!bg-white/10 [&_.bg-muted\/30]:!bg-white/10 [&_.border]:!border-white/20">
              {currentSlide.blocks.map((b: any, i: number) => (
                <LessonBlock key={b.id || i} block={b} blockIndex={i} isTeacher={false} />
              ))}
            </div>
          </>
        ) : (
          <>
            {currentSlide.projector?.headline && (
              <h2 className="text-6xl font-bold text-center mb-10 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
                {currentSlide.projector.headline}
              </h2>
            )}
            {!currentSlide.tableData && !currentSlide.cardData && currentSlide.projector?.body && (
              <div className="text-2xl text-gray-300 leading-relaxed space-y-3 w-full max-w-5xl">
                {currentSlide.projector.body.split('\n').filter(Boolean).map((line: string, i: number) => (
                  <p key={i} className={line.startsWith('•') ? "flex items-start gap-3" : "text-center"}>
                    {line.startsWith('•') ? (
                      <>
                        <span className="text-purple-400 mt-1 flex-shrink-0">•</span>
                        <span>{line.substring(1).trim()}</span>
                      </>
                    ) : line}
                  </p>
                ))}
              </div>
            )}
          </>
        )}

        {currentSlide.tableData && (
          <div className="w-full mt-4 rounded-xl overflow-hidden border border-white/20">
            <table className="w-full text-xl border-collapse table-fixed">
              <thead>
                <tr>
                  {currentSlide.tableData.headers.map((h: string, i: number) => (
                    <th key={i} className="border border-white/20 bg-white/20 px-6 py-4 text-left font-bold text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentSlide.tableData.rows.map((row: string[], ri: number) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-white/5" : "bg-white/10"}>
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} className="border border-white/20 px-6 py-4 text-white">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentSlide.cardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
            {currentSlide.cardData.map((card: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-foreground mb-3">{card.title}</h3>
                {card.text && <p className="text-lg text-muted-foreground">{card.text}</p>}
              </div>
            ))}
          </div>
        )}

        {currentSlide.type === "activity" && currentSlide.activitySpec?.activityType === "wall" ? (
          <WallProjectorView
            sessionId={sessionId}
            questionIndex={currentIndex}
            anonymous={currentSlide.activitySpec?.anonymous || false}
            published={
              (session.settings as any)?.wallPublished === true &&
              (session.settings as any)?.wallPublishedQuestion === currentIndex
            }
          />
        ) : currentSlide.type === "activity" && (
          <div className="mt-8 bg-primary/10 border border-primary/20 rounded-2xl px-8 py-6">
            <div className="flex items-center gap-4 text-primary text-2xl font-medium">
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              Žáci plní aktivitu na svých zařízeních
            </div>
          </div>
        )}
      </div>

      <div className="px-12 py-6 border-t border-border flex justify-between items-center text-muted-foreground">
        <span className="text-lg">Kód: <span className="font-mono font-bold text-foreground">{gameCode}</span></span>
        <span className="text-lg">{players.length} žáků online</span>
      </div>
    </div>
  );
};

export default ProjectorSlideView;
