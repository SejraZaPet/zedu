import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Phase {
  key: string;
  title: string;
  hint: string;
}

const PHASES: Phase[] = [
  { key: "uvod", title: "Úvod", hint: "Přivítání, organizace, cíl hodiny." },
  { key: "motivace", title: "Motivace", hint: "Otázka, příběh, video — vzbuzení zájmu." },
  { key: "hlavni", title: "Hlavní část", hint: "Výklad nového učiva, klíčové aktivity." },
  { key: "procviceni", title: "Procvičení", hint: "Samostatná či skupinová práce, příklady." },
  { key: "reflexe", title: "Reflexe", hint: "Co si žáci odnesli, zpětná vazba." },
  { key: "zaver", title: "Závěr", hint: "Shrnutí, domácí úkol, rozloučení." },
];

interface PhaseValue {
  timeMin: string;
  description: string;
}

type PhasesState = Record<string, PhaseValue>;

const emptyPhases = (): PhasesState =>
  PHASES.reduce((acc, p) => {
    acc[p.key] = { timeMin: "", description: "" };
    return acc;
  }, {} as PhasesState);

export default function TeacherLessonPlanEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [title, setTitle] = useState("Nový plán hodin");
  const [description, setDescription] = useState("");
  const [phases, setPhases] = useState<PhasesState>(emptyPhases);

  const totalMin = PHASES.reduce((sum, p) => {
    const n = parseInt(phases[p.key].timeMin, 10);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  function updatePhase(key: string, patch: Partial<PhaseValue>) {
    setPhases((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function handleSave() {
    // TODO: napojit na DB
    toast({
      title: "Plán uložen",
      description: "Ukládání do databáze bude doplněno.",
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <div aria-hidden className="h-[70px] shrink-0" />

      <main className="flex-1 container mx-auto px-4 pt-8 pb-12 max-w-4xl">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/ucitel/plany-hodin")}
            className="shrink-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zpět na plány
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Celkem: {totalMin} min</span>
            </div>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Uložit
            </Button>
          </div>
        </div>

        {/* Hlavička plánu */}
        <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="plan-title">Název plánu</Label>
            <Input
              id="plan-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Např. Sčítání zlomků – 6. ročník"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-desc">Krátký popis (volitelné)</Label>
            <Textarea
              id="plan-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Téma, cíl hodiny, poznámky…"
              rows={2}
            />
          </div>
          {id && (
            <p className="text-xs text-muted-foreground">
              ID plánu: <span className="font-mono">{id}</span>
            </p>
          )}
        </div>

        {/* Fáze hodiny */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Fáze hodiny</h2>

          {PHASES.map((phase, idx) => {
            const value = phases[phase.key];
            return (
              <div
                key={phase.key}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-brand text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base">{phase.title}</h3>
                      <p className="text-xs text-muted-foreground">{phase.hint}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Label
                      htmlFor={`time-${phase.key}`}
                      className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                      Čas (min)
                    </Label>
                    <Input
                      id={`time-${phase.key}`}
                      type="number"
                      min={0}
                      max={180}
                      value={value.timeMin}
                      onChange={(e) =>
                        updatePhase(phase.key, { timeMin: e.target.value })
                      }
                      placeholder="0"
                      className="w-20 h-9"
                    />
                  </div>
                </div>

                <Textarea
                  value={value.description}
                  onChange={(e) =>
                    updatePhase(phase.key, { description: e.target.value })
                  }
                  placeholder="Popiš aktivity v této fázi…"
                  rows={3}
                />
              </div>
            );
          })}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
