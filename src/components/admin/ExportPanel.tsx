import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, FileDown, Globe, Printer, Presentation, ExternalLink, CheckCircle, XCircle, Users, GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import pptxgen from "pptxgenjs";
import { toSlideSpecDocument, getActivityTransformRule, buildSpeakerNotesWithAnswers, resolveTemplate, regionToInches, applyOverflow, type SlideSpecDocument, type SlideSpec as SlideSpecType } from "@/lib/slide-spec";
import { EXPORT_COPY } from "@/lib/export-microcopy";

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
        toast({ title: EXPORT_COPY.toasts.exportSucceededPdf.title, description: EXPORT_COPY.toasts.exportSucceededPdf.description });
      } else if (data.url) {
        toast({ title: EXPORT_COPY.toasts.exportSucceededHtml.title, description: EXPORT_COPY.toasts.exportSucceededHtml.description });
      }
    } catch (e: any) {
      console.error(`Export ${format} error:`, e);
      updateExport(format, { status: "failed", error: e.message });
      toast({ title: EXPORT_COPY.toasts.exportFailed.title, description: e.message || EXPORT_COPY.toasts.exportFailed.description, variant: "destructive" });
    }
  };

  const generatePptxClient = async () => {
    // Convert raw slides to SlideSpec v1 intermediate format
    const specDoc = toSlideSpecDocument(planSlides, {
      title: planTitle,
      subject: "",
      gradeBand: "",
      mode: isStudentPaced ? "student_paced" : "teacher-led",
    });

    const pptx = new pptxgen();
    const suffix = exportTarget === "student" ? " (žák)" : " (učitel)";
    pptx.title = planTitle + suffix;
    pptx.author = "ZEdu";
    pptx.layout = "LAYOUT_WIDE";

    for (const spec of specDoc.slides) {
      const s = pptx.addSlide();
      const typeColor = TYPE_COLORS[spec.type] || "6B7280";
      const typeLabel = TYPE_LABELS[spec.type] || spec.type;

      // Resolve template for this slide type
      const tmpl = resolveTemplate(spec);
      const badge = regionToInches(tmpl.regions.badge);
      const titleR = regionToInches(tmpl.regions.title);
      const contentR = regionToInches(tmpl.regions.content);
      const secondaryR = tmpl.regions.secondary ? regionToInches(tmpl.regions.secondary) : null;
      const deviceR = tmpl.regions.deviceBar ? regionToInches(tmpl.regions.deviceBar) : null;
      const qrR = tmpl.regions.qrArea ? regionToInches(tmpl.regions.qrArea) : null;

      // Type badge
      s.addShape(pptx.ShapeType.roundRect, {
        x: badge.x, y: badge.y, w: badge.w, h: badge.h,
        fill: { color: typeColor }, rectRadius: 0.15,
      });
      s.addText(typeLabel, {
        x: badge.x, y: badge.y, w: badge.w, h: badge.h,
        color: "FFFFFF", fontSize: 11, bold: true, align: "center",
      });

      // Title with overflow protection
      const titleOf = applyOverflow(spec.title, tmpl.overflow.titleMaxChars, 28, tmpl.overflow.minFontSizePt, tmpl.overflow.truncationSuffix);
      s.addText(titleOf.text, {
        x: titleR.x, y: titleR.y, w: titleR.w, h: titleR.h,
        fontSize: titleOf.fontSize, bold: true, color: "1E293B",
      });

      // Body text blocks with overflow
      const bodyBlocks = spec.textBlocks.filter(b => b.role === "body" || (isStudentPaced && b.role === "device_instruction"));
      const bodyText = bodyBlocks.map(b => b.text).join("\n\n");
      const bodyOf = applyOverflow(bodyText, tmpl.overflow.contentMaxChars, 16, tmpl.overflow.minFontSizePt, tmpl.overflow.truncationSuffix);
      s.addText(bodyOf.text, {
        x: contentR.x, y: contentR.y, w: contentR.w, h: contentR.h,
        fontSize: bodyOf.fontSize, color: "475569", valign: "top",
      });

      // Interactive placeholder in secondary region
      if (spec.interactivePlaceholder && secondaryR) {
        const placeholder = spec.interactivePlaceholder;
        const rule = getActivityTransformRule(placeholder.activityType);

        if (rule.pptx.renderChoices && placeholder.activityType === "mcq" && placeholder.model?.choices) {
          const choices = placeholder.model.choices as string[];
          const correctIdx = placeholder.model.correctIndex as number;
          const itemH = Math.min(secondaryR.h / choices.length - 0.05, 0.5);
          choices.forEach((choice: string, i: number) => {
            const isCorrect = i === correctIdx && includeAnswerKey;
            s.addShape(pptx.ShapeType.roundRect, {
              x: secondaryR.x, y: secondaryR.y + i * (itemH + 0.1), w: secondaryR.w, h: itemH,
              fill: { color: isCorrect ? "F0FDF4" : "FFFFFF" },
              line: { color: isCorrect ? "22C55E" : "E2E8F0", width: 1 },
              rectRadius: 0.08,
            });
            s.addText(`${isCorrect ? "✓ " : "○ "}${choice}`, {
              x: secondaryR.x + 0.1, y: secondaryR.y + i * (itemH + 0.1), w: secondaryR.w - 0.2, h: itemH,
              fontSize: 11, color: isCorrect ? "166534" : "475569", bold: isCorrect,
            });
          });
        } else if (rule.pptx.renderChoices && placeholder.activityType === "matching" && placeholder.model?.pairs) {
          const pairs = placeholder.model.pairs as Array<{ left: string; right: string }>;
          pairs.forEach((pair, i) => {
            s.addText(`${pair.left}  →  ${includeAnswerKey ? pair.right : "___________"}`, {
              x: secondaryR.x, y: secondaryR.y + i * 0.5, w: secondaryR.w, h: 0.4,
              fontSize: 11, color: "475569",
            });
          });
        } else if (rule.pptx.renderChoices && placeholder.activityType === "true_false") {
          s.addText(`${placeholder.prompt || ""}\n\n○ Pravda    ○ Nepravda`, {
            x: secondaryR.x, y: secondaryR.y, w: secondaryR.w, h: secondaryR.h * 0.5,
            fontSize: 12, color: "475569",
          });
        } else if (rule.pptx.renderChoices && placeholder.activityType === "ordering" && placeholder.model?.items) {
          const items = placeholder.model.items as string[];
          items.forEach((item, i) => {
            s.addText(`☐ ${item}`, {
              x: secondaryR.x, y: secondaryR.y + i * 0.45, w: secondaryR.w, h: 0.4,
              fontSize: 11, color: "475569",
            });
          });
        } else {
          s.addShape(pptx.ShapeType.roundRect, {
            x: secondaryR.x, y: secondaryR.y, w: secondaryR.w, h: secondaryR.h,
            fill: { color: "FEF9C3" }, line: { color: "EAB308", width: 1 }, rectRadius: 0.1,
          });
          s.addText(`🎯 ${placeholder.activityType.toUpperCase()}\n\n${rule.pptx.fallbackText}`, {
            x: secondaryR.x + 0.1, y: secondaryR.y + 0.1, w: secondaryR.w - 0.2, h: secondaryR.h - 0.2,
            fontSize: 12, color: "92400E", align: "center", valign: "middle",
          });
        }

        // QR placeholder in template region
        if (rule.pptx.showQr && qrR) {
          s.addShape(pptx.ShapeType.roundRect, {
            x: qrR.x, y: qrR.y, w: qrR.w, h: qrR.h,
            fill: { color: "F8FAFC" }, line: { color: "94A3B8", width: 1, dashType: "dash" }, rectRadius: 0.1,
          });
          s.addText(`QR\n${placeholder.joinCode || "scan"}`, {
            x: qrR.x, y: qrR.y, w: qrR.w, h: qrR.h,
            fontSize: 14, color: "94A3B8", align: "center", valign: "middle",
          });
        }

        // Video checkpoints
        if (placeholder.activityType === "video" && placeholder.model?.checkpoints && deviceR) {
          const cps = placeholder.model.checkpoints as Array<{ time: string; question: string }>;
          cps.forEach((cp, i) => {
            s.addText(`[${cp.time}] ${cp.question}`, {
              x: deviceR.x, y: deviceR.y + i * 0.35, w: deviceR.w, h: 0.3,
              fontSize: 10, color: "64748B",
            });
          });
        }
      }

      // Device instructions — only in teacher export for live mode
      if (exportTarget === "teacher" && !isStudentPaced && deviceR) {
        const deviceBlock = spec.textBlocks.find(b => b.role === "device_instruction");
        if (deviceBlock) {
          s.addShape(pptx.ShapeType.roundRect, {
            x: deviceR.x, y: deviceR.y, w: deviceR.w, h: deviceR.h,
            fill: { color: "F1F5F9" }, rectRadius: 0.1, line: { color: "E2E8F0", width: 1 },
          });
          s.addText(`📱 Žák: ${deviceBlock.text}`, {
            x: deviceR.x + 0.1, y: deviceR.y + 0.05, w: deviceR.w - 0.2, h: deviceR.h - 0.1,
            fontSize: 13, color: "475569", valign: "top",
          });
        }
      }

      // Speaker notes with answer key
      if (effectiveIncludeNotes || includeAnswerKey) {
        const enrichedNotes = buildSpeakerNotesWithAnswers(spec, includeAnswerKey);
        if (enrichedNotes) s.addNotes(enrichedNotes);
      }
    }

    const fileBase = planTitle.replace(/\s+/g, "_");
    const fileName = exportTarget === "student" ? `${fileBase}_handout.pptx` : `${fileBase}_teacher.pptx`;
    await pptx.writeFile({ fileName });
    toast({ title: EXPORT_COPY.toasts.exportSucceededPptx.title, description: EXPORT_COPY.toasts.exportSucceededPptx.description });
  };

  const formatConfigs = [
    {
      key: "pptx", label: "PPTX", icon: Presentation,
      desc: exportTarget === "student"
        ? EXPORT_COPY.modals.formatPptxStudent
        : EXPORT_COPY.modals.formatPptx,
    },
    {
      key: "pdf", label: "PDF", icon: Printer,
      desc: exportTarget === "student"
        ? EXPORT_COPY.modals.formatPdfStudent
        : EXPORT_COPY.modals.formatPdf,
    },
    {
      key: "html", label: "HTML", icon: Globe,
      desc: exportTarget === "student"
        ? EXPORT_COPY.modals.formatHtmlStudent
        : EXPORT_COPY.modals.formatHtml,
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <FileDown className="w-4 h-4" />
        {EXPORT_COPY.modals.exportTitle}
      </h3>

      {/* Export target selector */}
      <div className="p-3 border border-border rounded-lg bg-muted/30 space-y-3">
        <Label className="text-xs font-medium text-muted-foreground">{EXPORT_COPY.modals.targetLabel}</Label>
        <RadioGroup
          value={exportTarget}
          onValueChange={(v) => setExportTarget(v as ExportTarget)}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="student" id="target-student" />
            <Label htmlFor="target-student" className="text-xs flex items-center gap-1 cursor-pointer">
              <GraduationCap className="w-3.5 h-3.5" /> {EXPORT_COPY.modals.targetStudent}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="teacher" id="target-teacher" />
            <Label htmlFor="target-teacher" className="text-xs flex items-center gap-1 cursor-pointer">
              <Users className="w-3.5 h-3.5" /> {EXPORT_COPY.modals.targetTeacher}
            </Label>
          </div>
        </RadioGroup>

        {/* Teacher-only options */}
        {exportTarget === "teacher" && (
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={includeNotes} onCheckedChange={setIncludeNotes} id="exp-notes" />
            <Label htmlFor="exp-notes" className="text-xs">{EXPORT_COPY.buttons.includeNotes}</Label>
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
                  {exp.status === "succeeded" ? EXPORT_COPY.buttons.reExport : EXPORT_COPY.buttons.chooseFormat.split(" ")[0]}
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
