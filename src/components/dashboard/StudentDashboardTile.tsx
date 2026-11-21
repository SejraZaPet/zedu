import { forwardRef } from "react";
import {
  DashboardCompactTile,
  DashboardTile,
  type DashboardCompactTileProps,
  type DashboardTileProps,
  type DashboardTileTone,
} from "./DashboardTile";

export type StudentTileTone = Extract<DashboardTileTone, "learn" | "textbooks" | "assignments" | "notebook" | "portfolio" | "schedule">;
type StudentDashboardTileProps = Omit<DashboardTileProps, "tone" | "testIdPrefix"> & { tone: StudentTileTone };
type StudentDashboardCompactTileProps = Omit<DashboardCompactTileProps, "testIdPrefix">;

export const StudentDashboardTile = forwardRef<HTMLAnchorElement, StudentDashboardTileProps>(function StudentDashboardTile(props, ref) {
  return <DashboardTile {...props} ref={ref} testIdPrefix="student" />;
});

export const StudentDashboardCompactTile = forwardRef<HTMLAnchorElement, StudentDashboardCompactTileProps>(function StudentDashboardCompactTile(props, ref) {
  return <DashboardCompactTile {...props} ref={ref} testIdPrefix="student" />;
});
