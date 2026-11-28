import { describe, expect, it } from "vitest";
import { gatewayLimitError } from "../../supabase/functions/process-file-content/gateway-error";

describe("process-file-content – chyby kreditu a zatížení", () => {
  it("402 zůstává 402 s rozlišitelným kódem", () => {
    expect(gatewayLimitError(402)).toMatchObject({ status: 402, error: "AI_PAYMENT_REQUIRED" });
  });
  it("429 zůstává 429 s rozlišitelným kódem", () => {
    expect(gatewayLimitError(429)).toMatchObject({ status: 429, error: "AI_RATE_LIMITED" });
  });
  it("jiná chyba se nevydává za nedostatek kreditu", () => {
    expect(gatewayLimitError(500)).toBeNull();
  });
});