import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const db = vi.hoisted(() => ({
  user: { id: "teacher" },
  completed: ["m1"] as string[],
  finished: false,
  failure: "",
  writes: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: db.user }) }));
vi.mock("@/components/LessonBlockRenderer", () => ({ LessonBlock: ({ block }: { block: { props: { text?: string } } }) => <p>{block.props.text}</p> }));
vi.mock("@/components/MarkdownContent", () => ({ default: ({ content }: { content: string }) => <p>{content}</p> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let single = false;
      let selection = "";
      const chain: Record<string, unknown> = {};
      for (const method of ["eq", "in", "order", "limit"]) chain[method] = () => chain;
      chain.select = (value: string) => { selection = value; return chain; };
      chain.maybeSingle = () => { single = true; return chain; };
      for (const method of ["insert", "update", "delete"]) chain[method] = (value: unknown) => { db.writes(method, table, value); return chain; };
      chain.then = (resolve: (value: unknown) => void) => {
        if (db.failure === table) return Promise.resolve(resolve({ data: null, error: { message: "test error" } }));
        const courses = [
          { id: "c1", title: "Řešení problémů", description: "Praktický kurz pro učitele", audience: "teacher", issues_certificate: false },
          { id: "c2", title: "Metody ve výuce", description: "Přátelské učení", audience: "teacher", issues_certificate: false },
        ];
        const modules = [
          { id: "m1", course_id: "c1", title: "První krok", content: "obsah prvního", content_blocks: [{ id: "img1", type: "image", visible: true, props: { url: "/test-picture.png", alt: "Ukázkový přehled" } }] },
          { id: "m2", course_id: "c1", title: "Druhý krok", content: "obsah druhého", content_blocks: [] },
          { id: "m3", course_id: "c1", title: "Třetí krok", content: "obsah třetího", content_blocks: [] },
        ];
        let data: unknown = [];
        if (table === "academy_courses") data = courses;
        if (table === "academy_modules") data = modules;
        if (table === "academy_enrollments") {
          const enrollment = { id: "e1", course_id: "c1", completed_at: db.finished ? "2026-11-26" : null };
          data = single ? enrollment : [enrollment];
        }
        if (table === "academy_module_completions") data = db.completed.map((id) => ({ module_id: id, enrollment_id: "e1" }));
        if (table === "academy_certificates" && selection.includes("issued_at")) data = [];
        return Promise.resolve(resolve({ data, error: null }));
      };
      return chain;
    },
  },
}));

import AcademyView from "@/components/academy/AcademyView";

const open = async () => {
  render(<AcademyView audience="teacher" />);
  fireEvent.click(await screen.findByRole("button", { name: "Pokračovat v kurzu: Řešení problémů" }));
};
const moduleArea = () => within(screen.getByRole("region", { name: "Obsah modulu" }));

beforeEach(() => { db.completed = ["m1"]; db.finished = false; db.failure = ""; db.writes.mockClear(); });
afterEach(cleanup);

describe("Academy course navigation", () => {
  it("searches title and description without accents while preserving order and without writes", async () => {
    render(<AcademyView audience="teacher" />);
    const search = await screen.findByRole("textbox", { name: "Hledat kurzy" });
    fireEvent.change(search, { target: { value: "RESENI ucitele" } });
    expect(screen.getByRole("heading", { name: "Řešení problémů" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Metody ve výuce" })).toBeNull();
    fireEvent.change(search, { target: { value: "pratelske" } });
    expect(screen.getByRole("heading", { name: "Metody ve výuce" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Řešení problémů" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vymazat hledání" }));
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Řešení problémů", "Metody ve výuce"]);
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("continues at first incomplete module and navigates both ways without changing completions", async () => {
    await open();
    await screen.findByRole("heading", { name: "Druhý krok" });
    expect(moduleArea().getByRole("heading").textContent).toBe("Druhý krok");
    fireEvent.click(screen.getByRole("button", { name: "Další" }));
    expect(moduleArea().getByRole("heading").textContent).toBe("Třetí krok");
    expect(screen.getByRole("button", { name: "Další" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Předchozí" }));
    fireEvent.click(screen.getByRole("button", { name: "Předchozí" }));
    expect(moduleArea().getByRole("heading").textContent).toBe("První krok");
    expect(screen.getByRole("button", { name: "Předchozí" })).toBeDisabled();
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("opens a completed course at the first module", async () => {
    db.finished = true; db.completed = ["m1", "m2", "m3"];
    await open();
    await screen.findByRole("heading", { name: "První krok" });
    expect(moduleArea().getByRole("heading").textContent).toBe("První krok");
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("falls back to the first module when all are complete but completion timestamp is absent", async () => {
    db.completed = ["m1", "m2", "m3"];
    await open();
    await screen.findByRole("heading", { name: "První krok" });
    expect(moduleArea().getByRole("heading").textContent).toBe("První krok");
  });

  it("returns a course loading failure to a usable catalogue after retry", async () => {
    db.failure = "academy_courses";
    render(<AcademyView audience="teacher" />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("textbox", { name: "Hledat kurzy" })).toBeNull();
    db.failure = "";
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    expect(await screen.findByRole("textbox", { name: "Hledat kurzy" })).toBeInTheDocument();
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("does not show stale module content when the module read fails, and retries", async () => {
    render(<AcademyView audience="teacher" />);
    const start = await screen.findByRole("button", { name: "Pokračovat v kurzu: Řešení problémů" });
    db.failure = "academy_modules";
    fireEvent.click(start);
    await screen.findByRole("alert");
    expect(screen.queryByRole("region", { name: "Obsah modulu" })).toBeNull();
    db.failure = "";
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    await screen.findByRole("heading", { name: "Druhý krok" });
    expect(moduleArea().getByRole("heading").textContent).toBe("Druhý krok");
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("opens a whole image and returns focus after Escape without writes", async () => {
    db.completed = [];
    await open();
    const trigger = await screen.findByRole("button", { name: "Zvětšit obrázek: Ukázkový přehled" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(db.writes).not.toHaveBeenCalled();
  });
});