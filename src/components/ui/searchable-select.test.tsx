import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SearchableSelect } from "./searchable-select";
import { practiceLessonSelectOptions } from "@/lib/student-practice-lessons";
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
  lessons: [{ id: "l3", title: "Zlomky", textbook: "Matematika 7", subject: "Matematika" }],
}];

function Host({ allowNone = false }: { allowNone?: boolean }) {
  const [value, setValue] = useState(allowNone ? "none" : "");
  return <>
    <SearchableSelect
      value={value}
      onValueChange={setValue}
      options={practiceLessonSelectOptions(groups, [], allowNone)}
      label="Hledat lekci"
      triggerLabel="Lekce pro studijní pomůcku"
      emptySearchMessage="Nic jsme nenašli. Zkus jiné slovo."
      showSelectedSubtitle
      growing
    />
    <output aria-label="Vybrané ID">{value}</output>
  </>;
}

afterEach(cleanup);

describe("Sdílený SearchableSelect pro lekce", () => {
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
    expect(screen.getByText("Nic jsme nenašli. Zkus jiné slovo.", { selector: "p" })).toBeInTheDocument();
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

  it("ponechá připnutou volbu první a po filtrování zobrazí jen neprázdné předmětové skupiny", () => {
    render(<Host allowNone />);
    fireEvent.click(screen.getByRole("combobox", { name: "Lekce pro studijní pomůcku" }));
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Bez konkrétní lekce");
    expect(Array.from(document.querySelectorAll("[cmdk-group-heading]")).map((node) => node.textContent))
      .toEqual(["Společenské vědy", "Matematika"]);

    const input = screen.getByRole("combobox", { name: "Hledat lekci" });
    fireEvent.change(input, { target: { value: "SPOLECENSKE VEDY" } });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.queryByText("Matematika", { selector: "[cmdk-group-heading]" })).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "matematika 7" } });
    expect(screen.getByText("Matematika", { selector: "[cmdk-group-heading]" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Zlomky/ })).toBeInTheDocument();
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Bez konkrétní lekce");

    fireEvent.change(input, { target: { value: "neexistuje" } });
    expect(screen.getByText("Nic jsme nenašli. Zkus jiné slovo.", { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(document.querySelectorAll("[cmdk-group-heading]")).toHaveLength(0);
  });

  it("upřednostní naposledy procvičovanou lekci uvnitř skupin a ostatní ponechá v pořadí", () => {
    expect(practiceLessonSelectOptions([groups[0]], ["l2"]).map((lesson) => lesson.value)).toEqual(["l2", "l1"]);
    expect(practiceLessonSelectOptions(groups).map((lesson) => lesson.value)).toEqual(["l1", "l2", "l3"]);
  });

  it("zobrazí hledání přesně od osmi položek a kratší běžný výběr nepřidává skupiny", () => {
    const makeOptions = (count: number) => Array.from({ length: count }, (_, index) => ({ value: `${index}`, label: `Volba ${index + 1}` }));
    const { unmount } = render(<SearchableSelect value="" onValueChange={() => {}} options={makeOptions(8)} label="Hledat volbu" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Hledat volbu" }));
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(document.querySelectorAll("[cmdk-group-heading]")).toHaveLength(0);
    unmount();

    render(<SearchableSelect value="" onValueChange={() => {}} options={makeOptions(7)} label="Hledat volbu" />);
    fireEvent.click(screen.getByRole("combobox", { name: "Hledat volbu" }));
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });
});
