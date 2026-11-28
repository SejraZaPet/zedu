/** Only status/code and fixed copy; never echo upstream bodies or document content. */
export function gatewayLimitError(status: number): { status: number; error: string; message: string } | null {
  if (status === 402) return { status, error: "AI_PAYMENT_REQUIRED", message: "Vyčerpaný kredit pro AI. Požádejte správce o doplnění nebo vložte text ručně." };
  if (status === 429) return { status, error: "AI_RATE_LIMITED", message: "Služba AI je právě přetížená. Zkuste dokument nahrát znovu za chvíli." };
  return null;
}