import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  className?: string;
  readOnly?: boolean;
}

/** 1–5 star rating. Interactive when onChange provided and not readOnly. */
export default function StarRating({ value, onChange, size = 20, className, readOnly }: Props) {
  const interactive = !!onChange && !readOnly;
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(n)}
            className={cn(
              "p-0.5 leading-none touch-manipulation",
              interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default",
            )}
            aria-label={`${n} z 5 hvězdiček`}
          >
            <Star
              width={size}
              height={size}
              className={cn(
                filled || half ? "text-amber-400" : "text-muted-foreground/40",
              )}
              fill={filled ? "currentColor" : half ? "url(#half-star)" : "none"}
            />
          </button>
        );
      })}
    </div>
  );
}
