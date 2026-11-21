import { forwardRef, type ComponentPropsWithoutRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface TextbookCardProps extends Omit<ComponentPropsWithoutRef<"div">, "onClick" | "onKeyDown" | "role" | "tabIndex"> {
  onOpen: () => void;
  openLabel: string;
}

/** Clickable textbook card. Nested actions must stop click propagation. */
const TextbookCard = forwardRef<HTMLDivElement, TextbookCardProps>(
  ({ onOpen, openLabel, className, children, ...props }, ref) => {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget || event.repeat) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onOpen();
    };

    return (
      <div
        {...props}
        ref={ref}
        role="link"
        tabIndex={0}
        aria-label={openLabel}
        className={cn("textbook-card cursor-pointer", className)}
        onClick={onOpen}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    );
  },
);

TextbookCard.displayName = "TextbookCard";

export default TextbookCard;
