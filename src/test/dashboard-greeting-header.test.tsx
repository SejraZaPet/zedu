import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/dashboard/DashboardBanners", () => ({
  default: ({ className }: { className?: string }) => <div data-testid="banner-slot" className={className} />,
}));
import DashboardGreetingHeader from "@/components/dashboard/DashboardGreetingHeader";

describe("DashboardGreetingHeader", () => {
  it("pořadí: pozdrav, banner, tlačítka; banner na desktopu v řádku, jinak zalomený pod", () => {
    render(<DashboardGreetingHeader identity={<h1>Ahoj</h1>} actions={<button>Novinky</button>} />);
    const h = screen.getByRole("heading"), slot = screen.getByTestId("banner-slot"), btn = screen.getByRole("button");
    expect(h.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(slot.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const c of ["order-last", "basis-full", "lg:order-none", "lg:flex-1", "lg:max-w-[560px]"]) expect(slot.className).toContain(c);
  });
  it("bez bannerů se slot nevykreslí", () => {
    render(<DashboardGreetingHeader identity={<h1>Ahoj</h1>} showBanners={false} />);
    expect(screen.queryByTestId("banner-slot")).toBeNull();
  });
});
