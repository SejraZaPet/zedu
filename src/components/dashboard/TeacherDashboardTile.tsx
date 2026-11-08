import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
  count?: number | null;
}

export default function TeacherDashboardTile({ icon: Icon, title, description, to, count }: Props) {
  return (
    <Button asChild className="teacher-dashboard-tile">
      <Link to={to} title={description} aria-description={description}
        onKeyDown={(event) => {
          if (event.key === " ") {
            event.preventDefault();
            if (!event.repeat) event.currentTarget.click();
          }
        }}>
        <Icon aria-hidden="true" strokeWidth={1.7} />
        <span className="teacher-dashboard-tile-title">{title}</span>
        {typeof count === "number" && count > 0 && (
          <span className="teacher-dashboard-tile-count" aria-label={`Počet: ${count}`}>{count}</span>
        )}
      </Link>
    </Button>
  );
}