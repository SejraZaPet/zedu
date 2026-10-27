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
    document.body.style.paddingBottom = "4.5rem";
    return () => { document.body.style.paddingBottom = prev; };
  }, [visible]);
  if (!visible) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-primary/30 bg-card/95 backdrop-blur px-3 py-1.5 shadow-lg">
      <FlaskConical className="w-4 h-4 text-primary" aria-hidden />
      <span className="text-sm">Jste <strong>testovací žák</strong></span>
      <Button
        size="sm" variant="ghost" className="h-8 px-2" disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await returnFromPreviewStudent();
          window.location.href = ok ? "/admin" : "/auth";
        }}
      >
        <X className="w-3.5 h-3.5 mr-1" /> Zpět na admina
      </Button>
    </div>
  );
};

export default PreviewStudentBanner;
