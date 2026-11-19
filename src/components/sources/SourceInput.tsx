import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, BookOpen, Camera, FileUp, Image as ImageIcon, Link2, Loader2, RotateCcw, Trash2, Type, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SOURCE_KIND_LABEL, SOURCE_URL_NOTICE } from "@/lib/source-bundle";
import type { SourceBundle } from "@/lib/use-source-bundle";

type Panel = null | "text" | "url" | "lesson";
const DOC_ACCEPT = ".pdf,.docx,.doc,.pptx,.txt,.md,application/pdf,text/plain";

/**
 * Sdílený vstup zdrojů: text, soubory, galerie, foťák, odkaz a volitelně lekce.
 * Přidání nikdy nic nenahradí; nadlimitní text se neořízne, jen se zablokuje generování.
 */
export default function SourceInput({
  bundle, disabled, lessonPicker, allowUrl = true,
}: {
  bundle: SourceBundle;
  disabled?: boolean;
  /** Vykreslí výběr lekce; volající zavolá `bundle.addLesson` a `close`. */
  lessonPicker?: (close: () => void) => ReactNode;
  allowUrl?: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const files = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { items, state } = bundle;
  const fmt = (n: number) => n.toLocaleString("cs-CZ");

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length) bundle.addFiles(picked);
  };
  const removeAt = (id: string, index: number) => {
    bundle.remove(id);
    requestAnimationFrame(() => {
      const btns = listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-remove]");
      btns?.[Math.min(index, (btns?.length ?? 1) - 1)]?.focus();
    });
  };

  const tile = (icon: ReactNode, label: string, onClick: () => void, active = false) => (
    <Button type="button" variant={active ? "secondary" : "outline"} disabled={disabled}
      className="h-auto min-h-11 justify-start gap-2 whitespace-normal py-2 text-left" onClick={onClick}>
      {icon}<span className="text-sm">{label}</span>
    </Button>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {tile(<Type className="h-4 w-4 shrink-0 text-primary" />, "Vložit text", () => setPanel(panel === "text" ? null : "text"), panel === "text")}
        {tile(<FileUp className="h-4 w-4 shrink-0 text-primary" />, "Nahrát soubory", () => files.current?.click())}
        {tile(<ImageIcon className="h-4 w-4 shrink-0 text-primary" />, "Fotky z galerie", () => gallery.current?.click())}
        {tile(<Camera className="h-4 w-4 shrink-0 text-primary" />, "Vyfotit", () => camera.current?.click())}
        {allowUrl && tile(<Link2 className="h-4 w-4 shrink-0 text-primary" />, "Vložit odkaz", () => setPanel(panel === "url" ? null : "url"), panel === "url")}
        {lessonPicker && tile(<BookOpen className="h-4 w-4 shrink-0 text-primary" />, "Z lekce", () => setPanel(panel === "lesson" ? null : "lesson"), panel === "lesson")}
      </div>
      <input ref={files} type="file" multiple accept={DOC_ACCEPT} className="hidden" onChange={onFiles} data-testid="source-files" />
      <input ref={gallery} type="file" multiple accept="image/*" className="hidden" onChange={onFiles} data-testid="source-gallery" />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />

      {panel === "text" && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label htmlFor="source-text">Text z prezentace, učebnice nebo vlastní přípravy</Label>
          <Textarea id="source-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} disabled={disabled} />
          <Button type="button" size="sm" disabled={disabled || !text.trim()}
            onClick={() => { if (bundle.addText(text)) { setText(""); setPanel(null); } }}>Přidat text</Button>
        </div>
      )}
      {panel === "url" && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <Label htmlFor="source-url">Webová adresa</Label>
          <Input id="source-url" type="url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} disabled={disabled} />
          <p className="text-xs text-muted-foreground">{SOURCE_URL_NOTICE}</p>
          <Button type="button" size="sm" disabled={disabled || !/^https?:\/\//i.test(url.trim())}
            onClick={() => { if (bundle.addUrl(url)) { setUrl(""); setPanel(null); } }}>Načíst odkaz</Button>
        </div>
      )}
      {panel === "lesson" && lessonPicker && (
        <div className="rounded-md border border-border p-3">{lessonPicker(() => setPanel(null))}</div>
      )}

      {items.length > 0 && (
        <ul ref={listRef} className="space-y-2" aria-label="Přidané zdroje">
          {items.map((it, i) => (
            <li key={it.id} className="rounded-md border border-border p-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i + 1}. {it.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {SOURCE_KIND_LABEL[it.kind]}
                    {it.status === "loading" && <> · <Loader2 className="inline h-3 w-3 animate-spin" /> načítá se</>}
                    {it.status === "ready" && <> · <CheckCircle2 className="inline h-3 w-3 text-primary" /> {fmt((it.text ?? "").length)} znaků</>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || i === 0}
                    aria-label={`Posunout zdroj ${i + 1} nahoru`} onClick={() => bundle.move(it.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={disabled || i === items.length - 1}
                    aria-label={`Posunout zdroj ${i + 1} dolů`} onClick={() => bundle.move(it.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" data-remove disabled={disabled}
                    aria-label={`Odebrat zdroj ${i + 1}`} onClick={() => removeAt(it.id, i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {it.error && (
                <p className={cn("mt-1 flex items-start gap-1 text-xs", it.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{it.error}
                  {it.status === "error" && (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0 pl-1 text-xs" onClick={() => bundle.retry(it.id)}>
                      <RotateCcw className="mr-1 h-3 w-3" />Zkusit znovu</Button>
                  )}
                </p>
              )}
              {it.status === "ready" && (it.text ?? "").length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-primary">Zobrazit a upravit text</summary>
                  <Textarea className="mt-1 text-xs" rows={5} value={it.text} disabled={disabled}
                    aria-label={`Text zdroje ${i + 1}`} onChange={(e) => bundle.updateText(it.id, e.target.value)} />
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      <p aria-live="polite" className={cn("text-xs", state.overBy > 0 ? "text-destructive" : "text-muted-foreground")}>
        {fmt(state.chars)} / {fmt(state.max)} znaků{state.message && items.length > 0 ? ` · ${state.message}` : ""}
      </p>
    </div>
  );
}
