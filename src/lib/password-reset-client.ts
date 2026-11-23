export const INVALID_RESET_LINK_MESSAGE = "Odkaz je neplatný nebo vypršel.";
export const GENERIC_RESET_ERROR_MESSAGE = "Heslo se nepodařilo změnit. Zkuste to prosím znovu.";

export type PasswordResetFailure = {
  code: string;
  message: string;
};

type Payload = { code?: unknown; error?: unknown } | null | undefined;
type FunctionErrorLike = {
  message?: string;
  context?: { json?: () => Promise<unknown> } | null;
} | null;

async function readPayload(data: Payload, fnErr: FunctionErrorLike): Promise<Payload> {
  if (data && typeof data.error === "string") return data;
  if (!fnErr?.context || typeof fnErr.context.json !== "function") return data;
  try {
    const payload = await fnErr.context.json();
    return payload && typeof payload === "object" ? payload as Payload : data;
  } catch {
    return data;
  }
}

/** FunctionsHttpError nedoručuje odpověď v data; čteme proto také fnErr.context.json(). */
export async function resolvePasswordResetFailure(
  data: Payload,
  fnErr: FunctionErrorLike,
): Promise<PasswordResetFailure> {
  const payload = await readPayload(data, fnErr);
  const code = typeof payload?.code === "string" ? payload.code : "";
  const message = typeof payload?.error === "string" ? payload.error : "";

  // Zpětná kompatibilita s odpovědí staré funkce, která ještě nemá strojový kód.
  if (code === "invalid_token" || (!code && /odkaz je neplatný nebo vypršel/i.test(message))) {
    return { code: "invalid_token", message: INVALID_RESET_LINK_MESSAGE };
  }
  return {
    code: code || "reset_failed",
    message: message || GENERIC_RESET_ERROR_MESSAGE,
  };
}
