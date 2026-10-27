import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import AttemptQuickPreviewDialog from "@/components/portfolio/AttemptQuickPreviewDialog";
import { useAuth } from "@/contexts/AuthContext";
import { PortfolioItem, portfolioAssignmentId, portfolioWorksheetHref } from "@/lib/portfolio";

/** Otevření zdroje portfoliové položky: odevzdání úkolu a/nebo pracovní list. */
export default function PortfolioSourceActions({ item }: { item: PortfolioItem }) {
  const { user } = useAuth();
  const assignmentId = portfolioAssignmentId(item);
  const href = user?.id === item.student_id ? portfolioWorksheetHref(item) : null;
  if (!assignmentId && !href) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {assignmentId && (
        <AttemptQuickPreviewDialog
          assignmentId={assignmentId}
          studentId={item.student_id}
          assignmentTitle={item.title}
          triggerVariant="button"
          triggerLabel="Zobrazit odevzdání"
          inPortfolio
        />
      )}
      {href && (
        <Link to={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ExternalLink className="w-3.5 h-3.5" aria-hidden /> Otevřít list
        </Link>
      )}
    </div>
  );
}
