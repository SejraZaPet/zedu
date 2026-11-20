/**
 * Význam dvoumožnostné otázky Pravda/Nepravda je pevný nezávisle na indexu.
 * Index 1 = modrý kosočtverec (Pravda), index 0 = červený trojúhelník (Nepravda).
 * Data ani správné indexy se nikdy nepřehazují; jde jen o prezentační mapování.
 */
export type McqOptionLike = string | { text?: unknown } | null | undefined;

export const mcqOptionText = (option: McqOptionLike): string =>
  String(typeof option === "object" && option !== null ? option.text ?? "" : option ?? "");

export const isTrueFalseMcqOptions = (options: readonly McqOptionLike[] | null | undefined): boolean => {
  if (!Array.isArray(options) || options.length !== 2) return false;
  const texts = options.map(mcqOptionText);
  return texts.includes("Pravda") && texts.includes("Nepravda");
};

/** Vrací původní index pro všechny ostatní MCQ; u P/N jen pevný vizuální index. */
export const getMcqOptionVisualIndex = (
  options: readonly McqOptionLike[] | null | undefined,
  answerIndex: number,
): number => {
  if (!isTrueFalseMcqOptions(options)) return answerIndex;
  return mcqOptionText(options?.[answerIndex]) === "Pravda" ? 1 : 0;
};
