import { useEffect, useRef } from "react";
import { WifiOff, Wifi, Loader2 } from "lucide-react";
import { UI_COPY } from "@/lib/ui-microcopy";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { ConnectionStatus } from "@/hooks/useGameSession";

interface ConnectionStatusBannerProps {
  status: ConnectionStatus;
  onReconnect: () => void;
}

export function ConnectionStatusBanner({ status, onReconnect }: ConnectionStatusBannerProps) {
  const { toast } = useToast();
  const prevStatus = useRef<ConnectionStatus>(status);

  // Toast on status transitions
  useEffect(() => {
    if (prevStatus.current !== status) {
      if (status === "connected" && (prevStatus.current === "reconnecting" || prevStatus.current === "disconnected")) {
        toast({
          title: UI_COPY.student.toasts.connectionRestored.title,
          description: UI_COPY.student.toasts.connectionRestored.description,
        });
      }
      prevStatus.current = status;
    }
  }, [status, toast]);

  if (status === "connected" || status === "connecting") return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium transition-all ${
        status === "disconnected"
          ? "bg-destructive text-destructive-foreground"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {status === "reconnecting" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Obnovování spojení…</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>{UI_COPY.common.connectionLost}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={onReconnect}
            className="ml-2 h-7 px-3 text-xs"
          >
            {UI_COPY.common.retry}
          </Button>
        </>
      )}
    </div>
  );
}
