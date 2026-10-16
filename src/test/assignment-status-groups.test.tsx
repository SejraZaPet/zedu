import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssignmentStatusGroups, AssignmentStatusCard } from "@/components/assignments/AssignmentStatusGroups";
import { assignmentStatus } from "@/lib/assignment-status";

afterEach(() => { cleanup(); sessionStorage.clear(); });
const items = [{ id: "1", title: "Čekající", attempts: [] }, { id: "2", title: "Odevzdaný", attempts: [{ status: "submitted", score: null, max_score: null }] }, { id: "3", title: "Hodnocený", attempts: [{ status: "submitted", score: 10, max_score: 13 }] }];
const list = () => <AssignmentStatusGroups items={items} storageKey="test-groups" statusOf={(a) => assignmentStatus(a, a.attempts)} renderItem={(a, status) => <AssignmentStatusCard status={status} title={a.title} />} />;
describe("assignment disclosure", () => {
  it("defaults pending open, submitted and graded closed and remembers a change", () => {
    const view = render(list());
    expect(screen.getByRole("button", { name: "K odevzdání (1)" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Odevzdáno (1)" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Ohodnoceno (1)" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Odevzdáno (1)" }));
    view.unmount(); render(list());
    expect(screen.getByRole("button", { name: "Odevzdáno (1)" })).toHaveAttribute("aria-expanded", "true");
  });
  it("every card exposes a text status and decorative accessible icon", () => {
    render(<AssignmentStatusCard status={assignmentStatus({}, items[2].attempts)} title="Výsledek" />);
    expect(screen.getByText("10 / 13")).toBeInTheDocument();
    expect(document.querySelector(".assignment-state-icon svg")).toHaveAttribute("aria-hidden", "true");
  });
});