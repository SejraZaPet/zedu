import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalContainerContext } from "@/components/ui/portal-container";

describe("popup portal container", () => {
  it("SelectContent renders inside the provided overlay element, not body", () => {
    const stage = document.createElement("div");
    document.body.appendChild(stage);
    render(<PortalContainerContext.Provider value={stage}><Select open value="a"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">Třída A</SelectItem></SelectContent></Select></PortalContainerContext.Provider>);
    expect(stage.querySelector('[role="listbox"]')).not.toBeNull();
  });
  it("without a provider it still portals to body", () => {
    render(<Select open value="a"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">X</SelectItem></SelectContent></Select>);
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull();
  });
});
