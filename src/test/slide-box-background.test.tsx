import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";

/** Pozadí jednotlivého boxu musí platit i mimo editor (projekce, živá hra). */
describe("pozadí boxu bloku", () => {
  it("použije plnou barvu pozadí boxu", () => {
    render(
      <SlideBody
        slide={{
          blocks: [
            { id: "b1", type: "paragraph", props: { text: "Ahoj", boxBackground: "#ff0055" } },
          ],
          projector: { headline: "Snímek" },
        }}
      />,
    );
    const el = screen.getByText("Ahoj");
    const wrapper = el.closest("[style*='rgb(255, 0, 85)']");
    expect(wrapper).toBeTruthy();
  });

  it("použije barevný přechod pozadí boxu", () => {
    render(
      <SlideBody
        slide={{
          blocks: [
            {
              id: "b2",
              type: "paragraph",
              props: {
                text: "Přechod",
                boxGradient: { from: "#6EC6D9", to: "#9B6CFF", direction: "to right" },
              },
            },
          ],
          projector: { headline: "Snímek" },
        }}
      />,
    );
    const el = screen.getByText("Přechod");
    const wrapper = el.closest("[style*='linear-gradient']");
    expect(wrapper).toBeTruthy();
  });
});
