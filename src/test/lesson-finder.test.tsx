import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LessonFinder from "@/components/lessons/LessonFinder";
vi.mock("@/lib/subjects-catalog", () => ({ fetchSubjectCatalog: async () => [{ name: "Technologie" }] }));
import {
  EMPTY_FILTERS, facetOptions, filterFinderItems, highlightParts, sortFinderItems, PAGE_SIZE, type FinderItem,
} from "@/lib/lesson-finder";

const items: FinderItem[] = [
  { id: "1", title: "Příprava pokrmů", textbookId: "b1", textbookTitle: "Potraviny", subject: "potraviny_a_vyziva", topic: "Kuchyně", updatedAt: "2026-01-01", sortOrder: 1 },
  { id: "2", title: "Počítač a sítě", textbookId: "b2", textbookTitle: "Technologie", subject: "Technologie", updatedAt: "2026-03-01", sortOrder: 1 },
  { id: "3", title: "Příprava dokumentů", textbookId: "b3", textbookTitle: "Administrativa", subject: "Administrativa", updatedAt: "2026-02-01", sortOrder: 2 },
  { id: "4", title: "Tisk", textbookId: "b2", textbookTitle: "Technologie", subject: "technologie", sortOrder: 2 },
];

describe("hledání a filtry lekcí", () => {
  it("hledá bez diakritiky a velikosti písmen", () => {
    expect(filterFinderItems(items, { ...EMPTY_FILTERS, query: "PRIPRAVA" }).map((i) => i.id)).toEqual(["1", "3"]);
    expect(filterFinderItems(items, { ...EMPTY_FILTERS, query: "vyziva" }).map((i) => i.id)).toEqual(["1"]);
  });
  it("najde i jiný pád slova („příprava“ → „přípravě“)", () => {
    const extra = [...items, { id: "5", title: "Práce v předběžné přípravě", textbookId: "b2", textbookTitle: "Technologie", subject: "technologie" }];
    expect(filterFinderItems(extra, { ...EMPTY_FILTERS, query: "příprava" }).map((i) => i.id)).toEqual(["1", "3", "5"]);
  });
  it("kombinuje filtry a sjednotí kód a název předmětu", () => {
    const tech = facetOptions(items, EMPTY_FILTERS, "subject").find((f) => f.value === "technologie");
    expect(tech?.count).toBe(2);
    expect(filterFinderItems(items, { ...EMPTY_FILTERS, subject: "technologie", query: "tisk" }).map((i) => i.id)).toEqual(["4"]);
    expect(filterFinderItems(items, { ...EMPTY_FILTERS, subject: "technologie", book: "b1" })).toEqual([]);
  });
  it("počty filtru učebnice respektují ostatní filtry", () => {
    const books = facetOptions(items, { ...EMPTY_FILTERS, query: "priprava" }, "book");
    expect(books.map((b) => [b.label, b.count])).toEqual([["Administrativa", 1], ["Potraviny", 1]]);
  });
  it("řadí podle nejnovější úpravy, A–Z a stabilně", () => {
    expect(sortFinderItems(items, "recent").map((i) => i.id)).toEqual(["2", "3", "1", "4"]);
    expect(sortFinderItems(items, "az")[0].id).toBe("2");
  });
  it("zvýrazní shodu i s diakritikou", () => {
    expect(highlightParts("Příprava pokrmů", "priprava")).toEqual([{ text: "Příprav", hit: true }, { text: "a pokrmů", hit: false }]);
  });
  it("nikdy nepřidá položku mimo předané (cizí lekce se nenabídne)", () => {
    const out = filterFinderItems(items, { ...EMPTY_FILTERS, query: "a" });
    expect(out.every((o) => items.includes(o))).toBe(true);
  });
});

describe("LessonFinder", () => {
  it("prázdný výsledek ukáže hlášku a zrušení filtrů", () => {
    render(<LessonFinder items={items} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "xyz" } });
    expect(screen.getByText(/Nic nenalezeno/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /Zrušit filtry/ })[0]);
    expect(screen.getByText("Nalezeno 4 z 4")).toBeTruthy();
  });
  it("1200 lekcí: zobrazí po částech, nic tiše neusekne", () => {
    const many = Array.from({ length: 1200 }, (_, i) => ({ id: `l${i}`, title: `Lekce ${i}`, textbookId: "b", textbookTitle: "Kniha", sortOrder: i }));
    const onSelect = vi.fn();
    render(<LessonFinder items={many} onSelect={onSelect} />);
    expect(screen.getByText("Nalezeno 1200 z 1200")).toBeTruthy();
    const more = screen.getByRole("button", { name: `Zobrazit další (${1200 - PAGE_SIZE})` });
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: `Zobrazit další (${1200 - 2 * PAGE_SIZE})` })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "lekce 1199" } });
    fireEvent.click(screen.getByRole("button", { name: /Lekc\s?e 1199/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "l1199" }));
  });
});
