import { describe, it, expect } from "vitest";
import { notificationTypeSendsEmail } from "../../supabase/functions/_shared/notification-email-types";

describe("e-mailové kopie notifikací", () => {
  it("odevzdání úkolu učiteli e-mail neposílá", () => expect(notificationTypeSendsEmail("assignment_submitted")).toBe(false));
  it.each(["assignment_new", "assignment_deadline_soon", "reminder", "assignment_feedback", "new_message"])("%s e-mail posílá dál", (t) =>
    expect(notificationTypeSendsEmail(t)).toBe(true));
});
