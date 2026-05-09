import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AVATARS } from "@/lib/avatars";
import { AvatarSvg } from "./AvatarSvg";
import { Lock, Check } from "lucide-react";

interface Props {
  userId: string;
}

const AvatarPicker = ({ userId }: Props) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>("bear");
  const [level, setLevel] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: av }, { data: xp }] = await Promise.all([
        supabase.from("student_avatars").select("avatar_slug").eq("student_id", userId).maybeSingle(),
        supabase.from("student_xp").select("level").eq("student_id", userId).maybeSingle(),
      ]);
      if (av?.avatar_slug) setSelected(av.avatar_slug);
      if (xp?.level) setLevel(xp.level);
      setLoading(false);
    })();
  }, [userId]);

  const handleSelect = async (slug: string, minLevel: number) => {
    if (level < minLevel) {
      toast({
        title: "Avatar je zamčený",
        description: `Odemkneš ho na úrovni ${minLevel}. Tvoje aktuální úroveň: ${level}.`,
      });
      return;
    }
    const prev = selected;
    setSelected(slug);
    const { error } = await supabase
      .from("student_avatars")
      .upsert({ student_id: userId, avatar_slug: slug, updated_at: new Date().toISOString() });
    if (error) {
      setSelected(prev);
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Avatar uložen", description: "Tvůj nový avatar byl nastaven." });
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Načítání avatarů…</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tvoje úroveň: <span className="font-bold text-foreground">{level}</span>. Některé avatary se odemknou na úrovni 3 a 5.
      </p>
      <div className="grid grid-cols-4 gap-3">
        {AVATARS.map((a) => {
          const locked = level < a.minLevel;
          const isSelected = selected === a.slug;
          return (
            <button
              key={a.slug}
              type="button"
              onClick={() => handleSelect(a.slug, a.minLevel)}
              disabled={locked}
              aria-label={`${a.name}${locked ? ` (zamčeno, úroveň ${a.minLevel})` : ""}`}
              className={`relative rounded-xl border-2 p-2 transition-all flex flex-col items-center gap-1 ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40"
              } ${locked ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <AvatarSvg slug={a.slug} size={56} locked={locked} />
              <span className="text-xs font-medium text-foreground truncate w-full text-center">
                {a.name}
              </span>
              {locked && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Lvl {a.minLevel}
                </span>
              )}
              {isSelected && !locked && (
                <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AvatarPicker;
