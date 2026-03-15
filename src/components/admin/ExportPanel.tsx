import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, FileDown, Globe, Printer, Presentation, ExternalLink, CheckCircle, XCircle, Users, GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import pptxgen from "pptxgenjs";
import { toSlideSpecDocument, type SlideSpecDocument, type SlideSpec as SlideSpecType } from "@/lib/slide-spec";

interface Props {
  lessonPlanId: string;
  planTitle: string;
  planSlides: any[];
  mode?: "live" | "student_paced";
}

interface ExportResult {
  format: string;
  url?: string;
  status: "idle" | "running" | "succeeded" | "failed";
  error?: string;
}

type ExportTarget = "teacher" | "student";

const TYPE_COLORS: Record<string, string> = {
  intro: "3B82F6", objective: "8B5CF6", explain: "F59E0B",
  practice: "22C55E", activity: "F43F5E", summary: "14B8A6", exit: "F97316",
};

const TYPE_LABELS: Record<string, string> = {
  intro: "Úvod", objective: "Cíl", explain: "Výklad",
  practice: "Procvičení", activity: "Aktivita", summary: "Shrnutí", exit: "Exit ticket",
};

const ExportPanel = ({ lessonPlanId, planTitle, planSlides, mode = "live" }: Props) => {
  const isStudentPaced = mode === "student_paced";
  const [exportTarget, setExportTarget] = useState<ExportTarget>(isStudentPaced ? "student" : "teacher");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [exports, setExports] = useState<Record<string, ExportResult>>({
    html: { format: "html", status: "idle" },
    pdf: { format: "pdf", status: "idle" },
    pptx: { format: "pptx", status: "idle" },
  });

  // Derived: answer key only for teacher target
  const includeAnswerKey = exportTarget === "teacher";
  // Teacher notes only when teacher target AND switch is on
  const effectiveIncludeNotes = exportTarget === "teacher" && includeNotes;

  const updateExport = (format: string, update: Partial<ExportResult>) => {
    setExports((prev) => ({ ...prev, [format]: { ...prev[format], ...update } }));
  };

  const handleExport = async (format: string) => {
    updateExport(format, { status: "running", error: undefined });

    try {
      if (format === "pptx") {
        await generatePptxClient();
        updateExport(format, { status: "succeeded" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("export-lesson", {
        body: {
          lessonPlanId,
          format,
          options: {
            includeTeacherNotes: effectiveIncludeNotes,
            includeAnswerKey,
            exportTarget,
            mode,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      updateExport(format, { status: "succeeded", url: data.url });

      if (format === "pdf" && data.url) {
        window.open(data.url, "_blank");
        toast({ title: "PDF připraven", description: "Použijte Ctrl+P pro tisk do PDF." });
      } else if (data.url) {
        toast({ title: `${format.toUpperCase()} exportován` });
      }
    } catch (e: any) {
      console.error(`Export ${format} error:`, e);
      updateExport(format, { status: "failed", error: e.message });
      toast({ title: "Chyba exportu", description: e.message, variant: "destructive" });
    }
  };

  const generatePptxClient = async () => {
    const pptx = new pptxgen();
    const suffix = exportTarget === "student" ? " (žák)" : " (učitel)";
    pptx.title = planTitle + suffix;
    pptx.author = "ZEdu";
    pptx.layout = "LAYOUT_WIDE";

    for (const slide of planSlides) {
      const s = pptx.addSlide();
      const typeColor = TYPE_COLORS[slide.type] || "6B7280";
      const typeLabel = TYPE_LABELS[slide.type] || slide.type;

      // Type badge
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.5, y: 0.3, w: 1.5, h: 0.35,
        fill: { color: typeColor },
        rectRadius: 0.15,
      });
      s.addText(typeLabel, {
        x: 0.5, y: 0.3, w: 1.5, h: 0.35,
        color: "FFFFFF", fontSize: 11, bold: true, align: "center",
      });

      // Headline — student-paced uses device instructions as primary content
      const headline = isStudentPaced
        ? (slide.device?.headline || slide.projector?.headline || "")
        : (slide.projector?.headline || "");

      s.addText(headline, {
        x: 0.5, y: 0.9, w: 12, h: 0.8,
        fontSize: 28, bold: true, color: "1E293B",
      });

      // Body
      const body = isStudentPaced
        ? (slide.device?.instructions || slide.projector?.body || "")
        : (slide.projector?.body || "");

      s.addText(body, {
        x: 0.5, y: 1.8, w: 8, h: 2.5,
        fontSize: 16, color: "475569", valign: "top",
      });

      // Activity placeholder
      if (slide.activitySpec) {
        if (slide.activitySpec.type === "mcq" && slide.activitySpec.model?.choices) {
          const choices = slide.activitySpec.model.choices;
          const correctIdx = slide.activitySpec.model.correctIndex;
          choices.forEach((choice: string, i: number) => {
            const isCorrect = i === correctIdx && includeAnswerKey;
            s.addShape(pptx.ShapeType.roundRect, {
              x: 9, y: 1.8 + i * 0.6, w: 3.5, h: 0.45,
              fill: { color: isCorrect ? "F0FDF4" : "FFFFFF" },
              line: { color: isCorrect ? "22C55E" : "E2E8F0", width: 1 },
              rectRadius: 0.08,
            });
            s.addText(`${isCorrect ? "✓ " : "○ "}${choice}`, {
              x: 9.1, y: 1.8 + i * 0.6, w: 3.3, h: 0.45,
              fontSize: 11, color: isCorrect ? "166534" : "475569",
              bold: isCorrect,
            });
          });
        } else if (exportTarget === "student") {
          // Generic activity placeholder for student handout
          s.addShape(pptx.ShapeType.roundRect, {
            x: 9, y: 1.8, w: 3.5, h: 2,
            fill: { color: "FEF9C3" },
            line: { color: "EAB308", width: 1 },
            rectRadius: 0.1,
          });
          s.addText(`🎯 ${slide.activitySpec.type?.toUpperCase() || "Aktivita"}\n\nVypracuj v aplikaci`, {
            x: 9.1, y: 1.9, w: 3.3, h: 1.8,
            fontSize: 12, color: "92400E", align: "center", valign: "middle",
          });
        }
      }

      // Device section — only in teacher export (student already has it as main content)
      if (exportTarget === "teacher" && !isStudentPaced) {
        s.addShape(pptx.ShapeType.roundRect, {
          x: 0.5, y: 4.5, w: 8, h: 1.2,
          fill: { color: "F1F5F9" },
          rectRadius: 0.1,
          line: { color: "E2E8F0", width: 1 },
        });
        s.addText(`📱 Žák: ${slide.device?.instructions || ""}`, {
          x: 0.7, y: 4.6, w: 7.6, h: 1,
          fontSize: 13, color: "475569", valign: "top",
        });
      }

      // Teacher notes
      if (effectiveIncludeNotes && slide.teacherNotes) {
        s.addNotes(slide.teacherNotes);
      }
    }

    const fileBase = planTitle.replace(/\s+/g, "_");
    const fileName = exportTarget === "student" ? `${fileBase}_handout.pptx` : `${fileBase}_teacher.pptx`;
    await pptx.writeFile({ fileName });
    toast({ title: "PPTX stažen" });
  };

  const formatConfigs = [
    {
      key: "pptx", label: "PPTX", icon: Presentation,
      desc: exportTarget === "student"
        ? "Handout: výklad + placeholdery aktivit"
        : "Učitelská verze s klíčem a poznámkami",
    },
    {
      key: "pdf", label: "PDF", icon: Printer,
      desc: exportTarget === "student"
        ? "Žákovský handout (bez odpovědí)"
        : "Učitelský klíč odpovědí (Ctrl+P)",
    },
    {
      key: "html", label: "HTML", icon: Globe,
      desc: isStudentPaced
        ? "Offline balíček (storage: nespecifikováno)"
        : "Interaktivní prezentace v prohlížeči",
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <FileDown className="w-4 h-4" />
        Export plánu lekce
      </h3>

      {/* Export target selector */}
      <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">Export pro:</Label>
        <RadioGroup
          value={exportTarget}
          onValueChange={(v) => setExportTarget(v as ExportTarget)}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="student" id="target-student" />
            <Label htmlFor="target-student" className="text-xs flex items-center gap-1 cursor-pointer">
              <GraduationCap className="w-3.5 h-3.5" /> Žák (handout)
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="teacher" id="target-teacher" />
            <Label htmlFor="target-teacher" className="text-xs flex items-center gap-1 cursor-pointer">
              <Users className="w-3.5 h-3.5" /> Učitel (klíč)
            </Label>
          </div>
        </RadioGroup>

        {/* Teacher-only options */}
        {exportTarget === "teacher" && (
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} id="exp-notes" />
            <Label htmlFor="exp-notes" className="text-xs">Poznámky učitele</Label>
          </div>
        )}
      </div>

      {/* Format buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {formatConfigs.map(({ key, label, icon: Icon, desc }) => {
          const exp = exports[key];
          return (
            <div key={key} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{label}</span>
                </div>
                {exp.status === "succeeded" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {exp.status === "failed" && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={exp.status === "succeeded" ? "outline" : "default"}
                  className="flex-1 h-7 text-xs"
                  onClick={() => handleExport(key)}
                  disabled={exp.status === "running"}
                >
                  {exp.status === "running" ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <FileDown className="w-3 h-3 mr-1" />
                  )}
                  {exp.status === "succeeded" ? "Znovu" : "Exportovat"}
                </Button>
                {exp.url && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                    <a href={exp.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                )}
              </div>
              {exp.error && <p className="text-xs text-destructive">{exp.error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExportPanel;
