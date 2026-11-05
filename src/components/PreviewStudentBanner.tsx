import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FlaskConical, X } from "lucide-react";
import { isPreviewStudentSession, returnFromPreviewStudent } from "@/lib/preview-student";

/** Trvalá lišta při přihlášení za testovacího žáka; vrací relaci admina. */
const PreviewStudentBanner = () => {
  const [visible] = useState(isPreviewStudentSession);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "calc(8rem + env(safe-area-inset-bottom))";
    return () => { document.body.style.paddingBottom = prev; };
  }, [visible]);
  if (!visible) return null;
  return (
    <div role="status" data-testid="preview-student-pill" className="preview-student-pill fixed right-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 whitespace-nowrap rounded-full border border-primary/30 bg-card/95 backdrop-blur pl-3 pr-1 py-0.5 text-xs shadow-lg sm:text-sm">
      <FlaskConical className="w-4 h-4 shrink-0 text-primary" aria-hidden />
      <span><span className="sr-only sm:not-sr-only">Jste </span><strong>Testovací žák</strong></span>
      <Button
        size="sm" variant="ghost" className="h-11 px-2 text-xs sm:text-sm" disabled={busy} aria-label="Zpět na admina"
        onClick={async () => {
          setBusy(true);
          const ok = await returnFromPreviewStudent();
          window.location.href = ok ? "/admin" : "/auth";
        }}
      >
        <X className="w-3.5 h-3.5 mr-1" aria-hidden /> Zpět
      </Button>
    </div>
  );
};

export default PreviewStudentBanner;
