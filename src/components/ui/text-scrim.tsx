import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

/** Tmavý poloprůhledný panel + silný stín textu — garantuje čitelnost na fotkách. */
export const TextScrim = ({ as: Tag = "div", className, children }: { as?: ElementType; className?: string; children: ReactNode }) => (
  <Tag className={cn("rounded-2xl bg-[hsl(var(--scrim)/0.55)] backdrop-blur-sm px-6 py-4 text-white text-scrim-shadow", className)}>
    {children}
  </Tag>
);
export default TextScrim;
