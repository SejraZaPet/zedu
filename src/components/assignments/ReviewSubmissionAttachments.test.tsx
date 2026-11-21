import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ReviewSubmissionAttachments from "./ReviewSubmissionAttachments";
import type { ReviewAttachment } from "@/lib/review-attachments";

const attachment: ReviewAttachment = {
  id: "file-1",
  assignment_id: "assignment-1",
  student_id: "student-1",
  file_name: "reseni.pdf",
  file_path: "student-1/reseni.pdf",
  file_size: 2048,
};

afterEach(cleanup);

describe("přílohy v panelu Ke kontrole", () => {
  it("u odevzdání s přílohou ukáže její název a poznámku žáka", () => {
    render(<ReviewSubmissionAttachments files={[attachment]} note="Posílám také poznámku." />);

    expect(screen.getByText("reseni.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.0 kB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Otevřít reseni.pdf" })).toBeInTheDocument();
    expect(screen.getByText("Posílám také poznámku.")).toBeInTheDocument();
  });

  it("u odevzdání bez přílohy ukáže prázdný stav", () => {
    render(<ReviewSubmissionAttachments files={[]} note={null} />);

    expect(screen.getByText("Žádné přílohy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Otevřít / })).not.toBeInTheDocument();
  });
});
