import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Printer, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import CheatsheetEditor, { type CheatsheetSource } from "@/components/cheatsheet/CheatsheetEditor";
import CheatsheetCard from "@/components/cheatsheet/CheatsheetCard";
import { emptyCheatsheet, type Cheatsheet, type CheatsheetData } from "@/lib/cheatsheet";
import { loadCheatsheets, saveCheatsheet, deleteCheatsheet } from "@/lib/cheatsheet-store";
import { printCheatsheets } from "@/lib/cheatsheet-print";
import { matchesSearch } from "@/lib/picker-search";
import "@/components/cheatsheet/cheatsheet.css";

export default function StudentCheatsheets() {
  const { user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<Cheatsheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editor, setEditor] = useState<{ initial: CheatsheetData; existing?: Cheatsheet; source?: CheatsheetSource } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [flipped, setFlipped] = useState<string[]>([]);
  const refresh = useCallback(async () => {
    if (!user || role !== "user") return;
    setLoading(true); setError(false);
    try { setSheets(await loadCheatsheets(user.id)); } catch { setError(true); } finally { setLoading(false); }
  }, [user?.id, role]);
  useEffect(() => { setSheets([]); setEditor(null); setSelected([]); refresh(); }, [refresh]);
  useEffect(() => {
    const state = location.state as { cheatsheetSource?: CheatsheetSource } | null;
    const source = state?.cheatsheetSource;
    if (role === "user" && source && typeof source.text === "string" && typeof source.title === "string") {
      setEditor({ initial: emptyCheatsheet(), source });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, role, navigate, location.pathname]);
  const shown = sheets.filter(s => matchesSearch(query, s.title, s.subject));
  if (role !== "user") return <><SiteHeader /><main className="container px-4 pt-28"><p>Taháky jsou dostupné v žákovském zobrazení.</p></main></>;
  return <div className="min-h-screen bg-background"><SiteHeader /><main className="mx-auto max-w-5xl px-4 pt-28 pb-24">
    {editor ? <CheatsheetEditor key={editor.existing?.id ?? "new"} initial={editor.initial} source={editor.source} onClose={() => setEditor(null)} onSave={async data => {
      if (!user) return;
      await saveCheatsheet(user.id, data, editor.existing);
      toast.success("Tahák uložen."); setEditor(null); await refresh();
    }} /> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><h1 className="text-2xl">Moje taháky</h1><Button className="min-h-11 gap-2" onClick={() => setEditor({ initial: emptyCheatsheet() })}><Plus className="h-4 w-4" />Nový tahák</Button></div>
      {sheets.length >= 8 && <Input className="mb-4" aria-label="Hledat tahák" placeholder="Hledat tahák" value={query} onChange={e => setQuery(e.target.value)} />}
      {!!selected.length && <Button variant="outline" className="mb-4 min-h-11 gap-2" onClick={async () => { try { await printCheatsheets(sheets.filter(s => selected.includes(s.id))); } catch { toast.error("Tisk není dostupný. Zkus to znovu."); } }}><Printer className="h-4 w-4" />Tisk / PDF ({selected.length})</Button>}
      {loading ? <Loader2 className="animate-spin h-6 w-6" aria-label="Načítání" /> : error ? <div role="alert"><p>Taháky se nepodařilo načíst.</p><Button variant="outline" className="min-h-11 mt-2" onClick={refresh}>Zkusit znovu</Button></div> : !shown.length ? <p className="text-muted-foreground">{query ? "Žádné taháky neodpovídají hledání." : "Zatím nemáš žádný tahák."}</p> : <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{shown.map(s => <li key={s.id} className="min-w-0 space-y-2">
        <Button variant="ghost" className="h-auto p-0 w-full text-left font-normal" aria-label={`Otočit tahák ${s.title}`} onClick={() => setFlipped(f => f.includes(s.id) ? f.filter(id => id !== s.id) : [...f, s.id])}><CheatsheetCard data={s} side={flipped.includes(s.id) ? "back" : "front"} /></Button>
        <div className="flex items-center justify-between gap-1"><label className="flex items-center gap-2 min-h-11 text-sm"><Checkbox aria-label={`Vybrat ${s.title} k tisku`} checked={selected.includes(s.id)} onCheckedChange={v => setSelected(ids => v === true ? [...ids, s.id] : ids.filter(id => id !== s.id))} />{flipped.includes(s.id) ? "Rub" : "Líc"}</label><div className="flex"><Button variant="ghost" size="icon" className="min-h-11 min-w-11" title="Upravit" aria-label={`Upravit ${s.title}`} onClick={() => setEditor({ initial: s, existing: s })}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="min-h-11 min-w-11" title="Duplikovat" aria-label={`Duplikovat ${s.title}`} onClick={() => setEditor({ initial: { version: 1, title: `${s.title.slice(0, 72)} (kopie)`, subject: s.subject, front: s.front, back: s.back, fontPt: s.fontPt } })}><Copy className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="min-h-11 min-w-11" title="Smazat" aria-label={`Smazat ${s.title}`} onClick={async () => { if (!user || !window.confirm(`Smazat tahák „${s.title}“?`)) return; try { await deleteCheatsheet(user.id, s); setSelected(ids => ids.filter(id => id !== s.id)); await refresh(); } catch { toast.error("Tahák se nepodařilo smazat. Zkus to znovu."); } }}><Trash2 className="h-4 w-4" /></Button></div></div>
      </li>)}</ul>}
    </>}
  </main></div>;
}