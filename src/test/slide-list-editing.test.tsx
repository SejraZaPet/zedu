import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import type { Block } from "@/lib/textbook-config";

const bulletItems = (): Block =>
  ({ id: "bl", type: "bullet_list", visible: true, props: { items: ["První", "Druhá"] } }) as Block;

const bulletHtml = (): Block =>
  ({ id: "bh", type: "bullet_list", visible: true, props: { html: "<ul><li>První</li></ul>" } }) as Block;

const cardGrid = (): Block =>
  ({
    id: "cg",
    type: "card_grid",
    visible: true,
    props: { columns: 2, cards: [{ title: "Zastaralé nástroje", text: "Práce v nich zdržuje." }] },
  }) as Block;

const renderBlock = (block: Block) => {
  const onChangeBlock = vi.fn();
  render(<SlideBody slide={{ projector: { headline: "H" }, blocks: [block] }} editable onChangeBlock={onChangeBlock} />);
  return onChangeBlock;
};

describe("přidávání odrážek a karet v editoru snímků", () => {
  it("odrážky (items): + Přidat odrážku přidá prázdnou položku", () => {
    const onChangeBlock = renderBlock(bulletItems());
    fireEvent.click(screen.getByText("+ Přidat odrážku"));
    const next = onChangeBlock.mock.calls[0][1](bulletItems());
    expect(next.props.items).toEqual(["První", "Druhá", ""]);
  });

  it("odrážky (items): × odebere položku", () => {
    const onChangeBlock = renderBlock(bulletItems());
    fireEvent.click(screen.getAllByTitle("Smazat odrážku")[0]);
    const next = onChangeBlock.mock.calls[0][1](bulletItems());
    expect(next.props.items).toEqual(["Druhá"]);
  });

  it("odrážky (html): + Přidat odrážku doplní <li> do seznamu", () => {
    const onChangeBlock = renderBlock(bulletHtml());
    fireEvent.click(screen.getByText("+ Přidat odrážku"));
    const next = onChangeBlock.mock.calls[0][1](bulletHtml());
    expect(next.props.html).toBe("<ul><li>První</li><li><br></li></ul>");
  });

  it("karty: + Přidat kartu přidá kartu a × ji odebere", () => {
    const onChangeBlock = renderBlock(cardGrid());
    fireEvent.click(screen.getByText("+ Přidat kartu"));
    const added = onChangeBlock.mock.calls[0][1](cardGrid());
    expect(added.props.cards).toHaveLength(2);

    onChangeBlock.mockClear();
    fireEvent.click(screen.getByTitle("Smazat kartu"));
    const removed = onChangeBlock.mock.calls[0][1](cardGrid());
    expect(removed.props.cards).toHaveLength(0);
  });

  it("karty: text karty je editovatelný na plátně po dvojkliku", () => {
    renderBlock(cardGrid());
    const el = screen.getByText("Zastaralé nástroje");
    // Jeden klik jen vybere blok (kvůli klávesám Delete/Ctrl+C), psaní zapne dvojklik.
    expect(el.getAttribute("contenteditable")).toBe("false");
    fireEvent.doubleClick(el);
    expect(el.getAttribute("contenteditable")).toBe("true");
  });
});
