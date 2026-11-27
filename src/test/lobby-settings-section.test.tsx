import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LobbySettingsSection } from "@/components/live/LobbySettingsSection";

const ui = () => render(
  <div>
    <p>QR</p>
    <LobbySettingsSection title="Herní režim" summary="Klasický kvíz · Bez týmů">
      {(close) => <button onClick={close}>Závod</button>}
    </LobbySettingsSection>
  </div>,
);

describe("LobbySettingsSection", () => {
  it("je výchozí zavřená a po výběru režimu se zavře", () => {
    ui();
    const t = screen.getByRole("button", { name: /Herní režim/ });
    expect(t).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Závod")).toBeNull();
    fireEvent.click(t);
    fireEvent.click(screen.getByText("Závod"));
    expect(t).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Závod")).toBeNull();
  });
  it("zavře se klávesou Esc i klepnutím mimo", () => {
    ui();
    const t = screen.getByRole("button", { name: /Herní režim/ });
    fireEvent.click(t);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(t).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(t);
    fireEvent.pointerDown(screen.getByText("QR"));
    expect(t).toHaveAttribute("aria-expanded", "false");
  });
});
