/**
 * Verifies the behaviour around the three seeded test accounts:
 *   student@test.zedu.cz, ucitel@test.zedu.cz, admin@test.zedu.cz
 *
 * Confirms that when the AuthContext reports `status="approved"` (the value
 * stored in the DB for these accounts), <ProtectedRoute> renders its children
 * and does NOT show the "Účet čeká na schválení" screen.
 *
 * Run: bunx vitest run src/test/test-accounts.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/SiteFooter", () => ({ default: () => null }));

const authState: any = {
  isLoggedIn: true,
  user: { id: "test-user-id" },
  role: "user",
  status: "approved",
  loading: false,
};
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { status: "approved" }, error: null }),
        }),
      }),
    }),
  },
}));

const TEST_ACCOUNTS = [
  { email: "student@test.zedu.cz", role: "user" },
  { email: "ucitel@test.zedu.cz", role: "teacher" },
  { email: "admin@test.zedu.cz", role: "admin" },
];

describe("Test accounts – ProtectedRoute", () => {
  beforeEach(() => cleanup());

  it.each(TEST_ACCOUNTS)(
    "$email (role $role) with status=approved sees protected content, NOT the pending screen",
    ({ role }) => {
      authState.status = "approved";
      authState.role = role;
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div>SECRET_CONTENT</div>
          </ProtectedRoute>
        </MemoryRouter>,
      );
      expect(screen.getByText("SECRET_CONTENT")).toBeInTheDocument();
      expect(screen.queryByText(/čeká na schválení/i)).not.toBeInTheDocument();
    },
  );

  it("shows the pending screen only when status is explicitly 'pending'", () => {
    authState.status = "pending";
    authState.role = "user";
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>SECRET_CONTENT</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText(/čeká na schválení/i)).toBeInTheDocument();
    expect(screen.queryByText("SECRET_CONTENT")).not.toBeInTheDocument();
  });
});
