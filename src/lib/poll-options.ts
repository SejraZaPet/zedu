export interface PollOption {
  id?: string | number | null;
  text: string;
}

/**
 * Staré ankety ukládají jen text možnosti. Jejich stabilním identifikátorem
 * je pořadí; novější možnosti si ponechají vlastní ID.
 */
export function pollOptionId(option: PollOption | null | undefined, index: number): string {
  const id = option?.id;
  return id === null || id === undefined ? String(index) : String(id);
}
