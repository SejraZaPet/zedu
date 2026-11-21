import { forwardRef } from "react";
import {
  DashboardTile,
  type DashboardTileProps,
  type DashboardTileTone,
} from "./DashboardTile";

export type TeacherTileTone = Extract<DashboardTileTone, "subjects" | "textbooks" | "assignments" | "studio" | "review" | "teaching" | "preparation" | "classes">;
type Props = Omit<DashboardTileProps, "tone" | "testIdPrefix"> & { tone: TeacherTileTone };

/** The teacher-specific tone is the only difference; behavior stays shared with students. */
const TeacherDashboardTile = forwardRef<HTMLAnchorElement, Props>(function TeacherDashboardTile(props, ref) {
  return <DashboardTile {...props} ref={ref} testIdPrefix="teacher" />;
});

export default TeacherDashboardTile;
