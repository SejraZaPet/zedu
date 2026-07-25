import { useEffect, useState } from "react";
import StarRating from "./StarRating";
import {
  getReviewAggregate,
  type ReviewAggregate,
  type ReviewTargetKind,
} from "@/lib/content-shares";

interface Props {
  kind: ReviewTargetKind;
  targetId: string;
  /** Preloaded aggregate — skips fetch. */
  aggregate?: ReviewAggregate;
  size?: number;
  showEmpty?: boolean;
}

export default function ReviewSummary({
  kind,
  targetId,
  aggregate,
  size = 14,
  showEmpty = false,
}: Props) {
  const [data, setData] = useState<ReviewAggregate | null>(aggregate ?? null);

  useEffect(() => {
    if (aggregate) {
      setData(aggregate);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const a = await getReviewAggregate(kind, targetId);
        if (!cancel) setData(a);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [kind, targetId, aggregate]);

  if (!data) return null;
  if (data.count === 0) {
    if (!showEmpty) return null;
    return (
      <div className="text-[11px] text-muted-foreground">Zatím bez hodnocení</div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <StarRating value={data.average} readOnly size={size} />
      <span className="text-xs text-muted-foreground">
        {data.average.toFixed(1)} ({data.count})
      </span>
    </div>
  );
}
