import { forwardRef } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardTileTone =
  | "learn" | "subjects" | "textbooks" | "assignments" | "notebook" | "portfolio" | "schedule"
  | "studio" | "review" | "teaching" | "preparation" | "classes";

export interface DashboardTileProps {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  to: string;
  tone: DashboardTileTone;
  count?: number | null;
  countLabel?: string;
  wide?: boolean;
  testIdPrefix?: string;
}

const activateWithSpace = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
  if (event.key !== " ") return;
  event.preventDefault();
  if (!event.repeat) event.currentTarget.click();
};

export const DashboardTile = forwardRef<HTMLAnchorElement, DashboardTileProps>(function DashboardTile({
  id,
  icon: Icon,
  title,
  description,
  to,
  tone,
  count,
  countLabel,
  wide = false,
  testIdPrefix = "dashboard",
}, ref) {
  const hasCount = typeof count === "number" && count > 0;
  const accessibleCount = countLabel ?? (title === "Učím se" ? "počet nadcházejících testů" : "počet k odevzdání");
  return (
    <Link
      ref={ref}
      to={to}
      title={description}
      aria-description={description}
      aria-label={hasCount ? `${title}, ${accessibleCount}: ${count}` : undefined}
      onKeyDown={activateWithSpace}
      data-testid={`${testIdPrefix}-tile-${id}`}
      className={cn(buttonVariants(), "dashboard-tile", `dashboard-tile--${tone}`, wide && "dashboard-tile--wide")}
    >
      <Icon aria-hidden="true" strokeWidth={1.6} />
      <span className="dashboard-tile-body">
        <span className="dashboard-tile-title">{title}</span>
        <span className="dashboard-tile-description">{description}</span>
      </span>
      {hasCount && <span className="dashboard-tile-count" aria-hidden="true">{count}</span>}
    </Link>
  );
});

export interface DashboardCompactTileProps {
  id: string;
  icon: LucideIcon;
  title: string;
  to: string;
  count?: number | null;
  countLabel?: string;
  testIdPrefix?: string;
}

export const DashboardCompactTile = forwardRef<HTMLAnchorElement, DashboardCompactTileProps>(function DashboardCompactTile({
  id,
  icon: Icon,
  title,
  to,
  count,
  countLabel = "počet",
  testIdPrefix = "dashboard",
}, ref) {
  const hasCount = typeof count === "number" && count > 0;
  return (
    <Link
      ref={ref}
      to={to}
      onKeyDown={activateWithSpace}
      aria-label={hasCount ? `${title}, ${countLabel}: ${count}` : undefined}
      data-testid={`${testIdPrefix}-tile-${id}`}
      className={cn(buttonVariants({ variant: "outline" }), "dashboard-compact-tile")}
    >
      <Icon aria-hidden="true" strokeWidth={1.8} />
      <span>{title}</span>
      {hasCount && <span className="dashboard-compact-tile-count" aria-hidden="true">{count}</span>}
    </Link>
  );
});
