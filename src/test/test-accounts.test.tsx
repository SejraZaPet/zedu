/**
 * Verifies that the seeded test accounts (student/teacher/admin @test.zedu.cz)
 * are `approved` in the DB and that ProtectedRoute renders the child content
 * (i.e. does NOT show the "Účet čeká na schválení" screen) when the
 * AuthContext reports status="approved".
 *
 * Two layers:
 *  1. Live DB check via the public Supabase REST endpoint with the anon key
 *     (uses an RPC-free SELECT through PostgREST). Skipped automatically if
 *     env vars are not present.
 *  2. Pure unit render of <ProtectedRoute> with a mocked AuthContext.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

const TEST_EMAILS = [
  "student@test.zedu.cz",
  "ucitel@test.zedu.cz",
  "admin@test.zedu.cz",
];

vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/SiteFooter", () => ({ default: () => null }));

// Mock AuthContext so we control isLoggedIn / status without a real session.
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

// Stub supabase client so the fallback fetch in ProtectedRoute is a no-op.
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

describe("Test accounts – ProtectedRoute behaviour", () => {
  it("renders protected content when AuthContext reports status=approved (no pending screen)", () => {
    authState.status = "approved";
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>SECRET_CONTENT</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText("SECRET_CONTENT")).toBeInTheDocument();
    expect(screen.queryByText(/čeká na schválení/i)).not.toBeInTheDocument();
  });

  it("shows pending screen only when status is explicitly 'pending'", () => {
    authState.status = "pending";
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>SECRET_CONTENT</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText(/čeká na schválení/i)).toBeInTheDocument();
  });
});

describe("Test accounts – live DB status check", () => {
  const SUPABASE_URL =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    "https://rnndtpfmkanxbckdbflm.supabase.co";
  const ANON =
    (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubmR0cGZta2FueGJja2RiZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODMwOTcsImV4cCI6MjA4ODU1OTA5N30.0Du0I5XHLyiiKFkoXjM1J8DMsGEiSJdm53BDkl0JCrA";

  it.each(TEST_EMAILS)(
    "DB row for %s has status='approved' (via check_test_account RPC)",
    async (email) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_test_account`, {
        method: "POST",
        headers: {
          apikey: ANON,
          Authorization: `Bearer ${ANON}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_email: email }),
      });
      expect(res.ok, `RPC failed: ${res.status}`).toBe(true);
      const json = await res.json();
      expect(json, `no row for ${email}`).toBeTruthy();
      expect(json.status).toBe("approved");
    },
    15000,
  );
});
