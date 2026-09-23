import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ClipboardList, FolderPlus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AssignmentMaterialsList from "@/components/assignments/AssignmentMaterialsList";
import type { StudentLessonPlan } from "@/lib/lesson-plan-student";
import { resolveLinkedLesson } from "@/lib/linked-lesson";
import { saveWorksheetToPortfolio } from "@/lib/portfolio";
import { toast } from "sonner";

interface Props {
  plan: StudentLessonPlan;
  studentId: string;
  subjectLabel: string;
}

/**
 * Karta zveřejněného plánu hodiny pro žáka. Žák vidí jen téma, popis,
 * přílohy a prokliky — bez minutového rozvržení fází.
 */
export default function StudentLessonPlanCard({ plan, studentId, subjectLabel }: Props) {
  const navigate = useNavigate();
  const [openingLesson, setOpeningLesson] = useState(false);
  const [savingPortfolioId, setSavingPortfolioId] = useState<string | null>(null);

  const openLesson = async () => {
    if (!plan.lessonId) return;
    setOpeningLesson(true);
    const info = await resolveLinkedLesson(plan.lessonId, plan.lessonSource);
    setOpeningLesson(false);
    if (!info) {
      toast.error("Lekci se nepodařilo otevřít — nejspíš už není dostupná.");
      return;
    }
    navigate(info.url);
  };

  const saveToPortfolio = async (worksheet: { id: string; title: string }) => {
    setSavingPortfolioId(worksheet.id);
    try {
      const { already } = await saveWorksheetToPortfolio({
        studentId,
        worksheetId: worksheet.id,
        title: worksheet.title,
        subject: plan.subject || subjectLabel,
      });
      toast.success(
        already
          ? `„${worksheet.title}“ už ve svém portfoliu máš.`
          : `„${worksheet.title}“ uložen do portfolia.`,
      );
    } catch (e: any) {
      toast.error(e?.message || "Uložení do portfolia se nepovedlo.");
    } finally {
      setSavingPortfolioId(null);
    }
  };

  return (
    <Card className="p-3 mt-2 border-dashed bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">Plán hodiny</div>
          <div className="text-sm font-semibold mt-0.5">{plan.title}</div>
          {plan.description && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
              {plan.description}
            </p>
          )}
          {plan.studentDescription && (
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2">
              <div className="text-xs font-semibold">Zadání</div>
              <p className="text-sm mt-0.5 whitespace-pre-wrap">{plan.studentDescription}</p>
            </div>
          )}
        </div>
      </div>

      {plan.materials.length > 0 && (
        <div className="mt-3">
          <AssignmentMaterialsList materials={plan.materials} title="Materiály k hodině" />
        </div>
      )}

      {(plan.lessonId || plan.worksheets.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {plan.lessonId && (
            <Button size="sm" variant="outline" onClick={openLesson} disabled={openingLesson}>
              {openingLesson ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <BookOpen className="h-3.5 w-3.5 mr-1" />
              )}
              Otevřít lekci
            </Button>
          )}
          {plan.worksheets.map((w) => (
            <div key={w.id} className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/student/pracovni-list/${w.id}`)}
                className="max-w-[14rem]"
              >
                <ClipboardList className="h-3.5 w-3.5 mr-1 shrink-0" />
                <span className="truncate">{w.title}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => saveToPortfolio(w)}
                disabled={savingPortfolioId === w.id}
                title="Uložit pracovní list do portfolia"
              >
                {savingPortfolioId === w.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderPlus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
