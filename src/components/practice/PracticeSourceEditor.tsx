import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, CheckCircle2, Images, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { CHEATSHEET_STORAGE_MARKER } from "@/lib/cheatsheet";
import { notebookPageText, practicePageLabel, type PracticeSource } from "@/lib/practice-method";
import { PRACTICE_PHOTO_PRIVACY_NOTICE } from "@/lib/practice-photo";
import { usePracticePhotos } from "@/lib/use-practice-photos";
import SourceInput from "@/components/sources/SourceInput";
import { useSourceBundle } from "@/lib/use-source-bundle";
import { MIN_SOURCE_TEXT_LENGTH, SOURCE_TEXT_LIMIT } from "../../../supabase/functions/_shared/practice-phases";

export type PracticeEditorSourceKind = PracticeSource["kind"] | "lesson";

interface PracticeSourceEditorProps {
  kind: PracticeEditorSourceKind;
  onKindChange: (kind: PracticeEditorSourceKind) => void;
  onSourceChange: (source: PracticeSource | null) => void;
  onBusyChange?: (busy: boolean) => void;
  allowLesson?: boolean;
  lessonContent?: React.ReactNode;
  idPrefix?: string;
  demoAccount?: boolean;
  disabled?: boolean;
}

/** Jediný vstup vlastního materiálu pro procvičování i Bezlai. Data drží jen v paměti. */
export default function PracticeSourceEditor({
  kind,
  onKindChange,
  onSourceChange,
  onBusyChange,
  allowLesson = false,
  lessonContent,
  idPrefix = "practice",
  demoAccount = false,
  disabled = false,
}: PracticeSourceEditorProps) {
  const { toast } = useToast();
  const [customText, setCustomText] = useState("");
  const fileSources = useSourceBundle("student", (description) => toast({ title: "Zdroj se nepodařilo přidat", description, variant: "destructive" }), { maxChars: SOURCE_TEXT_LIMIT, minChars: MIN_SOURCE_TEXT_LENGTH });
  const fileBusy = fileSources.state.busy;
  const [fileConfirmed, setFileConfirmed] = useState(false);
  useEffect(() => { setFileConfirmed(false); }, [fileSources.items]);
  const photos = usePracticePhotos((description) => toast({ title: "Příliš mnoho fotek", description, variant: "destructive" }));
  const { busy: photoBusy, text: photoText, setText: setPhotoText, review: photoReview, setReview: setPhotoReview,
    confirmed: photoConfirmed, setConfirmed: setPhotoConfirmed } = photos;
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoTextRef = useRef<HTMLTextAreaElement>(null);
  const [notebooks, setNotebooks] = useState<{ id: string; title: string }[]>([]);
  const [notebookId, setNotebookId] = useState("");
  const [pages, setPages] = useState<{ id: string; order: number; text: string }[]>([]);
  const [pageId, setPageId] = useState("");
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [notebookRetry, setNotebookRetry] = useState(0);
  const [pageRetry, setPageRetry] = useState(0);

  useEffect(() => {
    if (kind !== "photo") {
      photos.clear();
      setPhotoError(null);
    }
    // photos.clear je záměrně voláno jen při změně druhu zdroje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (kind !== "notebook") return;
    let cancelled = false;
    setNotebookLoading(true);
    setNotebookError(null);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Pro výběr sešitu se přihlas.");
        const { data, error } = await supabase.from("notebooks").select("id, title")
          .eq("owner_id", session.user.id)
          .or(`cover_color.is.null,cover_color.neq.${CHEATSHEET_STORAGE_MARKER}`)
          .order("title");
        if (error) throw error;
        if (!cancelled) setNotebooks((data ?? []) as { id: string; title: string }[]);
      } catch {
        if (!cancelled) setNotebookError("Sešity se nepodařilo načíst. Tvůj text v konverzaci zůstává zachovaný.");
      } finally {
        if (!cancelled) setNotebookLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, notebookRetry]);

  useEffect(() => {
    setPages([]);
    setPageId("");
    if (!notebookId) return;
    let cancelled = false;
    setNotebookLoading(true);
    setNotebookError(null);
    (async () => {
      try {
        const { data, error } = await supabase.from("notebook_pages").select("id, page_order, content")
          .eq("notebook_id", notebookId).order("page_order");
        if (error) throw error;
        if (!cancelled) setPages(((data ?? []) as { id: string; page_order: number; content: unknown }[]).map((row) => ({
          id: row.id,
          order: row.page_order,
          text: notebookPageText(row.content),
        })));
      } catch {
        if (!cancelled) setNotebookError("Stránky sešitu se nepodařilo načíst. Zkus to znovu.");
      } finally {
        if (!cancelled) setNotebookLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [notebookId, pageRetry]);

  const handlePhotoTextChange = (value: string) => {
    setPhotoText(value);
    setPhotoConfirmed(false);
    setPhotoError(null);
  };

  const handlePhotoConfirm = () => {
    const text = photoText.trim();
    if (text.length < MIN_SOURCE_TEXT_LENGTH) {
      setPhotoError(`Text je moc krátký. Potřebuju aspoň ${MIN_SOURCE_TEXT_LENGTH} znaků.`);
      setPhotoConfirmed(false);
      return;
    }
    if (text.length > SOURCE_TEXT_LIMIT) {
      setPhotoError(`Text je moc dlouhý. Zkrať ho na ${SOURCE_TEXT_LIMIT} znaků.`);
      setPhotoConfirmed(false);
      return;
    }
    setPhotoText(text);
    setPhotoError(null);
    setPhotoConfirmed(true);
  };

  const chosenSource = useMemo<PracticeSource | null>(() => {
    if (kind === "text") return { kind: "text", text: customText, label: "Vlastní text" };
    if (kind === "file") return fileSources.state.ok && (!fileSources.items.some((item) => item.kind === "photo") || fileConfirmed)
      ? { kind: "file", text: fileSources.state.text, label: fileSources.items.map((item) => item.label).join(", ") } : null;
    if (kind === "photo") {
      return photoConfirmed && photoText.trim().length <= SOURCE_TEXT_LIMIT
        ? { kind: "photo", text: photoText.trim(), label: "Fotografie" }
        : null;
    }
    if (kind === "notebook") {
      const page = pages.find((item) => item.id === pageId);
      const notebook = notebooks.find((item) => item.id === notebookId);
      return page ? {
        kind: "notebook",
        text: page.text,
        label: `Sešit ${notebook?.title ?? ""}, strana ${page.order + 1}`,
        href: `/student/sesit?otevrit=${encodeURIComponent(notebookId)}&strana=${encodeURIComponent(page.id)}`,
      } : null;
    }
    return null;
  }, [kind, customText, fileSources.items, fileConfirmed, photoConfirmed, photoText, pages, pageId, notebooks, notebookId]);

  useEffect(() => { onSourceChange(chosenSource); }, [chosenSource, onSourceChange]);
  useEffect(() => { onBusyChange?.(fileBusy || photoBusy || notebookLoading); }, [fileBusy, photoBusy, notebookLoading, onBusyChange]);

  const sourceTooLong = kind === "photo" && photoText.trim().length > SOURCE_TEXT_LIMIT;
  const sourceTooShort = kind !== "lesson" && (!chosenSource || chosenSource.text.trim().length < MIN_SOURCE_TEXT_LENGTH);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className="space-y-4 min-w-0">
      <div>
        <Label htmlFor={id("source")}>Zdroj</Label>
        <Select value={kind} onValueChange={(value) => onKindChange(value as PracticeEditorSourceKind)} disabled={disabled}>
          <SelectTrigger id={id("source")} className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {allowLesson && <SelectItem value="lesson">Lekce z učebnice</SelectItem>}
            <SelectItem value="text">Vlastní text</SelectItem>
            <SelectItem value="file">Soubory a vlastní zdroje</SelectItem>
            <SelectItem value="photo">Fotografie</SelectItem>
            <SelectItem value="notebook">Stránka mého sešitu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {kind === "lesson" && lessonContent}

      {kind === "text" && (
        <div>
          <Label htmlFor={id("text")}>Tvůj text</Label>
          <Textarea id={id("text")} rows={7} maxLength={SOURCE_TEXT_LIMIT} value={customText}
            onChange={(event) => setCustomText(event.target.value)} className="mt-1 text-base"
            placeholder="Vlož sem zápis, výpisky nebo text z učebnice." disabled={disabled} />
          <p className="text-xs text-muted-foreground mt-1">
            {customText.length} / {SOURCE_TEXT_LIMIT} znaků (aspoň {MIN_SOURCE_TEXT_LENGTH}). Text se nikam neukládá, použije se jen v této konverzaci nebo pro otázky.
          </p>
        </div>
      )}

      {kind === "file" && (
        <div className="space-y-2">
          <SourceInput bundle={fileSources} disabled={disabled} allowUrl={false} />
          {fileSources.items.some((item) => item.kind === "photo") && <>
            <p className="text-sm">Přepsáno AI – zkontroluj text fotografií před použitím.</p>
            <Button type="button" className="min-h-11" disabled={disabled || !fileSources.state.ok || fileConfirmed} onClick={() => setFileConfirmed(true)}>{fileConfirmed ? "Text je potvrzený" : "Potvrdit text"}</Button>
          </>}
        </div>
      )}

      {kind === "photo" && (
        <div className="space-y-3 min-w-0">
          <p className="text-sm rounded-md border border-border bg-muted/40 p-3">{PRACTICE_PHOTO_PRIVACY_NOTICE}</p>
          {demoAccount && <p role="note" className="text-sm border border-border rounded-md p-3">Demo účet má limit 5 AI volání. Každá fotka spotřebuje jedno volání; další volání potřebuje i Bezlai nebo procvičování. Více fotek může limit vyčerpat.</p>}
          <input ref={photoInputRef} id={id("photo")} type="file" accept="image/*" multiple className="hidden" disabled={photoBusy || disabled}
            onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void photos.add(files); }} />
          <input ref={cameraInputRef} id={id("photo-camera")} type="file" accept="image/*" capture="environment" className="hidden" disabled={photoBusy || disabled}
            onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void photos.add(files); }} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={photoBusy || disabled} onClick={() => photoInputRef.current?.click()}><Images className="h-4 w-4" />Vybrat fotografie</Button>
            <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={photoBusy || disabled} onClick={() => cameraInputRef.current?.click()}><Camera className="h-4 w-4" />Vyfotit stránku</Button>
          </div>
          <p className="text-xs text-muted-foreground">{photos.entries.length} / 6 fotek</p>
          {photoBusy && <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{photos.progress}</p>}
          <ol className="space-y-3">
            {photos.entries.map((entry, index) => (
              <li key={entry.id} className="rounded-md border border-border p-3 space-y-2 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Fotka {index + 1}</span>
                  <div className="flex shrink-0">
                    <Button type="button" variant="ghost" size="icon" title="Posunout nahoru" aria-label={`Fotka ${index + 1}: nahoru`} disabled={photoBusy || index === 0} onClick={() => photos.move(entry.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" title="Posunout dolů" aria-label={`Fotka ${index + 1}: dolů`} disabled={photoBusy || index === photos.entries.length - 1} onClick={() => photos.move(entry.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" variant="ghost" size="icon" title="Odebrat fotku" aria-label={`Fotka ${index + 1}: odebrat`} disabled={photoBusy} onClick={() => photos.remove(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {entry.photo && <img src={entry.photo.previewUrl} alt="Náhled fotografie stránky s učivem" className="max-h-48 w-full rounded-md object-contain" />}
                {entry.text && <p className="text-xs text-primary">Přepsáno AI</p>}
                {entry.error && <><p role="alert" className="text-sm text-destructive break-words">{entry.error}</p><Button type="button" variant="outline" className="gap-2" disabled={photoBusy} onClick={() => void photos.retry(entry.id)}><RotateCcw className="h-4 w-4" />Zkusit znovu</Button></>}
              </li>
            ))}
          </ol>
          {photos.entries.some((entry) => !entry.text && !entry.error) && <Button type="button" className="min-h-11 w-full gap-2" disabled={photoBusy || disabled} onClick={() => void photos.transcribe()}><Sparkles className="h-4 w-4" />{photos.entries.length === 1 ? "Přečíst text z fotky" : "Přečíst text z fotek"}</Button>}
          {photos.entries.length > 0 && <Button type="button" variant="outline" className="min-h-11" disabled={photoBusy || disabled} onClick={() => { setPhotoReview(true); setPhotoConfirmed(false); requestAnimationFrame(() => photoTextRef.current?.focus()); }}>Upravit / doplnit ručně</Button>}
          {photoReview && (
            <div className="space-y-3">
              <Label htmlFor={id("photo-text")} className="font-medium">Přepsáno AI – zkontroluj text</Label>
              <Textarea ref={photoTextRef} id={id("photo-text")} rows={8} value={photoText} onChange={(event) => handlePhotoTextChange(event.target.value)} className="mt-1 text-base" placeholder="Doplň nebo opiš text z fotek." disabled={photoBusy || disabled} />
              <p className="text-xs text-muted-foreground">{photoText.trim().length} / {SOURCE_TEXT_LIMIT} znaků (aspoň {MIN_SOURCE_TEXT_LENGTH}). Fotky se neukládají; po potvrzení se použije jen tento text.</p>
              {(photoError || sourceTooLong) && <p role="alert" className="text-sm text-destructive">{sourceTooLong ? `Text je moc dlouhý. Zkrať ho na ${SOURCE_TEXT_LIMIT} znaků; žádný text nebyl oříznut.` : photoError}</p>}
              <Button type="button" className="min-h-11 w-full" disabled={photoBusy || disabled || photoText.trim().length < MIN_SOURCE_TEXT_LENGTH || sourceTooLong} onClick={handlePhotoConfirm}>Potvrdit text</Button>
              {photoConfirmed && <p role="status" className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />Text je potvrzený. Teď ho můžeš použít.</p>}
            </div>
          )}
        </div>
      )}

      {kind === "notebook" && (
        <div className="space-y-3">
          {notebookError ? (
            <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-3 text-sm"><p>{notebookError}</p><Button type="button" variant="outline" size="sm" className="min-h-11" disabled={notebookLoading} onClick={() => { if (notebookId) setPageRetry((value) => value + 1); else setNotebookRetry((value) => value + 1); }}>Zkusit znovu</Button></div>
          ) : (
            <>
              <div>
                <Label htmlFor={id("notebook")}>Sešit</Label>
                {notebookLoading && notebooks.length === 0 ? <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Načítám sešity…</p> : notebooks.length >= 8 ? (
                  <SearchableSelect id={id("notebook")} value={notebookId} onValueChange={setNotebookId}
                    options={notebooks.map((notebook) => ({ value: notebook.id, label: notebook.title }))}
                    placeholder="Vyber sešit" label="Hledat sešit" growing disabled={disabled} />
                ) : (
                  <Select value={notebookId} onValueChange={setNotebookId} disabled={disabled}>
                    <SelectTrigger id={id("notebook")} className="mt-1"><SelectValue placeholder="Vyber sešit" /></SelectTrigger>
                    <SelectContent>{notebooks.map((notebook) => <SelectItem key={notebook.id} value={notebook.id}>{notebook.title}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {!notebookLoading && notebooks.length === 0 && <p className="text-xs text-muted-foreground mt-1">Zatím nemáš žádný sešit. Shrnutí konverzace můžeš později uložit do nového sešitu.</p>}
              </div>
              {notebookId && (
                <div>
                  <Label htmlFor={id("page")}>Stránka</Label>
                  {notebookLoading ? <p role="status" className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Načítám stránky…</p> : pages.length >= 8 ? (
                    <SearchableSelect id={id("page")} value={pageId} onValueChange={setPageId}
                      options={pages.map((page) => ({ value: page.id, label: practicePageLabel(page), disabled: !page.text }))}
                      placeholder="Vyber stránku" label="Hledat stránku" growing disabled={disabled} />
                  ) : (
                    <Select value={pageId} onValueChange={setPageId} disabled={disabled}>
                      <SelectTrigger id={id("page")} className="mt-1"><SelectValue placeholder="Vyber stránku" /></SelectTrigger>
                      <SelectContent>{pages.map((page) => <SelectItem key={page.id} value={page.id} disabled={!page.text}>{practicePageLabel(page)}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Použijeme jen text z textových polí na stránce.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {kind !== "lesson" && sourceTooShort && (kind !== "photo" || photoReview) && (
        <p className="text-xs text-muted-foreground">Potřebuju aspoň {MIN_SOURCE_TEXT_LENGTH} znaků textu.</p>
      )}
      {sourceTooLong && <p className="text-xs text-muted-foreground">Text je potřeba zkrátit na {SOURCE_TEXT_LIMIT} znaků.</p>}
    </div>
  );
}
