import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AssignmentStatusGroups, AssignmentStatusCard, defaultCollapsed, readCollapsed } from "@/components/assignments/AssignmentStatusGroups";
import { assignmentStatus } from "@/lib/assignment-status";

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const items = [{ id: "1", title: "A", deadline: null, attempts: [] }, { id: "2", title: "B", deadline: "2020-01-01T00:00:00Z", attempts: [] }];
const list = (key: string) => <AssignmentStatusGroups items={items} storageKey={key} statusOf={(a) => assignmentStatus(a, a.attempts)} renderItem={(a, s) => <AssignmentStatusCard status={s} title={a.title} />} />;
const btn = (n: string) => screen.getByRole("button", { name: new RegExp(`^${n}`) });

describe("persisted group collapse", () => {
  it("student defaults", () => {
    const d = defaultCollapsed(false);
    expect(d).toMatchObject({ overdue: true, submitted: true, graded: true, material: true, pending: false, announcement: false });
  });
  it("teacher defaults", () => {
    const d = defaultCollapsed(true);
    expect(d).toMatchObject({ review: false, pending: false, graded: true, closed: true, material: true, announcement: true });
  });
  it("saves and restores after remount (navigation/reload)", () => {
    const v = render(list("student:c1"));
    expect(btn("Po termínu")).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(btn("Po termínu")); fireEvent.click(btn("K odevzdání"));
    v.unmount(); render(list("student:c1"));
    expect(btn("Po termínu")).toHaveAttribute("aria-expanded", "true");
    expect(btn("K odevzdání")).toHaveAttribute("aria-expanded", "false");
  });
  it("keys are per page and switch without remount", () => {
    const v = render(list("student:c1"));
    fireEvent.click(btn("K odevzdání"));
    v.rerender(list("student:c2"));
    expect(btn("K odevzdání")).toHaveAttribute("aria-expanded", "true");
    v.rerender(list("student:c1"));
    expect(btn("K odevzdání")).toHaveAttribute("aria-expanded", "false");
  });
  it("survives localStorage errors", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("x"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("x"); });
    expect(readCollapsed("k", false)).toEqual(defaultCollapsed(false));
    render(list("k"));
    fireEvent.click(btn("K odevzdání"));
    expect(btn("K odevzdání")).toHaveAttribute("aria-expanded", "false");
  });
});
