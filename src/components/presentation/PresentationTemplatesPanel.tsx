import { useEffect, useMemo, useState } from "react";
import { Bookmark, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SlidePreviewFrame from "@/components/presentation/SlidePreviewFrame";
import { BEZLI_DECK_TEMPLATES, PRESENTATION_TEMPLATES, SLIDE_TEMPLATES, cloneTemplateSlides } from "@/lib/presentation-templates";
import { PRESENTATION_THEMES } from "@/lib/presentation-themes";
import { customTemplateSlides, deleteCustomPresentationTemplate, loadCustomPresentationTemplates, saveCustomPresentationTemplate, type CustomPresentationTemplate, type CustomTemplateScope } from "@/lib/presentation-custom-templates";

interface Props {
  userId?: string;
  currentSlide: any;
  allSlides: any[];
  hasContent: boolean;
  themeId: string;
  onThemeChange: (id: string) => void;
  onInsertSlide: (slides: any[]) => void;
  onApplyDeck: (slides: any[]) => void;
}

type PendingDeck = { name: string; slides: any[] } | null;

export default function PresentationTemplatesPanel({ userId, currentSlide, allSlides, hasContent, themeId, onThemeChange, onInsertSlide, onApplyDeck }: Props) {
  const { toast } = useToast();
  const [custom, setCustom] = useState<CustomPresentationTemplate[]>([]);
  const [saveScope, setSaveScope] = useState<CustomTemplateScope | null>(null);
  const [name, setName] = useState("");
  const [pendingDeck, setPendingDeck] = useState<PendingDeck>(null);
  const slidePreviews = useMemo(() => SLIDE_TEMPLATES.map((template) => ({ template, slide: template.build() })), []);
  const decks = useMemo(() => [...BEZLI_DECK_TEMPLATES, ...PRESENTATION_TEMPLATES], []);
  const deckPreviews = useMemo(() => decks.map((template) => ({ template, slides: template.build() })), [decks]);

  useEffect(() => { if (userId) setCustom(loadCustomPresentationTemplates(userId)); }, [userId]);

  const applyDeck = (name: string, slides: any[]) => {
    if (hasContent) { setPendingDeck({ name, slides }); return; }
    onApplyDeck(cloneTemplateSlides(slides));
  };
  const save = () => {
    if (!saveScope || !userId) return;
    try {
      saveCustomPresentationTemplate(userId, name, saveScope, saveScope === "slide" ? [currentSlide] : allSlides);
      setCustom(loadCustomPresentationTemplates(userId));
      toast({ title: "Šablona uložena", description: "Vlastní šablona je dostupná v tomto prohlížeči." });
      setSaveScope(null); setName("");
    } catch (error: any) {
      toast({ title: "Šablonu se nepodařilo uložit", description: error?.message || "Zkuste to prosím znovu.", variant: "destructive" });
    }
  };
  const customCard = (template: CustomPresentationTemplate) => (
    <article key={template.id} className="deck-template-card relative">
      <SlidePreviewFrame slide={template.slides[0]} themeId={template.slides[0]?.themeId || themeId} label={`Náhled ${template.name}`} />
      <div className="p-3 pr-9">
        <h3 className="text-xs font-semibold text-deck-ink">{template.name}</h3>
        <p className="mt-1 text-[11px] text-deck-muted">Vlastní · {template.scope === "slide" ? "1 slide" : `${template.slides.length} slidů`}</p>
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => template.scope === "slide" ? onInsertSlide(customTemplateSlides(template)) : applyDeck(template.name, template.slides)}>
          <Plus className="mr-1 h-3.5 w-3.5" />{template.scope === "slide" ? "Vložit jako nový slide" : "Použít pro celou prezentaci"}
        </Button>
      </div>
      <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8 bg-deck-panel/90" aria-label={`Smazat vlastní šablonu ${template.name}`} onClick={() => userId && setCustom(deleteCustomPresentationTemplate(userId, template.id))}><Trash2 className="h-4 w-4" /></Button>
    </article>
  );

  return (
    <div className="space-y-5">
      <section>
        <h2 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Uložit vlastní šablonu</h2>
        <p className="mt-1 text-[11px] text-deck-muted">Vlastní šablony zůstávají pouze v tomto prohlížeči. Obsah prezentace se nijak nepřepíše.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" disabled={!userId || !currentSlide} onClick={() => { setName(currentSlide?.projector?.headline || "Můj slide"); setSaveScope("slide"); }}><Bookmark className="mr-1 h-3.5 w-3.5" />Aktuální slide</Button>
          <Button variant="outline" size="sm" disabled={!userId || !allSlides.length} onClick={() => { setName("Moje prezentace"); setSaveScope("deck"); }}><Bookmark className="mr-1 h-3.5 w-3.5" />Celou prezentaci</Button>
        </div>
      </section>

      {custom.length > 0 && <section className="border-t border-deck-line pt-4"><h2 className="mb-3 font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Vlastní šablony</h2><div className="space-y-3">{custom.map(customCard)}</div></section>}

      <section className="border-t border-deck-line pt-4">
        <h2 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Šablony slidů</h2>
        <p className="mb-3 mt-1 text-[11px] text-deck-muted">Vloží vždy nový slide za aktuální. Existující obsah zůstane zachovaný.</p>
        <div className="grid grid-cols-2 gap-3">
          {slidePreviews.map(({ template, slide }) => <article key={template.id} className="deck-template-card">
            <SlidePreviewFrame slide={slide} themeId={slide.themeId} label={`Náhled šablony ${template.name}`} />
            <div className="p-2"><h3 className="text-xs font-semibold text-deck-ink">{template.name}</h3><p className="mt-1 min-h-8 text-[10px] text-deck-muted">{template.description}</p>
              <Button variant="outline" size="sm" className="mt-2 w-full px-1 text-[11px]" onClick={() => onInsertSlide([template.build()])}><Plus className="mr-1 h-3 w-3" />Nový slide</Button>
            </div>
          </article>)}
        </div>
      </section>

      <section className="border-t border-deck-line pt-4">
        <h2 className="font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Celé prezentace</h2>
        <p className="mb-3 mt-1 text-[11px] text-deck-muted">Použití sady nahradí slidy až po vašem potvrzení.</p>
        <div className="space-y-3">{deckPreviews.map(({ template, slides }) => <article key={template.id} className="deck-template-card">
          <SlidePreviewFrame slide={slides[0]} themeId={slides[0]?.themeId || themeId} label={`Náhled prezentace ${template.name}`} />
          <div className="p-3"><h3 className="text-xs font-semibold text-deck-ink">{template.name}</h3><p className="mt-1 text-[11px] text-deck-muted">{template.description} · {slides.length} {slides.length === 1 ? "slide" : "slidy"}</p>
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => applyDeck(template.name, slides)}><Check className="mr-1 h-3.5 w-3.5" />Použít pro celou prezentaci</Button>
          </div>
        </article>)}</div>
      </section>

      <section className="border-t border-deck-line pt-4">
        <h2 className="mb-3 font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep">Motivy</h2>
        <div className="grid grid-cols-2 gap-2">{PRESENTATION_THEMES.map((item) => <button key={item.id} type="button" aria-label={`Použít motiv ${item.name}`} aria-pressed={themeId === item.id} onClick={() => onThemeChange(item.id)} className={`rounded-lg border-2 p-1 text-left text-[11px] ${themeId === item.id ? "border-deck-violet" : "border-deck-line"}`}><span className={`mb-1 flex h-12 items-end rounded p-1 text-[9px] font-semibold ${item.isDark ? "text-deck-on-violet" : "text-deck-ink"}`} style={{ background: item.backgroundStyle }}>{item.name}</span></button>)}</div>
      </section>

      <Dialog open={!!saveScope} onOpenChange={(open) => { if (!open) setSaveScope(null); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Uložit jako šablonu</DialogTitle><DialogDescription>{saveScope === "slide" ? "Uloží se aktuální slide včetně aktivit a poznámek." : "Uloží se celá prezentace včetně aktivit a poznámek."} Šablona bude dostupná jen v tomto prohlížeči.</DialogDescription></DialogHeader>
          <Input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} aria-label="Název vlastní šablony" placeholder="Název šablony" />
          <DialogFooter><Button variant="outline" onClick={() => setSaveScope(null)}>Zrušit</Button><Button onClick={save} disabled={!name.trim()}>Uložit šablonu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!pendingDeck} onOpenChange={(open) => { if (!open) setPendingDeck(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Nahradit aktuální prezentaci?</AlertDialogTitle><AlertDialogDescription>Šablona „{pendingDeck?.name}“ nahradí všechny aktuální slidy. Tuto změnu můžete ihned vrátit pomocí Zpět, dokud editor nezavřete.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Zrušit</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingDeck) onApplyDeck(cloneTemplateSlides(pendingDeck.slides)); setPendingDeck(null); }}>Ano, použít šablonu</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
