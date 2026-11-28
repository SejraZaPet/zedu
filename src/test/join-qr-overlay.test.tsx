import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import JoinQrOverlay from "@/components/live/JoinQrOverlay";

function Harness() {
  const [open, setOpen] = useState(false);
  return (<div><button aria-label="Zobrazit QR kód pro připojení" onClick={() => setOpen((v) => !v)}>Kód 123456</button>{open && <JoinQrOverlay gameCode="123456" onClose={() => setOpen(false)} />}</div>);
}

describe("JoinQrOverlay", () => {
  it("opens on click and closes on Escape", () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Zobrazit QR kód pro připojení"));
    const dlg = screen.getByTestId("join-qr-overlay");
    expect(dlg.querySelector("svg")).toBeTruthy();
    expect(dlg.textContent).toContain("/live/pripojit?code=123456");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("join-qr-overlay")).toBeNull();
  });
});
