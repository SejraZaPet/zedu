import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { activitiesRedirectFor, studioTabFromSearch, STUDIO_ACTIVITIES_HREF, STUDIO_GAMES_HREF } from "@/lib/studio-routes";

const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");

const Loc = () => { const l = useLocation(); return <div data-testid="loc">{l.pathname + l.search}</div>; };

describe("Studio – trasy", () => {
  it("/ucitel/hry přesměruje na /ucitel/studio?tab=hry", () => {
    expect(app).toContain('path="/ucitel/hry" element={<Navigate to="/ucitel/studio?tab=hry" replace />}');
    render(
      <MemoryRouter initialEntries={["/ucitel/hry"]}>
        <Routes>
          <Route path="/ucitel/hry" element={<Navigate to={STUDIO_GAMES_HREF} replace />} />
          <Route path="/ucitel/studio" element={<Loc />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("loc").textContent).toBe("/ucitel/studio?tab=hry");
  });

  it("/aktivity: přihlášený učitel → Studio, nepřihlášený a žák zůstávají", () => {
    for (const r of ["teacher", "lektor", "school_admin", "admin"]) expect(activitiesRedirectFor(true, r)).toBe(STUDIO_ACTIVITIES_HREF);
    expect(activitiesRedirectFor(false, null)).toBeNull();
    expect(activitiesRedirectFor(true, "user")).toBeNull();
    expect(activitiesRedirectFor(true, "rodic")).toBeNull();
    expect(app).toContain('path="/aktivity" element={<ActivitiesPage />}');
  });

  it("záložka se čte z URL, neznámá hodnota = hry", () => {
    expect(studioTabFromSearch("?tab=aktivity")).toBe("aktivity");
    expect(studioTabFromSearch("?tab=hry")).toBe("hry");
    expect(studioTabFromSearch("?tab=xyz")).toBe("hry");
    expect(studioTabFromSearch("")).toBe("hry");
  });

  it("Studio je chráněné pro učitelské role a vnořené herní cesty zůstaly", () => {
    expect(app).toMatch(/path="\/ucitel\/studio" element={<ProtectedRoute allowedRoles={\["teacher", "lektor", "school_admin", "admin"\]}><StudioPage \/>/);
    for (const p of ["/live/ucitel/:sessionId", "/live/projektor/:sessionId", "/live/student/:sessionId", "/hra/ucitel/:sessionId", "/hra/hrac/:sessionId", "/hra/pripojit"]) expect(app).toContain(`path="${p}"`);
  });
});
