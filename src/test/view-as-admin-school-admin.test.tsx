import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const session = { user: { id: "u1" } } as any;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "user_roles"
            ? Promise.resolve({ data: [{ role: "admin" }, { role: "school_admin" }, { role: "teacher" }], error: null })
            : { single: () => Promise.resolve({ data: { status: "approved", preferred_view: "school_admin" }, error: null }) },
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

const Probe = () => {
  const { role, realRole, viewAsRole, setViewAsRole, canSwitchSchoolView } = useAuth();
  return (
    <div>
      <span data-testid="role">{role ?? "-"}</span>
      <span data-testid="real">{realRole ?? "-"}</span>
      <span data-testid="viewas">{viewAsRole ?? "-"}</span>
      <span data-testid="canswitch">{String(canSwitchSchoolView)}</span>
      <button onClick={() => setViewAsRole("teacher")}>as-teacher</button>
    </div>
  );
};

describe("view-as pro admin + school_admin + teacher", () => {
  beforeEach(() => localStorage.clear());

  it("nedegraduje systémového admina kvůli preferred_view a umožní view-as", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("real").textContent).toBe("admin"));
    // preferred_view = school_admin nesmí přepsat systémovou roli admin
    expect(screen.getByTestId("role").textContent).toBe("admin");
    expect(screen.getByTestId("canswitch").textContent).toBe("false");

    await act(async () => {
      screen.getByText("as-teacher").click();
    });

    expect(screen.getByTestId("viewas").textContent).toBe("teacher");
    expect(screen.getByTestId("role").textContent).toBe("teacher");
  });
});
