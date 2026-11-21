import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentMethods from "@/pages/StudentMethods";

const mocks = vi.hoisted(() => ({ notebookCount: 9, pageCount: 9 }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: "student-1" } } } })) },
    from: vi.fn((table: string) => {
      if (table === "notebooks") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                order: async () => ({ data: Array.from({ length: mocks.notebookCount }, (_, index) => ({ id: `n${index + 1}`, title: `Sešit ${index + 1}` })) }),
              }),
            }),
          }),
        };
      }
      if (table === "notebook_pages") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: Array.from({ length: mocks.pageCount }, (_, index) => ({ id: `p${index + 1}`, page_order: index, content: { textBoxes: [{ text: `Text stránky ${index + 1}` }] } })) }),
            }),
          }),
        };
      }
      if (table === "study_methods") {
        return { select: () => ({ order: async () => ({ data: [{ id: "m1", name: "Pět kroků", slug: "pet-kroku", description: null, icon: null, steps_json: null }] }) }) };
      }
      return { select: () => ({ eq: async () => ({ data: [] }) }) };
    }),
  },
}));
vi.mock("@/hooks/useStudentPracticeLessons", () => ({ useStudentPracticeLessons: () => ({ data: [], isPending: false, isError: false, isFetching: false, refetch: vi.fn() }) }));
vi.mock("@/components/student/StudentLearningHome", () => ({ default: () => null }));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/SiteFooter", () => ({ default: () => null }));
vi.mock("@/lib/demo", () => ({ useDemoPair: () => null }));

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
Element.prototype.scrollIntoView = () => {};

async function openNotebookSource() {
  render(<MemoryRouter><StudentMethods /></MemoryRouter>);
  fireEvent.click(await screen.findByText("Pět kroků"));
  fireEvent.click(screen.getByRole("button", { name: "Procvičit" }));
  const source = screen.getByRole("combobox", { name: "Zdroj" });
  fireEvent.click(source);
  fireEvent.keyDown(source, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Stránka mého sešitu" }));
}

beforeEach(() => { mocks.notebookCount = 9; mocks.pageCount = 9; });
afterEach(cleanup);

describe("Výběr sešitu a stránky při procvičování", () => {
  it("od devíti položek nabídne hledání sešitu i stránky a zachová jejich ID", async () => {
    await openNotebookSource();
    const notebookTrigger = await screen.findByRole("combobox", { name: "Hledat sešit" });
    fireEvent.click(notebookTrigger);
    expect(screen.getAllByRole("option")).toHaveLength(9);
    fireEvent.change(screen.getByPlaceholderText("Hledat sešit…"), { target: { value: "SESIT 9" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "Sešit 9" }));

    const pageTrigger = await screen.findByRole("combobox", { name: "Hledat stránku" });
    fireEvent.click(pageTrigger);
    expect(screen.getAllByRole("option")).toHaveLength(9);
    fireEvent.change(screen.getByPlaceholderText("Hledat stránku…"), { target: { value: "STRANA 9" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: /Strana 9/ }));
    expect(pageTrigger).toHaveTextContent("Strana 9");
  });

  it("u osmi a méně položek ponechá původní jednoduchý výběr", async () => {
    mocks.notebookCount = 8;
    await openNotebookSource();
    expect(await screen.findByRole("combobox", { name: "Sešit" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Hledat sešit" })).not.toBeInTheDocument();
  });
});
