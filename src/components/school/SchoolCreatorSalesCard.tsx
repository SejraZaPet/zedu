import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Info, Loader2, ShoppingBag } from "lucide-react";

interface Props {
  schoolId: string;
}

const SchoolCreatorSalesCard = ({ schoolId }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allows, setAllows] = useState(false);
  const [recipient, setRecipient] = useState<"teacher" | "school">("school");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("allows_teacher_creators, creator_payout_recipient")
        .eq("id", schoolId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        toast({ title: "Chyba načítání", description: error.message, variant: "destructive" });
      } else if (data) {
        setAllows(!!data.allows_teacher_creators);
        setRecipient((data.creator_payout_recipient as "teacher" | "school") ?? "school");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId, toast]);

  const save = async (patch: { allows_teacher_creators?: boolean; creator_payout_recipient?: string }) => {
    setSaving(true);
    const { error } = await supabase.from("schools").update(patch).eq("id", schoolId);
    setSaving(false);
    if (error) {
      toast({ title: "Nepodařilo se uložit", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Nastavení uloženo" });
    return true;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="w-5 h-5" /> Tvorba a prodej materiálů
        </CardTitle>
        <CardDescription>
          Rozhodnutí školy o tom, zda a jak se její učitelé mohou zapojit do prodeje materiálů na BezliMarketu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Načítám…
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <Label htmlFor="allows-creators" className="font-normal leading-snug">
                Naši učitelé mohou nabízet materiály na BezliMarketu k prodeji
              </Label>
              <Switch
                id="allows-creators"
                checked={allows}
                disabled={saving}
                onCheckedChange={async (v) => {
                  setAllows(v);
                  const ok = await save({ allows_teacher_creators: v });
                  if (!ok) setAllows(!v);
                }}
              />
            </div>

            {allows && (
              <div className="space-y-2 border-t border-border pt-4">
                <Label className="text-sm">Peníze z prodeje jdou:</Label>
                <RadioGroup
                  value={recipient}
                  onValueChange={async (v) => {
                    const prev = recipient;
                    setRecipient(v as "teacher" | "school");
                    const ok = await save({ creator_payout_recipient: v });
                    if (!ok) setRecipient(prev);
                  }}
                  className="gap-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="teacher" id="payout-teacher" />
                    <Label htmlFor="payout-teacher" className="font-normal">Přímo učiteli</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="school" id="payout-school" />
                    <Label htmlFor="payout-school" className="font-normal">Škole</Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <div className="flex gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Materiály vytvořené v rámci výuky mohou podléhat autorskoprávním pravidlům pro
                zaměstnanecká díla. Doporučujeme si toto nastavení ujasnit interně dřív, než ho zapnete.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SchoolCreatorSalesCard;
