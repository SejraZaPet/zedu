/** Verze obchodních podmínek, se kterou uživatel souhlasí při registraci. Při změně textu zvýšit. */
export const TERMS_VERSION = "1.0";

/** Souhlas s obchodními podmínkami potvrzují jen samostatně registrovaní učitelé a lektoři. */
export const requiresTermsConsent = (role: string | null | undefined) => role === "teacher" || role === "lektor";

/** Chybová hláška, když registraci nejde odeslat; null = lze odeslat. */
export function registrationConsentError(role: string | null | undefined, consent: boolean): string | null {
  if (consent) return null;
  return requiresTermsConsent(role)
    ? "Pro registraci je nutný souhlas s obchodními podmínkami a vzetí na vědomí zásad ochrany osobních údajů."
    : "Pro registraci je nutný souhlas se zpracováním osobních údajů.";
}
