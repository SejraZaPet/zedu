import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { followCreator, unfollowCreator } from "@/lib/creator-follows";

interface Props {
  creatorId: string;
  creatorName?: string;
  isFollowing: boolean;
  onChange?: (nowFollowing: boolean) => void;
  size?: "sm" | "xs";
}

export default function FollowCreatorButton({
  creatorId,
  creatorName,
  isFollowing,
  onChange,
  size = "xs",
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(isFollowing);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const next = !following;
    try {
      if (next) await followCreator(creatorId);
      else await unfollowCreator(creatorId);
      setFollowing(next);
      onChange?.(next);
      toast({
        title: next
          ? `Sledujete ${creatorName ?? "autora"}`
          : `Odběr zrušen`,
      });
    } catch (err: any) {
      toast({
        title: "Nepodařilo se",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const Icon = busy ? Loader2 : following ? UserCheck : UserPlus;

  return (
    <Button
      type="button"
      variant={following ? "secondary" : "outline"}
      size="sm"
      onClick={toggle}
      disabled={busy}
      className={`h-6 px-2 gap-1 text-[11px] ${
        following ? "text-primary" : ""
      }`}
      aria-label={following ? "Zrušit sledování" : "Sledovat autora"}
    >
      <Icon className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} />
      {following ? "Sledujete" : "Sledovat"}
    </Button>
  );
}
