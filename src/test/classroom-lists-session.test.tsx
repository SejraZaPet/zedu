import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const auth = { user: null as null | { id: string }, loading: true };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
const mk = (data: unknown[]) => { const c: any = {}; ["select", "eq", "order", "in"].forEach(k => { c[k] = () => c; }); c.then = (res: any) => res({ data, error: null }); return c; };
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: auth.user ? { user: auth.user } : null } }) },
  from: (t: string) => mk(t === "classes" ? [{ id: "c1", name: "[TEST] 7.A" }] : []),
} }));

import { useTeacherClasses } from "@/hooks/useTeacherClasses";

describe("seznam tříd a přihlášení", () => {
  it("bez session se nic nekešuje a po přihlášení se seznam doplní", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(() => useTeacherClasses(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.classes).toEqual([]);
    auth.user = { id: "u1" }; auth.loading = false;
    rerender();
    await waitFor(() => expect(result.current.classes.map(c => c.id)).toEqual(["c1"]));
  });
});
