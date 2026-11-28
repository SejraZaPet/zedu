import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";

/** Broadcast kanál: obrazovka učitele otevírá/zavírá QR i na projektoru (bez zápisu do DB). */
export const joinQrChannelName = (sessionId: string) => `join-qr-${sessionId}`;

export function useJoinQrListener(sessionId: string | undefined, onChange: (open: boolean) => void) {
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(joinQrChannelName(sessionId));
    ch.on("broadcast", { event: "qr" }, ({ payload }) => onChange(!!(payload as any)?.open)).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [sessionId, onChange]);
}

function useJoinQrSender(sessionId: string | undefined) {
  const [ch, setCh] = useState<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!sessionId) return;
    const c = supabase.channel(joinQrChannelName(sessionId));
    c.subscribe();
    setCh(c);
    return () => { void supabase.removeChannel(c); setCh(null); };
  }, [sessionId]);
  return useCallback((open: boolean) => {
    ch?.send({ type: "broadcast", event: "qr", payload: { open } }).catch((e) => console.warn("[join-qr] send failed", e?.message));
  }, [ch]);
}

export function joinUrlFor(gameCode: string) {
  return `${window.location.origin}/live/pripojit${gameCode ? `?code=${gameCode}` : ""}`;
}

/** Velký QR pro připojení žáků; zavírá klik mimo, Esc, nebo znovu klik na kód. */
export default function JoinQrOverlay({ gameCode, onClose }: { gameCode: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const url = joinUrlFor(gameCode);
  return (
    <div
      data-testid="join-qr-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="QR kód pro připojení"
      className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div className="flex max-h-full flex-col items-center rounded-3xl bg-white p-6 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-xl bg-white p-3">
          <QRCodeSVG value={url} size={320} style={{ width: "min(320px, 55vh)", height: "min(320px, 55vh)" }} />
        </div>
        <p className="mt-3 font-mono text-5xl font-bold tracking-[0.2em]">{gameCode}</p>
        <p className="mt-1 break-all text-center text-base text-slate-600">{url.replace(/^https?:\/\//, "")}</p>
      </div>
    </div>
  );
}

/** Samostatné tlačítko „QR“ (obrazovka učitele): overlay přes celé okno. */
export function JoinQrButton({ gameCode, className = "", sessionId }: { gameCode: string; className?: string; sessionId?: string }) {
  const [open, setOpenState] = useState(false);
  const send = useJoinQrSender(sessionId);
  const setOpen = useCallback((v: boolean | ((p: boolean) => boolean)) => {
    setOpenState((prev) => { const next = typeof v === "function" ? v(prev) : v; send(next); return next; });
  }, [send]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  return (
    <>
      <button type="button" aria-label="Zobrazit QR kód pro připojení" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`cursor-pointer rounded px-1 font-semibold text-foreground hover:bg-muted ${className}`}>
        QR
      </button>
      {open && createPortal(<div className="fixed inset-0 z-[100]"><JoinQrOverlay gameCode={gameCode} onClose={close} /></div>, document.body)}
    </>
  );
}
