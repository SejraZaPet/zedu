import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StudentTileTone = "learn" | "textbooks" | "assignments" | "notebook" | "portfolio" | "schedule";

interface StudentDashboardTileProps {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
  tone: StudentTileTone;
  count?: number | null;
  wide?: boolean;
}

const activateWithSpace = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
  if (event.key !== " ") return;
  event.preventDefault();
  if (!event.repeat) event.currentTarget.click();
};

export function StudentDashboardTile({
  id,
  icon: Icon,
  title,
  description,
  to,
  tone,
  count,
  wide = false,
}: StudentDashboardTileProps) {
  const hasCount = typeof count === "number" && count > 0;
  return (
    <Button asChild className={cn("student-dashboard-tile", `student-dashboard-tile--${tone}`, wide && "student-dashboard-tile--wide")}>
      <Link
        to={to}
        title={description}
        aria-description={description}
        aria-label={hasCount ? `${title}, ${title === "Učím se" ? "počet nadcházejících testů" : "počet k odevzdání"}: ${count}` : undefined}
        onKeyDown={activateWithSpace}
        data-testid={`student-tile-${id}`}
      >
        <Icon aria-hidden="true" strokeWidth={1.6} />
        <span className="student-dashboard-tile-body">
          <span className="student-dashboard-tile-title">{title}</span>
          <span className="student-dashboard-tile-description">{description}</span>
        </span>
        {hasCount && (
          <span className="student-dashboard-tile-count" aria-hidden="true">{count}</span>
        )}
      </Link>
    </Button>
  );
}

interface StudentDashboardCompactTileProps {
  id: string;
  icon: LucideIcon;
  title: string;
  to: string;
}

export function StudentDashboardCompactTile({ id, icon: Icon, title, to }: StudentDashboardCompactTileProps) {
  return (
    <Button asChild variant="outline" className="student-dashboard-compact-tile">
      <Link to={to} onKeyDown={activateWithSpace} data-testid={`student-tile-${id}`}>
        <Icon aria-hidden="true" strokeWidth={1.8} />
        <span>{title}</span>
      </Link>
    </Button>
  );
}
