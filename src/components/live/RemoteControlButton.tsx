import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";

export default function RemoteControlButton({ sessionId }: { sessionId: string }) {
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
        <Button size="sm" variant="outline" className="gap-1.5" title="Ovládání z mobilu">
          <Smartphone className="w-4 h-4" /> Ovládání z mobilu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ovládání z mobilu</DialogTitle>
          <DialogDescription>
            Naskenujte QR kód telefonem. Musíte být přihlášeni jako učitel této prezentace.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="p-3 bg-white rounded-md border border-border">
            <QRCodeSVG value={url} size={208} />
          </div>
          <div className="w-full flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 truncate">{url}</code>
            <Button size="sm" variant="outline" onClick={copy} className="gap-1">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
