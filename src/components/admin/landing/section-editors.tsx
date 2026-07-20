import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { LandingIconSelect } from "./LandingIconSelect";
import { LandingImageInput } from "./LandingImageInput";
import {
  DEFAULT_HERO_PROPS,
  DEFAULT_SOCIAL_PROOF_PROPS,
  DEFAULT_FEATURES_GRID_PROPS,
  DEFAULT_HOW_IT_WORKS_PROPS,
  DEFAULT_FOR_WHOM_PROPS,
  DEFAULT_PLATFORM_SHOWCASE_PROPS,
  DEFAULT_PODCAST_PROPS,
  DEFAULT_FINAL_CTA_PROPS,
} from "@/lib/landing-defaults";

// Generic props for every section editor.
export interface SectionEditorProps {
  value: Record<string, any>;
  onChange: (next: Record<string, any>) => void;
}

// ---------- Small helpers ----------

function TextField({ label, value, onChange, placeholder, textarea }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {textarea ? (
        <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
      ) : (
        <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

function ListEditor<T>({
  items,
  onChange,
  createNew,
  renderItem,
  addLabel,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  createNew: () => T;
  renderItem: (item: T, i: number, update: (next: T) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border p-3 bg-muted/20 space-y-2 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">#{i + 1}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          {renderItem(item, i, (next) => onChange(items.map((it, j) => (j === i ? next : it))))}
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, createNew()])}>
        <Plus className="w-4 h-4 mr-1" /> {addLabel}
      </Button>
    </div>
  );
}

// ---------- Hero ----------

function HeroEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_HERO_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  const features = Array.isArray(p.features) ? p.features : [];
  return (
    <div className="space-y-4">
      <TextField label="Podtitulek" value={p.subtitle} onChange={(v) => update({ subtitle: v })} textarea />
      <TextField label="Disclaimer (drobný text pod tlačítky)" value={p.disclaimer} onChange={(v) => update({ disclaimer: v })} />
      <TextField
        label="Části nadpisu (oddělené čárkou)"
        value={(p.title_parts || []).join(", ")}
        onChange={(v) => update({ title_parts: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder="Tvoř, Uč, Objevuj"
      />
      <LandingImageInput label="Pozadí (background)" value={p.background_image_url} onChange={(v) => update({ background_image_url: v })} />
      <LandingImageInput label="Logo v hero" value={p.logo_image_url} onChange={(v) => update({ logo_image_url: v })} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2">
          <div className="text-xs font-semibold">Primární tlačítko</div>
          <TextField label="Text" value={p.primary_cta?.label ?? ""} onChange={(v) => update({ primary_cta: { ...p.primary_cta, label: v } })} />
          <TextField label="Odkaz" value={p.primary_cta?.href ?? ""} onChange={(v) => update({ primary_cta: { ...p.primary_cta, href: v } })} placeholder="/auth" />
          <LandingIconSelect label="Ikona" value={p.primary_cta?.icon ?? ""} onChange={(v) => update({ primary_cta: { ...p.primary_cta, icon: v } })} />
        </div>
        <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2">
          <div className="text-xs font-semibold">Sekundární tlačítko</div>
          <TextField label="Text" value={p.secondary_cta?.label ?? ""} onChange={(v) => update({ secondary_cta: { ...p.secondary_cta, label: v } })} />
          <TextField label="Scroll na sekci (id)" value={p.secondary_cta?.scroll_to ?? ""} onChange={(v) => update({ secondary_cta: { ...p.secondary_cta, scroll_to: v } })} placeholder="jak-to-funguje" />
          <LandingIconSelect label="Ikona" value={p.secondary_cta?.icon ?? ""} onChange={(v) => update({ secondary_cta: { ...p.secondary_cta, icon: v } })} />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">Tři feature karty pod hero</Label>
        <ListEditor
          items={features}
          onChange={(next) => update({ features: next })}
          createNew={() => ({ icon: "Sparkles", title: "", description: "", href: null as string | null })}
          addLabel="Přidat kartu"
          renderItem={(f, _i, u) => (
            <>
              <LandingIconSelect label="Ikona" value={f.icon} onChange={(v) => u({ ...f, icon: v })} />
              <TextField label="Nadpis" value={f.title} onChange={(v) => u({ ...f, title: v })} />
              <TextField label="Popis" value={f.description} onChange={(v) => u({ ...f, description: v })} textarea />
              <TextField label="Odkaz (volitelný)" value={f.href ?? ""} onChange={(v) => u({ ...f, href: v.trim() === "" ? null : v })} placeholder="/aktivity" />
            </>
          )}
        />
      </div>
    </div>
  );
}

// ---------- Social Proof ----------

function SocialProofEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_SOCIAL_PROOF_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs mb-2 block">Metriky (obvykle 4)</Label>
        <ListEditor
          items={p.metrics ?? []}
          onChange={(next) => update({ metrics: next })}
          createNew={() => ({ icon: "Sparkles", value: "", label: "" })}
          addLabel="Přidat metriku"
          renderItem={(m, _i, u) => (
            <>
              <LandingIconSelect label="Ikona" value={m.icon} onChange={(v) => u({ ...m, icon: v })} />
              <TextField label="Hodnota" value={m.value} onChange={(v) => u({ ...m, value: v })} placeholder="56" />
              <TextField label="Popisek" value={m.label} onChange={(v) => u({ ...m, label: v })} />
            </>
          )}
        />
      </div>
      <div>
        <Label className="text-xs mb-2 block">Odznaky (badges)</Label>
        <ListEditor
          items={(p.badges ?? []).map((s) => ({ text: s }))}
          onChange={(next) => update({ badges: next.map((n: any) => n.text) })}
          createNew={() => ({ text: "" })}
          addLabel="Přidat odznak"
          renderItem={(b: any, _i, u) => <TextField label="Text" value={b.text} onChange={(v) => u({ text: v })} />}
        />
      </div>
    </div>
  );
}

// ---------- Features Grid ----------

function FeaturesGridEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_FEATURES_GRID_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-4">
      <TextField label="Nadpis" value={p.title} onChange={(v) => update({ title: v })} />
      <TextField label="Podtitulek" value={p.subtitle} onChange={(v) => update({ subtitle: v })} />
      <Label className="text-xs mb-2 block">Karty (obvykle 6)</Label>
      <ListEditor
        items={p.features ?? []}
        onChange={(next) => update({ features: next })}
        createNew={() => ({ icon: "Sparkles", title: "", description: "" })}
        addLabel="Přidat kartu"
        renderItem={(f, _i, u) => (
          <>
            <LandingIconSelect label="Ikona" value={f.icon} onChange={(v) => u({ ...f, icon: v })} />
            <TextField label="Nadpis" value={f.title} onChange={(v) => u({ ...f, title: v })} />
            <TextField label="Popis" value={f.description} onChange={(v) => u({ ...f, description: v })} textarea />
          </>
        )}
      />
    </div>
  );
}

// ---------- How it works ----------

function HowItWorksEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_HOW_IT_WORKS_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-4">
      <TextField label="Nadpis" value={p.title} onChange={(v) => update({ title: v })} />
      <TextField label="Podtitulek" value={p.subtitle} onChange={(v) => update({ subtitle: v })} />
      <TextField label="Anchor ID (pro scroll z hero)" value={p.anchor_id} onChange={(v) => update({ anchor_id: v })} placeholder="jak-to-funguje" />
      <Label className="text-xs mb-2 block">Kroky (obvykle 3)</Label>
      <ListEditor
        items={p.steps ?? []}
        onChange={(next) => update({ steps: next.map((s: any, i: number) => ({ ...s, n: s.n ?? i + 1 })) })}
        createNew={() => ({ n: (p.steps?.length ?? 0) + 1, title: "", desc: "" })}
        addLabel="Přidat krok"
        renderItem={(s, _i, u) => (
          <>
            <TextField label="Nadpis" value={s.title} onChange={(v) => u({ ...s, title: v })} />
            <TextField label="Popis" value={s.desc} onChange={(v) => u({ ...s, desc: v })} textarea />
          </>
        )}
      />
      <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2">
        <div className="text-xs font-semibold">CTA tlačítko</div>
        <TextField label="Text" value={p.cta?.label ?? ""} onChange={(v) => update({ cta: { ...p.cta, label: v } })} />
        <TextField label="Odkaz" value={p.cta?.href ?? ""} onChange={(v) => update({ cta: { ...p.cta, href: v } })} placeholder="/auth" />
      </div>
    </div>
  );
}

// ---------- For whom ----------

function ForWhomEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_FOR_WHOM_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-4">
      <TextField label="Nadpis" value={p.title} onChange={(v) => update({ title: v })} />
      <TextField label="Podtitulek" value={p.subtitle} onChange={(v) => update({ subtitle: v })} />
      <Label className="text-xs mb-2 block">Karty (obvykle 3 — učitel/žák/rodič)</Label>
      <ListEditor
        items={p.cards ?? []}
        onChange={(next) => update({ cards: next })}
        createNew={() => ({ icon: "UserRound", title: "", bullets: [], cta: "", to: "" })}
        addLabel="Přidat kartu"
        renderItem={(c, _i, u) => (
          <>
            <LandingIconSelect label="Ikona" value={c.icon} onChange={(v) => u({ ...c, icon: v })} />
            <TextField label="Nadpis" value={c.title} onChange={(v) => u({ ...c, title: v })} />
            <TextField
              label="Bullety (jeden na řádek)"
              value={(c.bullets || []).join("\n")}
              onChange={(v) => u({ ...c, bullets: v.split("\n").map((s: string) => s.trim()).filter(Boolean) })}
              textarea
            />
            <TextField label="CTA text" value={c.cta} onChange={(v) => u({ ...c, cta: v })} placeholder="Začít jako učitel →" />
            <TextField label="CTA odkaz" value={c.to} onChange={(v) => u({ ...c, to: v })} placeholder="/auth?role=teacher" />
          </>
        )}
      />
    </div>
  );
}

// ---------- Platform showcase ----------

function PlatformShowcaseEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_PLATFORM_SHOWCASE_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-4">
      <TextField label="Nadpis" value={p.title} onChange={(v) => update({ title: v })} />
      <TextField label="Podtitulek" value={p.subtitle} onChange={(v) => update({ subtitle: v })} />
      <Label className="text-xs mb-2 block">Taby (obvykle 4)</Label>
      <ListEditor
        items={p.tabs ?? []}
        onChange={(next) => update({ tabs: next })}
        createNew={() => ({ label: "", image_url: "" })}
        addLabel="Přidat tab"
        renderItem={(t, _i, u) => (
          <>
            <TextField label="Název tabu" value={t.label} onChange={(v) => u({ ...t, label: v })} />
            <LandingImageInput label="Screenshot" value={t.image_url} onChange={(v) => u({ ...t, image_url: v })} />
          </>
        )}
      />
    </div>
  );
}

// ---------- Podcast ----------

function PodcastEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_PODCAST_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Podcast sekce čte epizody z tabulky <code>podcast_episodes</code>. Zde nastavíte jen nadpis a limit.
        Samotné epizody spravujte v záložce <strong>Podcast</strong>.
      </p>
      <TextField label="Eyebrow (drobný nadpis)" value={p.eyebrow} onChange={(v) => update({ eyebrow: v })} />
      <TextField label="Nadpis" value={p.title} onChange={(v) => update({ title: v })} />
      <div className="space-y-1">
        <Label className="text-xs">Limit epizod</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={p.limit ?? 5}
          onChange={(e) => update({ limit: Math.max(1, Math.min(20, parseInt(e.target.value || "5", 10))) })}
        />
      </div>
    </div>
  );
}

// ---------- Final CTA ----------

function FinalCTAEditor({ value, onChange }: SectionEditorProps) {
  const p = { ...DEFAULT_FINAL_CTA_PROPS, ...value };
  const update = (patch: Partial<typeof p>) => onChange({ ...p, ...patch });
  return (
    <div className="space-y-4">
      <TextField label="Nadpis" value={p.title} onChange={(v) => update({ title: v })} />
      <TextField label="Podtitulek" value={p.subtitle} onChange={(v) => update({ subtitle: v })} />
      <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2">
        <div className="text-xs font-semibold">Primární tlačítko</div>
        <TextField label="Text" value={p.primary_cta?.label ?? ""} onChange={(v) => update({ primary_cta: { ...p.primary_cta, label: v } })} />
        <TextField label="Odkaz" value={p.primary_cta?.href ?? ""} onChange={(v) => update({ primary_cta: { ...p.primary_cta, href: v } })} />
        <LandingIconSelect label="Ikona" value={p.primary_cta?.icon ?? ""} onChange={(v) => update({ primary_cta: { ...p.primary_cta, icon: v } })} />
      </div>
      <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-2">
        <div className="text-xs font-semibold">Sekundární odkaz</div>
        <TextField label="Text" value={p.secondary_link?.label ?? ""} onChange={(v) => update({ secondary_link: { ...p.secondary_link, label: v } })} />
        <TextField label="Odkaz" value={p.secondary_link?.href ?? ""} onChange={(v) => update({ secondary_link: { ...p.secondary_link, href: v } })} />
      </div>
      <TextField label="Kontaktní e-mail" value={p.contact_email} onChange={(v) => update({ contact_email: v })} placeholder="info@zedu.cz" />
    </div>
  );
}

// ---------- Registry ----------

export const SECTION_EDITORS: Record<string, React.ComponentType<SectionEditorProps>> = {
  hero: HeroEditor,
  social_proof: SocialProofEditor,
  features_grid: FeaturesGridEditor,
  how_it_works: HowItWorksEditor,
  for_whom: ForWhomEditor,
  platform_showcase: PlatformShowcaseEditor,
  podcast: PodcastEditor,
  final_cta: FinalCTAEditor,
};

export const SECTION_TYPE_LABELS: Record<string, string> = {
  hero: "Hero (úvodní obrazovka)",
  social_proof: "Social proof (metriky + odznaky)",
  features_grid: "Mřížka funkcí",
  how_it_works: "Jak to funguje",
  for_whom: "Pro koho",
  platform_showcase: "Ukázka platformy",
  podcast: "Podcast (odkaz na epizody)",
  final_cta: "Finální CTA",
};
