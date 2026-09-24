import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReadAloudButtonProps {
  /** Text to read aloud. HTML is stripped for TTS. */
  text: string;
  /** Optional label shown next to the icon. */
  label?: string;
  /** Visual size variant. */
  size?: "sm" | "icon";
  className?: string;
  /**
   * When true, renders the text below the button with the currently-spoken
   * word highlighted (uses SpeechSynthesisUtterance's boundary events).
   */
  showText?: boolean;
  /** Extra class for the highlighted-text container (when showText is true). */
  textClassName?: string;
}

const stripHtml = (html: string): string => {
  if (typeof document === "undefined") return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
};

/** Rozdělí text na úseky do ~200 znaků na hranicích vět/slov, s offsety. */
export const splitIntoChunks = (text: string, max = 200): { text: string; offset: number }[] => {
  const out: { text: string; offset: number }[] = [];
  const re = /[^.!?…]+[.!?…]*\s*/g;
  let m: RegExpExecArray | null;
  let cur = "";
  let curStart = 0;
  const flush = () => {
    if (cur.trim()) out.push({ text: cur, offset: curStart });
    cur = "";
  };
  while ((m = re.exec(text)) !== null) {
    if (!m[0]) { re.lastIndex++; continue; }
    let sentence = m[0];
    let sStart = m.index;
    if (cur && cur.length + sentence.length > max) flush();
    while (sentence.length > max) {
      let cut = sentence.lastIndexOf(" ", max);
      if (cut <= 0) cut = max;
      if (cur) flush();
      out.push({ text: sentence.slice(0, cut), offset: sStart });
      sentence = sentence.slice(cut);
      sStart += cut;
    }
    if (!cur) curStart = sStart;
    cur += sentence;
  }
  flush();
  return out;
};

type SpeechState = "idle" | "speaking" | "paused";

/**
 * Reusable text-to-speech button using the Web Speech API (Czech).
 * Play / pause / stop with optional word highlighting.
 */
export const ReadAloudButton = ({
  text,
  label,
  size = "sm",
  className,
  showText = false,
  textClassName,
}: ReadAloudButtonProps) => {
  const [state, setState] = useState<SpeechState>("idle");
  const [charIndex, setCharIndex] = useState<number>(-1);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const sessionRef = useRef(0);
  const plainText = useMemo(() => stripHtml(text || ""), [text]);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  // Split into word tokens with their absolute char offsets so we can highlight
  // whichever word contains the current charIndex reported by onboundary.
  const tokens = useMemo(() => {
    const out: { text: string; start: number; end: number; isWord: boolean }[] = [];
    const re = /(\s+|\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(plainText)) !== null) {
      const isWord = /\S/.test(m[0]);
      out.push({ text: m[0], start: m.index, end: m.index + m[0].length, isWord });
    }
    return out;
  }, [plainText]);

  const stop = useCallback(() => {
    if (!supported) return;
    sessionRef.current++;
    window.speechSynthesis.cancel();
    setState("idle");
    setCharIndex(-1);
    utterRef.current = null;
  }, [supported]);

  useEffect(() => {
    return () => {
      sessionRef.current++;
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  const handleClick = useCallback(() => {
    if (!supported || !plainText) return;

    if (state === "speaking") {
      window.speechSynthesis.pause();
      setState("paused");
      return;
    }
    if (state === "paused") {
      window.speechSynthesis.resume();
      setState("speaking");
      return;
    }

    // idle → start. Dlouhý text se čte po úsecích (~200 znaků) — Chrome
    // jinak jedno dlouhé čtení po pár vteřinách tiše ukončí.
    window.speechSynthesis.cancel();
    const chunks = splitIntoChunks(plainText);
    const session = ++sessionRef.current;
    const speakChunk = (i: number) => {
      if (session !== sessionRef.current) return;
      if (i >= chunks.length) {
        setState("idle");
        setCharIndex(-1);
        utterRef.current = null;
        return;
      }
      const { text: chunkText, offset } = chunks[i];
      const u = new SpeechSynthesisUtterance(chunkText);
      u.lang = "cs-CZ";
      u.rate = 1;
      u.pitch = 1;
      u.onboundary = (e) => {
        if (session === sessionRef.current) setCharIndex(offset + (e.charIndex ?? 0));
      };
      u.onend = () => speakChunk(i + 1);
      u.onerror = (e: any) => {
        if (e?.error === "interrupted" || e?.error === "canceled") return;
        speakChunk(i + 1);
      };
      utterRef.current = u;
      window.speechSynthesis.speak(u);
    };
    speakChunk(0);
    setState("speaking");
  }, [plainText, state, supported]);

  if (!supported || !plainText) return null;

  const Icon = state === "speaking" ? Pause : state === "paused" ? Play : Volume2;
  const title =
    state === "speaking" ? "Pozastavit čtení" : state === "paused" ? "Pokračovat" : "Přečíst nahlas";

  return (
    <div className={cn("inline-flex flex-col gap-2", showText ? "w-full" : "", className)}>
      <div className="inline-flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size={size === "icon" ? "icon" : "sm"}
          onClick={handleClick}
          aria-label={title}
          aria-pressed={state !== "idle"}
          title={title}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
          {label && size !== "icon" ? <span className="ml-1.5 text-xs">{label}</span> : null}
        </Button>
        {state !== "idle" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={stop}
            aria-label="Zastavit čtení"
            title="Zastavit"
            className="text-muted-foreground hover:text-foreground"
          >
            <VolumeX className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {showText && (
        <div className={cn("text-sm whitespace-pre-wrap leading-relaxed", textClassName)}>
          {tokens.map((t, i) => {
            if (!t.isWord) return <span key={i}>{t.text}</span>;
            const active =
              state !== "idle" && charIndex >= 0 && charIndex >= t.start && charIndex < t.end;
            return (
              <span
                key={i}
                className={cn("read-aloud-word", active && "is-active")}
              >
                {t.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReadAloudButton;
