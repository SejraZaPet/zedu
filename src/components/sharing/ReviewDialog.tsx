import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Trash2 } from "lucide-react";
import StarRating from "./StarRating";
import {
  getMyReview,
  upsertReview,
  deleteReview,
  type ReviewTargetKind,
} from "@/lib/content-shares";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: ReviewTargetKind;
  /** ID of the ORIGINAL market content (source of the copy). */
  targetId: string;
  targetTitle?: string;
  onSaved?: () => void;
}

export default function ReviewDialog({
  open,
  onOpenChange,
  kind,
  targetId,
  targetTitle,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const r = await getMyReview(kind, targetId);
        if (cancel) return;
        if (r) {
          setExistingId(r.id);
          setRating(r.rating);
          setComment(r.comment ?? "");
        } else {
          setExistingId(null);
          setRating(0);
          setComment("");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, kind, targetId]);

  async function handleSave() {
    if (rating < 1) {
      toast({ title: "Vyberte hodnocení 1–5 hvězd.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await upsertReview({ kind, targetId, rating, comment: comment.trim() || null });
      toast({ title: existingId ? "Recenze upravena" : "Děkujeme za recenzi" });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Uložení selhalo",
        description: e.message ?? "Zkontrolujte, že máte tento obsah přidaný do svých materiálů.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existingId) return;
    setSaving(true);
    try {
      await deleteReview(existingId);
      toast({ title: "Recenze smazána" });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Smazání selhalo", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existingId ? "Upravit recenzi" : "Ohodnotit"}
            {targetTitle ? ` · ${targetTitle}` : ""}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Hodnocení</label>
              <StarRating value={rating} onChange={setRating} size={28} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Komentář <span className="text-muted-foreground font-normal">(volitelné)</span>
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder="Co se vám na materiálu líbí nebo co byste zlepšili?"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          {existingId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Smazat
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Zrušit
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {existingId ? "Uložit změny" : "Odeslat"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
