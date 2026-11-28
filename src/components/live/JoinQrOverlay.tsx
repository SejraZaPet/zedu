import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

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
export function JoinQrButton({ gameCode, className = "" }: { gameCode: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" aria-label="Zobrazit QR kód pro připojení" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`cursor-pointer rounded px-1 font-semibold text-foreground hover:bg-muted ${className}`}>
        QR
      </button>
      {open && createPortal(<div className="fixed inset-0 z-[100]"><JoinQrOverlay gameCode={gameCode} onClose={close} /></div>, document.body)}
    </>
  );
}
