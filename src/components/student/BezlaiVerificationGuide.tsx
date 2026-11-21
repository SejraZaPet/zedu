import { useMemo, useState } from "react";
import { BookOpenCheck, FileUp, NotebookPen, ShieldQuestion } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentPracticeLessons } from "@/hooks/useStudentPracticeLessons";
import { practiceLessonSelectOptions } from "@/lib/student-practice-lessons";
import { BEZLAI_VERIFICATION_GUIDE } from "@/lib/bezlai-verification";

function LessonSearch({ close }: { close: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lessons = useStudentPracticeLessons(user?.id);
  const options = useMemo(() => practiceLessonSelectOptions(lessons.data ?? []), [lessons.data]);
  const allLessons = useMemo(() => (lessons.data ?? []).flatMap((group) => group.lessons), [lessons.data]);
  const [lessonId, setLessonId] = useState("");

  return (
    <SearchableSelect
      id="bezlai-guide-lesson"
      value={lessonId}
      onValueChange={(id) => {
        setLessonId(id);
        const href = allLessons.find((lesson) => lesson.id === id)?.href;
        if (href) {
          close();
          navigate(href);
        }
      }}
      options={options}
      label={BEZLAI_VERIFICATION_GUIDE.lessonsLabel}
      triggerLabel="Vyhledat lekci"
      placeholder="Vyber lekci"
      searchPlaceholder="Název lekce, předmětu nebo učebnice…"
      emptySearchMessage="Nic jsme nenašli. Zkus jiné klíčové slovo."
      loading={lessons.isPending && lessons.data === undefined}
      loadingLabel="Načítám tvoje lekce…"
      error={lessons.isError ? "Lekce se nepodařilo načíst" : null}
      retrying={lessons.isFetching}
      onRetry={() => { void lessons.refetch(); }}
      showSelectedSubtitle
      growing
    />
  );
}

interface BezlaiVerificationGuideProps {
  onTeacher?: () => void;
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Návod je pevný aplikační obsah, nikoli součást odpovědi AI. */
export default function BezlaiVerificationGuide({ onTeacher, showTrigger = true, open: openProp, onOpenChange }: BezlaiVerificationGuideProps) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = (value: boolean) => {
    setInnerOpen(value);
    onOpenChange?.(value);
  };

  return (
    <>
      {showTrigger && (
        <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-2 px-2 text-xs" onClick={() => setOpen(true)}>
          <BookOpenCheck className="h-4 w-4" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.title}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-primary" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.title}</DialogTitle>
            <DialogDescription>{BEZLAI_VERIFICATION_GUIDE.intro}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 text-sm leading-relaxed">
            <section aria-labelledby="bezlai-guide-bezli" className="space-y-3">
              <h3 id="bezlai-guide-bezli" className="font-heading text-base font-semibold">{BEZLAI_VERIFICATION_GUIDE.bezliTitle}</h3>
              <p>{BEZLAI_VERIFICATION_GUIDE.bezliIntro}</p>
              {open && <LessonSearch close={() => setOpen(false)} />}
              <div className="flex flex-wrap gap-2">
                <Button asChild type="button" variant="outline" size="sm" className="min-h-11 gap-2"><Link to="/student/sesit"><NotebookPen className="h-4 w-4" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.notebooksLabel}</Link></Button>
                <Button asChild type="button" variant="outline" size="sm" className="min-h-11 gap-2"><Link to="/student/z-materialu"><FileUp className="h-4 w-4" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.materialLabel}</Link></Button>
              </div>
            </section>
            <section aria-labelledby="bezlai-guide-search">
              <h3 id="bezlai-guide-search" className="font-heading text-base font-semibold">{BEZLAI_VERIFICATION_GUIDE.generalTitle}</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">{BEZLAI_VERIFICATION_GUIDE.generalPoints.map((point) => <li key={point}>{point}</li>)}</ul>
            </section>
            <section aria-labelledby="bezlai-guide-reliable">
              <h3 id="bezlai-guide-reliable" className="font-heading text-base font-semibold">{BEZLAI_VERIFICATION_GUIDE.reliableTitle}</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5">{BEZLAI_VERIFICATION_GUIDE.reliablePoints.map((point) => <li key={point}>{point}</li>)}</ul>
            </section>
            <section aria-labelledby="bezlai-guide-unsure" className="rounded-xl border border-border bg-muted/50 p-4">
              <h3 id="bezlai-guide-unsure" className="font-heading text-base font-semibold">{BEZLAI_VERIFICATION_GUIDE.unsureTitle}</h3>
              <p className="mt-2">{BEZLAI_VERIFICATION_GUIDE.unsureText}</p>
              {onTeacher && <Button type="button" className="mt-3 min-h-11 gap-2" onClick={onTeacher}><ShieldQuestion className="h-4 w-4" aria-hidden />{BEZLAI_VERIFICATION_GUIDE.teacherLabel}</Button>}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
