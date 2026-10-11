import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({ assignments: [] as any[], updates: [] as any[] }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "teacher-1" } } })) },
    from: (table: string) => {
      const builder: any = {};
      ["select", "eq", "neq", "in", "is", "not", "order", "limit", "range"].forEach((k) => { builder[k] = () => builder; });
      builder.single = () => Promise.resolve({ data: null, error: null });
      builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
      builder.then = (res: any) => (table === "assignments" ? Promise.resolve({ data: state.assignments, error: null }) : Promise.resolve({ data: [], error: null })).then(res);
      builder.update = (patch: any) => ({ eq: () => { state.updates.push(patch); return Promise.resolve({ data: null, error: null }); } });
      builder.insert = () => ({ select: () => Promise.resolve({ data: [], error: null }) });
      builder.delete = () => ({ eq: () => Promise.resolve({ data: null, error: null }) });
      return builder;
    },
  },
}));
const myClass = { id: "class-1", name: "1.A" };
const noGroups: any[] = [];
vi.mock("@/hooks/useTeacherClasses", () => ({ useTeacherClasses: () => ({ classes: [myClass], myClasses: [myClass], schoolClasses: [myClass], refetch: vi.fn() }), claimSchoolClass: vi.fn() }));
vi.mock("@/hooks/useSubjectGroups", () => ({ useSubjectGroups: () => ({ groups: noGroups }) }));
vi.mock("@/components/SiteHeader", () => ({ default: () => <div /> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <div /> }));
vi.mock("@/components/admin/AssignmentDetailDialog", () => ({ default: () => <div /> }));
vi.mock("@/components/admin/AssignmentResultsDashboard", () => ({ default: () => <div /> }));
vi.mock("@/components/notifications/RemindButton", () => ({ default: () => <div /> }));
vi.mock("@/components/assignments/TeacherAssignmentAttachments", () => ({ default: () => <div /> }));
vi.mock("@/components/assignments/AssignmentMaterialsEditor", () => ({ default: () => <div /> }));
vi.mock("@/components/assignments/AssignmentDescriptionEditor", () => ({ default: () => <div /> }));
vi.mock("@/components/subjects/SubjectPicker", () => ({ default: () => <div /> }));

console.log("MARK: before import");
import TeacherAssignments from "@/pages/TeacherAssignments";
console.log("MARK: after import");

describe("dbg", () => {
  it("renders", async () => {
    state.assignments = [{ id: "a-1", title: "T", description: "", status: "published", deadline: null, materials: [], max_attempts: 1, randomize_choices: false, randomize_order: false, class_id: "class-1", group_id: null, created_at: "2026-01-01T00:00:00Z", activity_data: [], subject_id: null, scheduled_publish_at: null }];
    console.log("MARK: before render");
    render(<MemoryRouter><TeacherAssignments /></MemoryRouter>);
    console.log("MARK: after render");
    await new Promise((r) => setTimeout(r, 3000));
    console.log("MARK: after wait, body buttons:", document.querySelectorAll("button").length);
    console.log("MARK: body text head:", document.body.textContent?.slice(0, 300));
    expect(true).toBe(true);
  });
});
