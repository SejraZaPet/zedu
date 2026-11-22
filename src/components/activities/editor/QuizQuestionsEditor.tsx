import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyQuizQuestion, type QuizQuestion } from "@/lib/quiz-questions";

/** Sdílený editor kvízu s jednou i více otázkami; prázdné odpovědi se nemažou. */
export default function QuizQuestionsEditor({ questions, onChange }: { questions: QuizQuestion[]; onChange: (next: QuizQuestion[]) => void }) {
  const current = questions.length ? questions : [emptyQuizQuestion()];
  const updateQuestion = (index: number, patch: Partial<QuizQuestion>) => onChange(current.map((question, i) => i === index ? { ...question, ...patch } : question));
  return (
    <div className="space-y-4">
      {current.map((quiz, qi) => (
        <section key={qi} className="space-y-3 rounded-lg border border-border p-3" aria-label={`Otázka ${qi + 1}`}>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold">Otázka {qi + 1}</Label>
            {current.length > 1 && <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={`Smazat otázku ${qi + 1}`} onClick={() => onChange(current.filter((_, i) => i !== qi))}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
          <Input aria-label={`Text otázky ${qi + 1}`} value={quiz.question} placeholder="Text otázky" onChange={(event) => updateQuestion(qi, { question: event.target.value })} />
          <div className="space-y-2">
            <Label className="text-xs">Odpovědi – označte správné</Label>
            {quiz.answers.map((answer, ai) => (
              <div key={ai} className="flex items-center gap-2">
                <Checkbox checked={answer.correct} onCheckedChange={(value) => updateQuestion(qi, { answers: quiz.answers.map((item, i) => i === ai ? { ...item, correct: !!value } : item) })} aria-label={`Správná odpověď ${ai + 1} otázky ${qi + 1}`} />
                <Input className="flex-1" placeholder={`Odpověď ${ai + 1}`} value={answer.text} onChange={(event) => updateQuestion(qi, { answers: quiz.answers.map((item, i) => i === ai ? { ...item, text: event.target.value } : item) })} />
                {quiz.answers.length > 1 && <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={`Smazat odpověď ${ai + 1} otázky ${qi + 1}`} onClick={() => updateQuestion(qi, { answers: quiz.answers.filter((_, i) => i !== ai) })}><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => updateQuestion(qi, { answers: [...quiz.answers, { text: "", correct: false }] })}><Plus className="mr-1 h-3.5 w-3.5" />Přidat odpověď</Button>
          </div>
          <div><Label className="text-xs">Vysvětlení (volitelné)</Label><Textarea value={quiz.explanation ?? ""} onChange={(event) => updateQuestion(qi, { explanation: event.target.value })} rows={2} /></div>
        </section>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...current, emptyQuizQuestion()])}><Plus className="mr-1 h-3.5 w-3.5" />Přidat otázku</Button>
    </div>
  );
}
