import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, MessageSquare, Phone, Plus, Star } from "lucide-react";
import { CRM_INTERACTION_TYPES } from "@/lib/staff-modules";

interface Interaction {
  id: string;
  type: string;
  summary: string;
  occurred_at: string;
  next_step: string | null;
  next_step_date: string | null;
  created_by: string | null;
}

interface Author {
  name: string;
  initials: string;
}

/** Záložní zkratka z celého jména: "Kristýna Herinková" → "KH" */
const autoInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "—";

const typeIcon = (t: string) =>
  t === "telefon" ? Phone : t === "email" ? Mail : t === "schuzka" ? Star : MessageSquare;

const emptyForm = {
  type: "telefon",
  summary: "",
  occurred_at: new Date().toISOString().slice(0, 10),
  next_step: "",
  next_step_date: "",
};

interface Props {
  /** Uživatel (učitel/lektor), ke kterému se vedou poznámky */
  relatedUserId: string;
  /** Bez práva editace jde jen o čtení */
  canEdit?: boolean;
}

/** Poznámky a historie jednání navázané na konkrétního uživatele (crm_interactions.related_user_id). */
const UserInteractionsSection = ({ relatedUserId, canEdit = true }: Props) => {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("crm_interactions")
      .select("id, type, summary, occurred_at, next_step, next_step_date, created_by")
      .eq("related_user_id", relatedUserId)
      .order("occurred_at", { ascending: false });
    const rows = (data ?? []) as Interaction[];
    setInteractions(rows);

    const ids = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]));
    if (ids.length) {
      const [{ data: profiles }, { data: staff }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name").in("id", ids),
        supabase.from("staff_members").select("profile_id, initials").in("profile_id", ids),
      ]);
      const initialsById = new Map((staff ?? []).map((s: any) => [s.profile_id, s.initials]));
      const map: Record<string, Author> = {};
      (profiles ?? []).forEach((p: any) => {
        const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Neznámý autor";
        const manual = (initialsById.get(p.id) ?? "")?.trim();
        map[p.id] = { name, initials: manual || autoInitials(name) };
      });
      setAuthors(map);
    } else {
      setAuthors({});
    }
    setLoading(false);
  }, [relatedUserId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!form.summary.trim()) {
      toast({ title: "Zadejte souhrn jednání", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("crm_interactions").insert({
      related_user_id: relatedUserId,
      type: form.type,
      summary: form.summary.trim(),
      occurred_at: new Date(form.occurred_at).toISOString(),
      next_step: form.next_step || null,
      next_step_date: form.next_step_date || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Uložení záznamu selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm(emptyForm);
    void load();
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Poznámky a historie jednání</h4>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => { setForm(emptyForm); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Přidat záznam
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím žádné záznamy jednání.</p>
      ) : (
        <ol className="divide-y divide-border rounded-md border border-border">
          {interactions.map((i) => {
            const Icon = typeIcon(i.type);
            const author = i.created_by ? authors[i.created_by] : undefined;
            const isOpen = !!expanded[i.id];
            const date = new Date(i.occurred_at);
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [i.id]: !e[i.id] }))}
                  aria-expanded={isOpen}
                  title={`${author?.name ?? "Neznámý autor"} · ${date.toLocaleString("cs-CZ")}`}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {date.toLocaleDateString("cs-CZ")}
                  </span>
                  <span className="shrink-0 text-muted-foreground">·</span>
                  <span className="shrink-0 font-medium">{author?.initials ?? "—"}:</span>
                  <span className={isOpen ? "whitespace-pre-wrap" : "truncate"}>{i.summary}</span>
                </button>
                {isOpen && (
                  <div className="space-y-1 px-3 pb-2 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {CRM_INTERACTION_TYPES.find((t) => t.value === i.type)?.label ?? i.type}
                      {" · "}
                      {author?.name ?? "Neznámý autor"}
                      {" · "}
                      {date.toLocaleString("cs-CZ")}
                    </p>
                    {i.next_step && (
                      <p>
                        Další krok: {i.next_step}
                        {i.next_step_date ? ` (${new Date(i.next_step_date).toLocaleDateString("cs-CZ")})` : ""}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Záznam jednání</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_INTERACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum</Label>
                <Input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Souhrn *</Label>
              <Textarea rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Další krok</Label>
                <Input value={form.next_step} onChange={(e) => setForm({ ...form, next_step: e.target.value })} />
              </div>
              <div>
                <Label>Termín dalšího kroku</Label>
                <Input type="date" value={form.next_step_date} onChange={(e) => setForm({ ...form, next_step_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button disabled={saving} onClick={() => void save()}>{saving ? "Ukládám…" : "Uložit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserInteractionsSection;
