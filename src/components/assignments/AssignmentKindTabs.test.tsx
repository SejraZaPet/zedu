import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssignmentKindTabs from "./AssignmentKindTabs";

const items = [{ id: "t", settings: {} }, { id: "m", settings: { kind: "material" } }];
const empty = { task: "Žádné úkoly", material: "Žádné materiály", announcement: "Žádná oznámení" };
const ui = (url = "/", onAdd = vi.fn()) => render(<MemoryRouter initialEntries={[url]}>
  <AssignmentKindTabs teacher items={items} storageKey="k" onAdd={onAdd} empty={empty}
    render={(_k, list) => <ul>{list.map((i) => <li key={i.id}>{i.id}</li>)}</ul>} />
</MemoryRouter>);

describe("AssignmentKindTabs", () => {
  beforeEach(() => localStorage.clear());
  it("výchozí sekce Úkoly a tlačítko Přidat úkol", () => {
    const onAdd = vi.fn(); ui("/", onAdd);
    expect(screen.getByText("t")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Přidat úkol/ }));
    expect(onAdd).toHaveBeenCalledWith("task");
  });
  it("?sekce=oznameni ukáže prázdný stav a Přidat oznámení", () => {
    const onAdd = vi.fn(); ui("/?sekce=oznameni", onAdd);
    expect(screen.getByTestId("kind-empty")).toHaveTextContent("Žádná oznámení");
    fireEvent.click(screen.getByRole("button", { name: /Přidat oznámení/ }));
    expect(onAdd).toHaveBeenCalledWith("announcement");
  });
  it("přepnutí si pamatuje v localStorage", () => {
    ui(); fireEvent.click(screen.getByTestId("kind-tab-material"));
    expect(screen.getByText("m")).toBeInTheDocument();
    expect(localStorage.getItem("k")).toBe("materialy");
  });
});
