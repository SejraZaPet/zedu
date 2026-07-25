import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Star, Loader2 } from "lucide-react";
import ReviewDialog from "./ReviewDialog";
import { getMyReview, type ReviewTargetKind } from "@/lib/content-shares";

interface Props {
  /** ID of the ORIGINAL market content (source of the copy). */
  originalId: string | null | undefined;
  kind: ReviewTargetKind;
  targetTitle?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

/**
 * Renders a "Rate / Edit review" button, but ONLY if `originalId` is present
 * (i.e. the current item was copied from a market entry). Hidden otherwise.
 */
export default function ReviewButton({
  originalId,
  kind,
  targetTitle,
  size = "sm",
  variant = "outline",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!originalId) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const r = await getMyReview(kind, originalId);
        if (!cancel) setMyRating(r?.rating ?? null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [originalId, kind, refreshKey]);

  if (!originalId) return null;

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)} disabled={loading}>
        {loading ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Star
            className="w-4 h-4 mr-1"
            fill={myRating ? "currentColor" : "none"}
          />
        )}
        {myRating ? `Vaše hodnocení: ${myRating}/5` : "Ohodnotit"}
      </Button>
      <ReviewDialog
        open={open}
        onOpenChange={setOpen}
        kind={kind}
        targetId={originalId}
        targetTitle={targetTitle}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
