/**
 * Ořízne výstup AI na počet položek zvolený v průvodci /aktivity.
 * Model občas vrátí víc položek, než bylo požadováno – nastavení musí platit.
 * Čistá funkce bez Deno importů (testovatelná ve Vitestu).
 */
export function limitActivityItems(props: any, max: number | null | undefined): any {
  if (!props || typeof props !== "object" || !max || max < 1) return props;
  const out: any = { ...props };
  const cut = (a: unknown) => (Array.isArray(a) && a.length > max ? a.slice(0, max) : a);
  if (out.trueFalse && typeof out.trueFalse === "object") {
    out.trueFalse = { ...out.trueFalse, statements: cut(out.trueFalse.statements) };
  }
  if (out.matching && typeof out.matching === "object") {
    out.matching = { ...out.matching, left: cut(out.matching.left), right: cut(out.matching.right) };
  }
  if (out.ordering && typeof out.ordering === "object") {
    out.ordering = { ...out.ordering, items: cut(out.ordering.items) };
  }
  if (out.quiz && typeof out.quiz === "object" && Array.isArray(out.quiz.questions)) {
    out.quiz = { ...out.quiz, questions: cut(out.quiz.questions) };
  }
  return out;
}
