import { useLayoutEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const colors = [{ id: "default", label: "Výchozí" }, { id: "light", label: "Světlá" }, { id: "dark", label: "Tmavá" }, { id: "blue", label: "Modrá" }, { id: "green", label: "Zelená" }] as const;
export function MegatextTool() {
  const [text, setText] = useState("");
  const [color, setColor] = useState("default");
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const parent = box.current; const node = content.current;
    if (!parent || !node) return;
    const fit = () => {
      let low = 1, high = Math.max(parent.clientWidth, parent.clientHeight), best = 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        node.style.fontSize = `${mid}px`;
        if (node.scrollHeight <= parent.clientHeight && node.scrollWidth <= parent.clientWidth) { best = mid; low = mid + 1; } else high = mid - 1;
      }
      node.style.fontSize = `${best}px`;
    };
    const observer = new ResizeObserver(fit); observer.observe(parent); fit();
    void document.fonts.ready.then(fit);
    return () => observer.disconnect();
  }, [text]);
  return <div className="flex min-h-0 flex-1 flex-col gap-4">
    <label className="mx-auto w-full max-w-3xl space-y-2"><span>Text na tabuli</span><Textarea rows={2} maxLength={5000} value={text} onChange={e => setText(e.target.value)} aria-label="Text na tabuli" /></label>
    <div className="flex justify-center gap-3" role="group" aria-label="Barva tabule">{colors.map(c => <Button key={c.id} title={c.label} aria-label={c.label} aria-pressed={color === c.id} variant="outline" size="icon" className={`classroom-swatch classroom-color-${c.id}`} onClick={() => setColor(c.id)}>{color === c.id && <Check />}</Button>)}</div>
    <div ref={box} className={`classroom-megatext classroom-color-${color}`}><div ref={content}>{text || "…"}</div></div>
  </div>;
}
