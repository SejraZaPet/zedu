import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";

export default function RemoteControlButton({ sessionId, iconOnly = false }: { sessionId: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/prezentace/ovladani/${sessionId}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size={iconOnly ? "icon" : "sm"}
          variant="outline"
          className={iconOnly ? "h-9 w-9" : "gap-1.5"}
          title="Ovládání z mobilu"
          aria-label="Ovládání z mobilu"
        >
          <Smartphone className="w-4 h-4" /> {!iconOnly && "Ovládání z mobilu"}
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100vw-2rem)] max-w-sm grid-cols-[minmax(0,1fr)] overflow-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle>Ovládání z mobilu</DialogTitle>
          <DialogDescription className="whitespace-normal break-words">
            Naskenujte QR kód telefonem. Musíte být přihlášeni jako učitel této prezentace.
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full min-w-0 flex-col items-center gap-4 py-2">
          <div className="max-w-full rounded-md border border-border bg-white p-3">
            <QRCodeSVG value={url} size={208} className="block h-auto max-w-full" />
          </div>
          <div className="flex w-full min-w-0 items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs" title={url}>{url}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={copy}
              className="shrink-0 gap-1"
              aria-label={copied ? "Odkaz zkopírován" : "Kopírovat odkaz"}
              title="Kopírovat odkaz"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
