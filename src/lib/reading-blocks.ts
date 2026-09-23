import type { Block } from "@/lib/textbook-config";

/** Blok označený „Jen pro prezentaci“ se při běžném čtení lekce nezobrazuje. */
export const isPresentationOnly = (block: any): boolean => block?.presentationOnly === true;

/**
 * Bloky pro čtecí (needitovatelné) zobrazení lekce: vynechá skryté bloky
 * a bloky určené jen pro prezentaci, a to i uvnitř spojených snímků.
 */
export const filterReadingBlocks = <T extends Block>(blocks: T[] | null | undefined): T[] => {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b: any) => b && b.visible !== false && !isPresentationOnly(b))
    .map((b: any) => {
      if (b.type !== "slide_group") return b;
      const children = Array.isArray(b.props?.children) ? b.props.children : null;
      if (!children) return b;
      const nextChildren = children.filter((c: any) => c && !isPresentationOnly(c));
      if (nextChildren.length === children.length) return b;
      return { ...b, props: { ...b.props, children: nextChildren } };
    }) as T[];
};
