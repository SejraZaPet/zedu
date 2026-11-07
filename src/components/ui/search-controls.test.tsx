import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { SearchField } from "./search-field";
import { SearchableList } from "./searchable-list";
import { matchesSearch } from "@/lib/picker-search";
afterEach(cleanup);
describe("picker interactions", () => {
  it("clears query with Escape and clear command", () => {
    function Host() { const [q, setQ] = useState("zlomky"); return <SearchField value={q} onChange={setQ} label="Hledat" />; }
    render(<Host />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" }); expect((input as HTMLInputElement).value).toBe("");
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Vymazat hledání" })); expect((input as HTMLInputElement).value).toBe("");
  });
  it("selects found without losing hidden selected IDs", () => {
    function Host() {
      const [q, setQ] = useState("zlomky"); const [ids, setIds] = useState(["hidden"]);
      const rows = [{id:"a", title:"Zlomky"}, {id:"b", title:"Čeština"}].filter(r => matchesSearch(q,r.title));
      return <><SearchableList query={q} onQueryChange={setQ} count={rows.length} label="Hledat" selected={ids} foundIds={rows.map(r=>r.id)} onSelectionChange={setIds}><span>{rows.map(r=>r.title).join()}</span></SearchableList><output>{ids.join(",")}</output></>;
    }
    render(<Host />); fireEvent.click(screen.getByRole("button", { name: "Vybrat vše z nalezených" }));
    expect(screen.getByRole("status").textContent).toContain("Nalezeno 1");
    expect(screen.getByText("hidden,a")).toBeTruthy();
  });
});