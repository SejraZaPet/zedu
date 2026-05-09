import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing, Send } from "lucide-react";
import { usePushNotifications, PushStatus } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABEL: Record<PushStatus, string> = {
  unsupported: "Tento prohlížeč push notifikace nepodporuje.",
  "preview-blocked":
    "Push notifikace nejde povolit v editoru náhledu. Otevři aplikaci v samostatném okně (zedu.cz nebo .lovable.app).",
  default: "Push notifikace zatím nejsou povolené.",
  "granted-not-subscribed": "Notifikace jsou povolené, ale toto zařízení ještě není zaregistrované.",
  subscribed: "Push notifikace jsou aktivní na tomto zařízení.",
  denied:
    "Notifikace jsi zablokoval/a v nastavení prohlížeče. Povol je v adresním řádku (ikona zámku) a zkus znovu.",
};

export default function PushNotificationsCard() {
  const { status, busy, subscribe, unsubscribe, sendTest } = usePushNotifications();
  const { toast } = useToast();

  const handleEnable = async () => {
    const res = await subscribe();
    if (res.ok) toast({ title: "Push notifikace zapnuté", description: "Toto zařízení je zaregistrované." });
    else toast({ title: "Nepovedlo se zapnout", description: res.error, variant: "destructive" });
  };

  const handleDisable = async () => {
    const res = await unsubscribe();
    if (res.ok) toast({ title: "Push notifikace vypnuté" });
  };

  const handleTest = async () => {
    const { error } = await sendTest();
    if (error) toast({ title: "Test selhal", description: error.message, variant: "destructive" });
    else toast({ title: "Test odeslán", description: "Notifikace by měla dorazit během chvilky." });
  };

  const isOn = status === "subscribed";
  const canEnable = status === "default" || status === "granted-not-subscribed";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Push notifikace
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{STATUS_LABEL[status]}</p>

        <div className="flex flex-wrap gap-2">
          {canEnable && (
            <Button onClick={handleEnable} disabled={busy} className="gap-2">
              <BellRing className="w-4 h-4" />
              {busy ? "Aktivuji..." : "Povolit notifikace"}
            </Button>
          )}
          {isOn && (
            <>
              <Button onClick={handleTest} variant="outline" className="gap-2">
                <Send className="w-4 h-4" />
                Poslat testovací
              </Button>
              <Button onClick={handleDisable} variant="ghost" disabled={busy} className="gap-2">
                <BellOff className="w-4 h-4" />
                Vypnout na tomto zařízení
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Žák dostane notifikaci o novém úkolu. Rodič dostane notifikaci o ohodnoceném úkolu dítěte.
          Notifikace musíš povolit zvlášť na každém zařízení a prohlížeči.
        </p>
      </CardContent>
    </Card>
  );
}
