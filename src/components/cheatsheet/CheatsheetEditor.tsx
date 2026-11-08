import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Save, Printer, X, FileDown, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { CHEATSHEET_SYMBOLS, sideStats, validCheatsheet, type CheatsheetData } from "@/lib/cheatsheet";
import { printCheatsheets } from "@/lib/cheatsheet-print";
import CheatsheetCard from "./CheatsheetCard";
export interface CheatsheetSource { title: string; text: string; subject?: string }
export default function CheatsheetEditor({ initial, source, onSave, onClose }: { initial: CheatsheetData; source?: CheatsheetSource; onSave: (data: CheatsheetData) => Promise<void>; onClose: () => void }) {
  const [data, setData] = useState(initial);
  const [side, setSide] = useState<"front" | "back">("front");
  const [busy, setBusy] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(!!source);
  const [excerpt, setExcerpt] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);
  const stats = sideStats(data[side]);
  const valid = validCheatsheet(data);
  const changed = JSON.stringify(initial) !== JSON.stringify(data);
  const insert = (value: string) => {
    const start = textRef.current?.selectionStart ?? data[side].length;
    const end = textRef.current?.selectionEnd ?? start;
    setData(d => ({ ...d, [side]: d[side].slice(0, start) + value + d[side].slice(end) }));
    requestAnimationFrame(() => { textRef.current?.focus(); textRef.current?.setSelectionRange(start + value.length, start + value.length); });
  };
  const print = async (repeat: boolean) => { try { await printCheatsheets([data], repeat); } catch { toast.error("Tisk se nepodařilo otevřít. Zkus to znovu."); } };
  return <section className="space-y-5 min-w-0">
    <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl">Tahák</h2><Button variant="ghost" size="icon" className="min-h-11 min-w-11" title="Zavřít" aria-label="Zavřít tahák" onClick={() => { if (!changed || window.confirm("Zahodit neuložené změny taháku?")) onClose(); }}><X /></Button></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="cs-title">Název</Label><Input id="cs-title" maxLength={80} value={data.title} onChange={e => setData({ ...data, title: e.target.value })} /></div><div><Label htmlFor="cs-subject">Předmět (volitelné)</Label><Input id="cs-subject" maxLength={80} value={data.subject} onChange={e => setData({ ...data, subject: e.target.value })} /></div></div>
    <div className="flex flex-wrap items-center gap-3"><Tabs value={side} onValueChange={v => setSide(v === "back" ? "back" : "front")}><TabsList className="h-11"><TabsTrigger className="min-h-11" value="front">Líc</TabsTrigger><TabsTrigger className="min-h-11" value="back">Rub</TabsTrigger></TabsList></Tabs><Label htmlFor="cs-font">Písmo</Label><Select value={String(data.fontPt)} onValueChange={v => setData({ ...data, fontPt: Number(v) })}><SelectTrigger id="cs-font" className="w-24 min-h-11"><SelectValue /></SelectTrigger><SelectContent>{[7, 8, 9, 10, 11, 12].map(n => <SelectItem key={n} value={String(n)}>{n} pt</SelectItem>)}</SelectContent></Select></div>
    <div className="grid gap-5 lg:grid-cols-2"><div className="space-y-3 min-w-0"><Label htmlFor="cs-text">{side === "front" ? "Líc" : "Rub"}</Label><Textarea id="cs-text" ref={textRef} rows={8} value={data[side]} aria-invalid={!stats.valid} aria-describedby="cs-count" onChange={e => setData({ ...data, [side]: e.target.value })} /><p id="cs-count" role="status" className={stats.valid ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{stats.characters} / 220 znaků · {stats.lines} / 8 řádků</p>{!valid && <p className="text-sm text-destructive">Každá strana smí mít nejvýš 8 řádků a 220 znaků.</p>}<div className="flex flex-wrap gap-1" aria-label="Symboly">{CHEATSHEET_SYMBOLS.map(symbol => <Button key={symbol} variant="outline" size="icon" className="min-h-11 min-w-11" aria-label={`Vložit ${symbol}`} title={`Vložit ${symbol}`} onClick={() => insert(symbol)}>{symbol}</Button>)}</div>{source && <Button variant="outline" className="min-h-11 gap-2" onClick={() => setSourceOpen(true)}><ClipboardPaste className="h-4 w-4" />Vložit z lekce</Button>}</div><div className="space-y-2 min-w-0"><p className="text-sm text-muted-foreground">{side === "front" ? "Líc" : "Rub"} · 90 × 55 mm</p><CheatsheetCard data={data} side={side} /></div></div>
    <div className="flex flex-wrap gap-2"><Button disabled={!valid || busy} className="min-h-11 gap-2" onClick={async () => { setBusy(true); try { await onSave(data); } catch { toast.error("Tahák se nepodařilo uložit. Zkus to znovu."); } finally { setBusy(false); } }}><Save className="h-4 w-4" />{busy ? "Ukládání…" : "Uložit"}</Button><Button variant="outline" disabled={!valid} className="min-h-11 gap-2" onClick={() => print(false)}><Printer className="h-4 w-4" />Tisk / PDF</Button><Button variant="outline" disabled={!valid} className="min-h-11 gap-2" onClick={() => print(true)}><FileDown className="h-4 w-4" />10× na A4</Button></div><p className="text-xs text-muted-foreground">Líc a rub: oboustranný tisk, otočení po delší straně, měřítko 100 %. PDF vyber v nabídce tisku.</p>
    <Dialog open={sourceOpen} onOpenChange={setSourceOpen}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Vložit z lekce</DialogTitle><DialogDescription>{source?.title}</DialogDescription></DialogHeader><div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-sm border border-border p-3 rounded-md">{source?.text}</div><Label htmlFor="cs-excerpt">Text na kartu</Label><Textarea id="cs-excerpt" rows={5} value={excerpt} onChange={e => setExcerpt(e.target.value)} /><Button className="min-h-11" disabled={!excerpt.trim()} onClick={() => { insert(excerpt); setExcerpt(""); setSourceOpen(false); }}>Vložit text</Button></DialogContent></Dialog>
  </section>;
}