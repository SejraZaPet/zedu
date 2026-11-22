import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { TeacherNoteTarget } from "@/lib/live-teacher-notes";

interface TeacherNotesPanelProps {
  target: TeacherNoteTarget;
  initialValue: string;
  nextTitle?: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onNext: () => void;
  onSave: (target: TeacherNoteTarget, notes: string) => Promise<void>;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function TeacherNotesPanel({
  target,
  initialValue,
  nextTitle,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onMobileOpenChange,
  onNext,
  onSave,
}: TeacherNotesPanelProps) {
  const [value, setValue] = useState(initialValue);
  const [saveState, setSaveState] = useState<SaveState>(initialValue ? "saved" : "idle");
  const valueRef = useRef(value);
  const savedValueRef = useRef(initialValue);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const save = useCallback(async (text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    if (text === savedValueRef.current) {
      dirtyRef.current = false;
      if (mountedRef.current) setSaveState(text ? "saved" : "idle");
      return;
    }
    inFlightRef.current = text;
    if (mountedRef.current) setSaveState("saving");
    try {
      await onSave(target, text);
      savedValueRef.current = text;
      if (valueRef.current === text) dirtyRef.current = false;
      if (mountedRef.current && valueRef.current === text) setSaveState(text ? "saved" : "idle");
    } catch {
      dirtyRef.current = true;
      if (mountedRef.current) setSaveState("error");
    } finally {
      if (inFlightRef.current === text) inFlightRef.current = null;
    }
  }, [onSave, target]);

  const saveRef = useRef(save);
  saveRef.current = save;
  valueRef.current = value;

  useEffect(() => {
    if (value === savedValueRef.current) {
      dirtyRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setSaveState("idle");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveRef.current(valueRef.current), 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value]);

  useEffect(() => () => {
    mountedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    const latest = valueRef.current;
    if (dirtyRef.current && inFlightRef.current !== latest) {
      void onSave(target, latest).catch(() => {});
    }
  }, [onSave, target]);

  const flush = useCallback(async () => {
    if (dirtyRef.current) await saveRef.current(valueRef.current);
  }, []);

  const editor = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void flush()}
        aria-label="Poznámky řečníka k aktuálnímu slidu"
        placeholder="Napište si, co chcete říct, na co nezapomenout…"
        className="min-h-44 flex-1 resize-none bg-deck-cream/35 text-sm leading-relaxed lg:min-h-56"
      />
      <div className="min-h-5 text-xs" aria-live="polite">
        {saveState === "saving" && <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Ukládám…</span>}
        {saveState === "saved" && <span className="flex items-center gap-1.5 text-muted-foreground"><Check className="h-3.5 w-3.5" /> Uloženo</span>}
        {saveState === "error" && (
          <div className="flex items-center justify-between gap-2 text-destructive">
            <span>Poznámku se nepodařilo uložit.</span>
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => void saveRef.current(valueRef.current)}>Zkusit znovu</Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Poznámky vidíte jen vy, ne žáci ani projektor.</p>
      <div className="mt-auto border-t border-border pt-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Další slide</p>
        {nextTitle ? (
          <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-2 px-2 py-2 text-left" onClick={() => void flush().then(onNext)}>
            <span className="min-w-0 flex-1 truncate text-sm font-normal" title={nextTitle}>{nextTitle}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Button>
        ) : <p className="px-2 text-sm text-muted-foreground">Toto je poslední slide.</p>}
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Poznámky řečníka"
        className={`sticky top-[4.5rem] hidden h-[calc(100dvh-6rem)] shrink-0 self-start lg:flex ${collapsed ? "w-12" : "w-80 xl:w-[21rem]"}`}
      >
        {collapsed ? (
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-64 w-12 flex-col justify-start gap-3 bg-card py-3"
            onClick={() => onCollapsedChange(false)}
            aria-label="Rozbalit poznámky řečníka"
            title="Rozbalit poznámky řečníka"
          >
            <StickyNote className="h-5 w-5" />
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs [writing-mode:vertical-rl]">Poznámky řečníka</span>
          </Button>
        ) : (
          <section className="flex min-h-0 w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep"><StickyNote className="h-4 w-4" /> Poznámky řečníka</h2>
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => onCollapsedChange(true)} aria-label="Sbalit poznámky řečníka" title="Sbalit poznámky">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {editor}
          </section>
        )}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="right" className="flex w-[min(92vw,24rem)] flex-col sm:max-w-sm">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><StickyNote className="h-5 w-5" /> Poznámky řečníka</SheetTitle>
            <SheetDescription>Soukromé poznámky k aktuálnímu slidu.</SheetDescription>
          </SheetHeader>
          {editor}
        </SheetContent>
      </Sheet>
    </>
  );
}
