import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Clock, Loader2, School as SchoolIcon } from "lucide-react";

interface Props {
  userId: string;
  /** předvyplněný název školy z textového pole profilu */
  defaultSchoolName?: string;
}

type RequestRow = {
  id: string;
  school_name_text: string;
  status: string;
  created_at: string;
};

/**
 * Dodatečné napojení na školu: zobrazí se jen uživatelům bez school_id.
 * Buď nabídne žádost, nebo informuje o čekající/vyřízené žádosti.
 */
const SchoolJoinRequestCard = ({ userId, defaultSchoolName }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [hasSchool, setHasSchool] = useState(false);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [open, setOpen] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: prof }, { data: reqs }] = await Promise.all([
      supabase.from("profiles").select("school_id").eq("id", userId).maybeSingle(),
      supabase
        .from("school_join_requests")
        .select("id, school_name_text, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    setHasSchool(!!prof?.school_id);
    setRequest((reqs?.[0] as RequestRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    if (userId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const submit = async () => {
    const name = schoolName.trim();
    if (name.length < 2) {
      toast({ title: "Zadejte název školy", description: "Napište prosím alespoň 2 znaky.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("school_join_requests").insert({
      user_id: userId,
      school_name_text: name.slice(0, 200),
      message: message.trim() ? message.trim().slice(0, 1000) : null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Žádost se nepodařilo odeslat", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Žádost odeslána",
      description: "Ozveme se vám, jakmile bude škola v systému připravena. Stav uvidíte v profilu.",
    });
    setOpen(false);
    setMessage("");
    await load();
  };

  if (loading || hasSchool) return null;

  const pending = request?.status === "pending";

  return (
    <div className="mt-2">
      {pending ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" /> Žádost čeká na vyřízení
          </Badge>
          <span>Požadovaná škola: {request?.school_name_text}</span>
        </div>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSchoolName(defaultSchoolName?.trim() || request?.school_name_text || "");
              setOpen(true);
            }}
          >
            <SchoolIcon className="w-4 h-4 mr-1" /> Požádat o připojení ke škole
          </Button>
          {request?.status === "rejected" && (
            <p className="text-xs text-muted-foreground mt-1">
              Předchozí žádost byla zamítnuta. Můžete podat novou.
            </p>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Připojení ke škole</DialogTitle>
            <DialogDescription>
              Napište, ke které škole patříte. Administrátor školu ověří a napojí váš účet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sjr-name">Název školy</Label>
              <Input
                id="sjr-name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                maxLength={200}
                placeholder="např. SOU a SOŠ, SČMSD, Žatec, s. r. o."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sjr-msg">Zpráva (nepovinné)</Label>
              <Textarea
                id="sjr-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Např. jaký předmět učíte, kdo je kontaktní osoba školy…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Odeslat žádost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SchoolJoinRequestCard;
