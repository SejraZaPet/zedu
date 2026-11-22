import { ArrowLeft, Check, FileDown, FileUp, Loader2, Monitor, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  linkedLessonTitle?: string | null;
  dirty: boolean;
  saving?: boolean;
  exporting?: boolean;
  canSave: boolean;
  onBack?: () => void;
  onImport: () => void;
  onExport: () => void;
  onAssign: () => void;
  onSave: () => void;
  onLaunch: () => void;
}

/** Horní lišta editoru: identita dokumentu a akce nad celou prezentací. */
export default function PresentationTopBar({
  title, linkedLessonTitle, dirty, saving, exporting, canSave,
  onBack, onImport, onExport, onAssign, onSave, onLaunch,
}: Props) {
  return (
    <header className="deck-topbar" data-testid="presentation-topbar">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl" onClick={onBack} aria-label="Zpět">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <span className="shrink-0 font-deck-heading text-[26px] font-semibold leading-none tracking-tight text-deck-violet">Bez·li</span>
        <span className="h-7 w-px shrink-0 bg-deck-line" aria-hidden />
        <div className="hidden min-w-0 items-center gap-1.5 text-xs sm:flex">
          <span className="shrink-0 text-deck-muted">Prezentace</span>
          <span className="text-deck-line">/</span>
          <span className="max-w-[220px] truncate font-semibold text-deck-ink" title={title}>{title}</span>
        </div>
        <span className={`deck-status ${dirty ? "deck-status--dirty" : "deck-status--saved"}`}>
          {!dirty && <Check className="h-3 w-3" aria-hidden />}
          {dirty ? "Neuloženo" : "Uloženo"}
        </span>
        {linkedLessonTitle && (
          <span className="hidden max-w-[220px] truncate rounded-full bg-deck-soft px-2.5 py-1 text-[11px] font-medium text-deck-violet-deep xl:inline-flex" title={`Propojeno s lekcí: ${linkedLessonTitle}`}>
            Propojeno s lekcí: {linkedLessonTitle}
          </span>
        )}
      </div>
      <div className="deck-topbar-actions">
        <Button variant="outline" className="deck-topbar-action deck-topbar-action--icon" onClick={onImport} aria-label="Import .pptx / PDF" title="Import .pptx / PDF">
          <FileUp className="h-4 w-4" /> <span>Import .pptx / PDF</span>
        </Button>
        <Button variant="outline" className="deck-topbar-action deck-topbar-action--icon" onClick={onExport} disabled={exporting} aria-label="Export / Tisk" title="Export / Tisk">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} <span>Export / Tisk</span>
        </Button>
        <Button variant="outline" className="deck-topbar-action deck-topbar-action--icon" onClick={onAssign} aria-label="Zadat žákům" title="Zadat žákům">
          <Send className="h-4 w-4" /> <span>Zadat žákům</span>
        </Button>
        {canSave && (
          <Button variant="outline" className="deck-topbar-action" onClick={onSave} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} <span>Uložit</span>
          </Button>
        )}
        <Button className="deck-topbar-action border-deck-violet bg-deck-violet text-deck-on-violet hover:bg-deck-violet-deep" onClick={onLaunch}>
          <Monitor className="h-4 w-4" /> <span>Spustit prezentaci</span>
        </Button>
      </div>
    </header>
  );
}
