import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LessonSearchCombobox, { orderedPracticeLessons } from "./LessonSearchCombobox";
import type { PracticeLessonGroup } from "@/lib/student-practice-lessons";

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
Element.prototype.scrollIntoView = () => {};

const groups: PracticeLessonGroup[] = [{
  subject: "Společenské vědy",
  lessons: [
    { id: "l1", title: "Naše mediální krajina", textbook: "Dějepis 8", subject: "Společenské vědy" },
    { id: "l2", title: "První světová válka", textbook: "Dějepis 8", subject: "Společenské vědy" },
  ],
}, {
  subject: "Matematika",
  lessons: [
    { id: "l3", title: "Zlomky", textbook: "Matematika 7", subject: "Matematika" },
  ],
}];

vi.mock("@/hooks/useStudentPracticeLessons", () => ({
  useStudentPracticeLessons: () => ({ data: groups, isPending: false, isError: false, isFetching: false, refetch: vi.fn() }),
}));

function Host({ allowNone = false }: { allowNone?: boolean }) {
  const [value, setValue] = useState(allowNone ? "none" : "");
  return <>
    <LessonSearchCombobox userId="student-1" value={value} onValueChange={setValue} allowNone={allowNone} />
    <output aria-label="Vybrané ID">{value}</output>
  </>;
}

afterEach(cleanup);

describe("Vyhledávací výběr lekce", () => {
  it("hledá kdekoli v názvu bez diakritiky a velikosti písmen", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lekce pro studijní pomůcku" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Hledat lekci" }), { target: { value: "MEDIALNI" } });
    expect(screen.getByRole("option", { name: /Naše mediální krajina/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /První světová válka/ })).not.toBeInTheDocument();
  });

  it("hledá také v učebnici a ukáže přesný prázdný stav", () => {
    render(<Host />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lekce pro studijní pomůcku" }));
    const input = screen.getByRole("combobox", { name: "Hledat lekci" });
    fireEvent.change(input, { target: { value: "dejepis" } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.change(input, { target: { value: "neexistuje" } });
    expect(screen.getByText("Nic jsme nenašli. Zkus jiné slovo.", { selector: '[role="status"]' })).toBeInTheDocument();
  });

  it("podporuje šipky, Enter i Escape a vrací stejné ID lekce", () => {
    render(<Host />);
    const trigger = screen.getByRole("combobox", { name: "Lekce pro studijní pomůcku" });
    fireEvent.click(trigger);
    const input = screen.getByRole("combobox", { name: "Hledat lekci" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = screen.getAllByRole("option").find((option) => option.getAttribute("aria-selected") === "true");
    expect(active).toBeDefined();
    const expectedTitle = active!.textContent;
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByLabelText("Vybrané ID")).toHaveTextContent(/^l[12]$/);
    expect(trigger).toHaveTextContent(expectedTitle!);
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Hledat lekci" }), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("ponechá volbu bez lekce první a po filtrování zobrazí jen neprázdné předmětové skupiny", () => {
    render(<Host allowNone />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lekce pro studijní pomůcku" }));
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Bez konkrétní lekce");
    expect(Array.from(document.querySelectorAll("[cmdk-group-heading]")).map((node) => node.textContent))
      .toEqual(["Společenské vědy", "Matematika"]);

    const input = screen.getByRole("combobox", { name: "Hledat lekci" });
    fireEvent.change(input, { target: { value: "MEDIALNI" } });
    expect(screen.getByText("Společenské vědy", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.queryByText("Matematika", { selector: "[cmdk-group-heading]" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Bez konkrétní lekce");

    fireEvent.change(input, { target: { value: "matematika 7" } });
    expect(screen.getByText("Matematika", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Zlomky/ })).toBeInTheDocument();
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Bez konkrétní lekce");

    fireEvent.change(input, { target: { value: "neexistuje" } });
    expect(screen.getByText("Nic jsme nenašli. Zkus jiné slovo.", { selector: '[role="status"]' })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Bez konkrétní lekce");
    expect(document.querySelectorAll("[cmdk-group-heading]")).toHaveLength(0);
  });

  it("upřednostní naposledy procvičovanou lekci uvnitř skupin a ostatní ponechá ve stávajícím pořadí", () => {
    expect(orderedPracticeLessons([groups[0]], ["l2"]).map((lesson) => lesson.id)).toEqual(["l2", "l1"]);
    expect(orderedPracticeLessons(groups).map((lesson) => lesson.id)).toEqual(["l1", "l2", "l3"]);
  });
});
