import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Formulář úkolu v TeacherAssignments:
 * - u už publikované úlohy se zobrazí jen "Uložit změny" a uložení nesmí
 *   změnit status ani nastavit scheduled_publish_at (žádné notifikace),
 * - u konceptu zůstávají původní tři tlačítka (koncept / naplánovat / publikovat).
 */

const state = vi.hoisted(() => ({
  assignments: [] as any[],
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "teacher-1" } } })) },
    from: (table: string) => {
      const builder: any = {};
      const chain = () => builder;
      ["select", "eq", "neq", "in", "is", "not", "order", "limit", "range"].forEach((k) => {
        builder[k] = chain;
      });
      builder.single = () => Promise.resolve({ data: null, error: null });
      builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
      builder.then = (res: any) => {
        if (table === "assignments") {
          return Promise.resolve({ data: state.assignments, error: null }).then(res);
        }
        return Promise.resolve({ data: [], error: null }).then(res);
      };
      builder.update = (patch: Record<string, unknown>) => ({
        eq: () => {
          state.updates.push(patch);
          return Promise.resolve({ data: null, error: null });
        },
      });
      builder.insert = () => ({ select: () => Promise.resolve({ data: [], error: null }) });
      builder.delete = () => ({ eq: () => Promise.resolve({ data: null, error: null }) });
      return builder;
    },
  },
}));

const myClass = { id: "class-1", name: "1.A" };
vi.mock("@/hooks/useTeacherClasses", () => ({
  useTeacherClasses: () => ({
    classes: [myClass],
    myClasses: [myClass],
    schoolClasses: [myClass],
    refetch: vi.fn(),
  }),
  claimSchoolClass: vi.fn(),
}));
vi.mock("@/hooks/useSubjectGroups", () => ({ useSubjectGroups: () => ({ groups: [] }) }));

vi.mock("@/components/SiteHeader", () => ({ default: () => <div /> }));
vi.mock("@/components/SiteFooter", () => ({ default: () => <div /> }));
vi.mock("@/components/admin/AssignmentDetailDialog", () => ({ default: () => <div /> }));
vi.mock("@/components/admin/AssignmentResultsDashboard", () => ({ default: () => <div /> }));
vi.mock("@/components/notifications/RemindButton", () => ({ default: () => <div /> }));
vi.mock("@/components/assignments/TeacherAssignmentAttachments", () => ({ default: () => <div /> }));
vi.mock("@/components/assignments/AssignmentMaterialsEditor", () => ({ default: () => <div /> }));
vi.mock("@/components/assignments/AssignmentDescriptionEditor", () => ({ default: () => <div /> }));
vi.mock("@/components/subjects/SubjectPicker", () => ({ default: () => <div /> }));

import TeacherAssignments from "@/pages/TeacherAssignments";

const baseAssignment = (over: Partial<any> = {}) => ({
  id: "a-1",
  title: "Testovací úloha",
  description: "",
  status: "published",
  deadline: null,
  materials: [],
  max_attempts: 1,
  randomize_choices: false,
  randomize_order: false,
  class_id: "class-1",
  group_id: null,
  created_at: "2026-01-01T00:00:00Z",
  activity_data: [],
  worksheet_id: null,
  lesson_id: null,
  lesson_source: null,
  exam_type: null,
  group_mode: null,
  group_size: null,
  subject_id: null,
  scheduled_publish_at: null,
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/ucitel/ulohy"]}>
      <TeacherAssignments />
    </MemoryRouter>,
  );

const openEdit = async () => {
  renderPage();
  await screen.findByText("Testovací úloha");
  const editButton = await screen.findByRole("button", { name: "Upravit" });
  fireEvent.click(editButton);
  await screen.findByText("Upravit úlohu");
};

beforeAll(() => {
  (Element.prototype as any).scrollIntoView = () => {};
  (window as any).scrollTo = () => {};
});

beforeEach(() => {
  state.updates = [];
  state.assignments = [];
});

describe("TeacherAssignments formulář – ukládání publikované úlohy", () => {
  it("u publikované úlohy zobrazí jen „Uložit změny“ a uložení nezmění stav", async () => {
    state.assignments = [
      baseAssignment({ status: "published", scheduled_publish_at: null }),
    ];
    await openEdit();

    // Jen "Uložit změny" – žádná původní tři tlačítka.
    expect(screen.getByRole("button", { name: "Uložit změny" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Uložit koncept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Naplánovat" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Publikovat" })).toBeNull();

    // Volitelná poznámka v formuláři.
    expect(
      screen.getByText("Úkol je publikovaný, změny se projeví žákům hned po uložení."),
    ).toBeTruthy();

    // Uložení: status zůstává published, scheduled_publish_at se vynuluje,
    // žádný patch neobsahuje status (žádné notifikace).
    fireEvent.click(screen.getByRole("button", { name: "Uložit změny" }));

    await waitFor(() => expect(state.updates.length).toBe(1));
    const patch = state.updates[0];
    expect(patch.status).toBeUndefined();
    expect(patch.scheduled_publish_at).toBeNull();
    expect(patch.title).toBe("Testovací úloha");
  });

  it("u konceptu zůstávají původní tři tlačítka", async () => {
    state.assignments = [baseAssignment({ status: "draft" })];
    await openEdit();

    expect(screen.getByRole("button", { name: "Uložit koncept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Naplánovat" })).toBeTruthy();
    // "Publikovat" je ve formuláři i v řádku konceptu v seznamu.
    expect(screen.getAllByRole("button", { name: "Publikovat" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Uložit změny" })).toBeNull();
  });
});
