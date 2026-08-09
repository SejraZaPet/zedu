import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Phone, Mail, MessageSquare, Star } from "lucide-react";
import {
  CRM_INTERACTION_TYPES,
  CRM_SOURCES,
  CRM_STATUSES,
  CRM_TYPES,
  CZ_REGIONS,
  statusMeta,
} from "@/lib/staff-modules";
import type { CrmOrganization, CrmTag } from "./CrmManager";
import RelatedTasksCard from "./RelatedTasksCard";

interface Contact {
  id: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  marketing_consent: boolean;
  unsubscribed_at: string | null;
  notes: string | null;
}

interface Interaction {
  id: string;
  type: string;
  summary: string;
  occurred_at: string;
  next_step: string | null;
  next_step_date: string | null;
  contact_id: string | null;
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


const emptyContact = {
  name: "",
  position: "",
  email: "",
  phone: "",
  is_primary: false,
  marketing_consent: false,
  notes: "",
};

const emptyInteraction = {
  type: "telefon",
  summary: "",
  occurred_at: new Date().toISOString().slice(0, 10),
  next_step: "",
  next_step_date: "",
  contact_id: "",
};

const typeIcon = (t: string) =>
  t === "telefon" ? Phone : t === "email" ? Mail : t === "schuzka" ? Star : MessageSquare;

interface Props {
  organizationId: string;
  tags: CrmTag[];
  canEdit: boolean;
  onBack: () => void;
}

const CrmOrganizationDetail = ({ organizationId, tags, canEdit, onBack }: Props) => {
  const { user } = useAuth();
  const [org, setOrg] = useState<CrmOrganization | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<string[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionForm, setInteractionForm] = useState(emptyInteraction);
  const [authors, setAuthors] = useState<Record<string, Author>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadAuthors = async (ids: string[]) => {
    if (ids.length === 0) { setAuthors({}); return; }
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
  };

  const load = async () => {
    setLoading(true);
    const [orgRes, contactRes, interRes, tagRes, schoolRes] = await Promise.all([
      supabase.from("crm_organizations").select("*").eq("id", organizationId).maybeSingle(),
      supabase.from("crm_contacts").select("*").eq("organization_id", organizationId).order("is_primary", { ascending: false }),
      supabase.from("crm_interactions").select("*").eq("organization_id", organizationId).order("occurred_at", { ascending: false }),
      supabase.from("crm_organization_tags").select("tag_id").eq("organization_id", organizationId),
      supabase.from("schools").select("id, name").order("name"),
    ]);
    setOrg((orgRes.data as CrmOrganization) ?? null);
    setContacts((contactRes.data as Contact[]) ?? []);
    const inter = (interRes.data as Interaction[]) ?? [];
    setInteractions(inter);
    void loadAuthors(Array.from(new Set(inter.map((i) => i.created_by).filter(Boolean) as string[])));
    setAssignedTagIds((tagRes.data ?? []).map((t) => t.tag_id));
    setSchools((schoolRes.data as { id: string; name: string }[]) ?? []);
    setLoading(false);
  };


  useEffect(() => {
    load();
  }, [organizationId]);

  const patchOrg = async (patch: Partial<CrmOrganization>) => {
    if (!org) return;
    setOrg({ ...org, ...patch } as CrmOrganization);
    const { error } = await supabase.from("crm_organizations").update(patch).eq("id", organizationId);
    if (error) toast({ title: "Uložení selhalo", description: error.message, variant: "destructive" });
  };

  const toggleTag = async (tagId: string) => {
    if (!canEdit) return;
    if (assignedTagIds.includes(tagId)) {
      setAssignedTagIds((p) => p.filter((t) => t !== tagId));
      await supabase.from("crm_organization_tags").delete().eq("organization_id", organizationId).eq("tag_id", tagId);
    } else {
      setAssignedTagIds((p) => [...p, tagId]);
      await supabase.from("crm_organization_tags").insert({ organization_id: organizationId, tag_id: tagId });
    }
  };

  const saveContact = async () => {
    if (!contactForm.name.trim()) {
      toast({ title: "Zadejte jméno kontaktu", variant: "destructive" });
      return;
    }
    const payload = {
      organization_id: organizationId,
      name: contactForm.name.trim(),
      position: contactForm.position || null,
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      is_primary: contactForm.is_primary,
      marketing_consent: contactForm.marketing_consent,
      notes: contactForm.notes || null,
    };
    const { error } = editingContact
      ? await supabase.from("crm_contacts").update(payload).eq("id", editingContact.id)
      : await supabase.from("crm_contacts").insert(payload);
    if (error) {
      toast({ title: "Uložení kontaktu selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setContactOpen(false);
    setEditingContact(null);
    setContactForm(emptyContact);
    load();
  };

  const deleteContact = async (id: string) => {
    await supabase.from("crm_contacts").delete().eq("id", id);
    load();
  };

  const saveInteraction = async () => {
    if (!interactionForm.summary.trim()) {
      toast({ title: "Zadejte souhrn komunikace", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("crm_interactions").insert({
      organization_id: organizationId,
      contact_id: interactionForm.contact_id || null,
      type: interactionForm.type,
      summary: interactionForm.summary.trim(),
      occurred_at: new Date(interactionForm.occurred_at).toISOString(),
      next_step: interactionForm.next_step || null,
      next_step_date: interactionForm.next_step_date || null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Uložení záznamu selhalo", description: error.message, variant: "destructive" });
      return;
    }
    setInteractionOpen(false);
    setInteractionForm(emptyInteraction);
    load();
  };

  const meta = useMemo(() => statusMeta(org?.status ?? "novy"), [org?.status]);

  if (loading) return <p className="text-sm text-muted-foreground">Načítání…</p>;
  if (!org) return <p className="text-sm text-muted-foreground">Organizace nenalezena.</p>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Zpět na seznam
      </Button>

      <Card className="p-5 border-l-4 space-y-4" style={{ borderLeftColor: meta.color }}>
        <div>
          <h2 className="font-heading text-xl">{org.name}</h2>
          <p className="text-sm text-muted-foreground">{CRM_TYPES.find((t) => t.value === org.type)?.label}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Stav</Label>
            <Select value={org.status} onValueChange={(v) => patchOrg({ status: v })} disabled={!canEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Kraj</Label>
            <Select value={org.region ?? ""} onValueChange={(v) => patchOrg({ region: v })} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {CZ_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Zdroj</Label>
            <Select value={org.source ?? ""} onValueChange={(v) => patchOrg({ source: v })} disabled={!canEdit}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {CRM_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>IČO</Label>
            <Input defaultValue={org.ico ?? ""} disabled={!canEdit} onBlur={(e) => patchOrg({ ico: e.target.value || null })} />
          </div>
          <div>
            <Label>Web</Label>
            <Input defaultValue={org.website ?? ""} disabled={!canEdit} onBlur={(e) => patchOrg({ website: e.target.value || null })} />
          </div>
          <div>
            <Label>Adresa</Label>
            <Input defaultValue={org.address ?? ""} disabled={!canEdit} onBlur={(e) => patchOrg({ address: e.target.value || null })} />
          </div>
          <div className="md:col-span-3">
            <Label>Propojená škola v systému</Label>
            <Select
              value={org.linked_school_id ?? "none"}
              onValueChange={(v) => patchOrg({ linked_school_id: v === "none" ? null : v })}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue placeholder="Nepropojeno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nepropojeno</SelectItem>
                {schools.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Štítky</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {tags.map((t) => {
              const active = assignedTagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  disabled={!canEdit}
                  className="text-xs px-2 py-1 rounded-full border disabled:opacity-60"
                  style={{
                    borderColor: t.color,
                    backgroundColor: active ? t.color : "transparent",
                    color: active ? "#fff" : t.color,
                  }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Poznámky</Label>
          <Textarea
            defaultValue={org.notes ?? ""}
            rows={3}
            disabled={!canEdit}
            onBlur={(e) => patchOrg({ notes: e.target.value || null })}
          />
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading">Kontakty</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => { setEditingContact(null); setContactForm(emptyContact); setContactOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Přidat kontakt
            </Button>
          )}
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádné kontakty.</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    {c.name}
                    {c.is_primary && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">hlavní</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[c.position, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-xs mt-0.5">
                    {c.unsubscribed_at
                      ? <span className="text-destructive">Odhlášen z e-mailů</span>
                      : c.marketing_consent
                        ? <span className="text-[hsl(var(--primary))]">Souhlas s hromadnými e-maily</span>
                        : <span className="text-muted-foreground">Bez souhlasu</span>}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setEditingContact(c);
                      setContactForm({
                        name: c.name,
                        position: c.position ?? "",
                        email: c.email ?? "",
                        phone: c.phone ?? "",
                        is_primary: c.is_primary,
                        marketing_consent: c.marketing_consent,
                        notes: c.notes ?? "",
                      });
                      setContactOpen(true);
                    }}>Upravit</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteContact(c.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading">Časová osa komunikace</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => { setInteractionForm(emptyInteraction); setInteractionOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Přidat záznam komunikace
            </Button>
          )}
        </div>
        {interactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádná komunikace.</p>
        ) : (
          <ol className="divide-y divide-border rounded-md border border-border">
            {interactions.map((i) => {
              const Icon = typeIcon(i.type);
              const author = i.created_by ? authors[i.created_by] : undefined;
              const shortcut = author?.initials ?? "—";
              const isOpen = !!expanded[i.id];
              const date = new Date(i.occurred_at);
              const contact = contacts.find((c) => c.id === i.contact_id);
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => ({ ...e, [i.id]: !e[i.id] }))}
                    aria-expanded={isOpen}
                    title={`${author?.name ?? "Neznámý autor"} · ${date.toLocaleString("cs-CZ")}`}
                    className="w-full text-left flex items-baseline gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {date.toLocaleDateString("cs-CZ")}
                    </span>
                    <span className="text-muted-foreground shrink-0">·</span>
                    <span className="font-medium shrink-0">{shortcut}:</span>
                    <span className={isOpen ? "whitespace-pre-wrap" : "truncate"}>{i.summary}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2 pt-0 text-xs text-muted-foreground space-y-1">
                      <p className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5" />
                        {CRM_INTERACTION_TYPES.find((t) => t.value === i.type)?.label ?? i.type}
                        {" · "}
                        {author?.name ?? "Neznámý autor"}
                        {" · "}
                        {date.toLocaleString("cs-CZ")}
                        {contact ? ` · ${contact.name}` : ""}
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
      </Card>

      <RelatedTasksCard organizationId={organizationId} canEdit={canEdit} />


      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingContact ? "Upravit kontakt" : "Nový kontakt"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Jméno *</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pozice</Label>
                <Input value={contactForm.position} onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })} />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={contactForm.is_primary} onCheckedChange={(v) => setContactForm({ ...contactForm, is_primary: !!v })} />
              Hlavní kontakt organizace
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={contactForm.marketing_consent} onCheckedChange={(v) => setContactForm({ ...contactForm, marketing_consent: !!v })} />
              Souhlas s hromadnými e-maily (GDPR)
            </label>
            <div>
              <Label>Poznámky</Label>
              <Textarea rows={2} value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContactOpen(false)}>Zrušit</Button>
            <Button onClick={saveContact}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Záznam komunikace</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={interactionForm.type} onValueChange={(v) => setInteractionForm({ ...interactionForm, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_INTERACTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum</Label>
                <Input type="date" value={interactionForm.occurred_at} onChange={(e) => setInteractionForm({ ...interactionForm, occurred_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Kontaktní osoba</Label>
              <Select value={interactionForm.contact_id || "none"} onValueChange={(v) => setInteractionForm({ ...interactionForm, contact_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Neuvedeno</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Souhrn *</Label>
              <Textarea rows={4} value={interactionForm.summary} onChange={(e) => setInteractionForm({ ...interactionForm, summary: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Další krok</Label>
                <Input value={interactionForm.next_step} onChange={(e) => setInteractionForm({ ...interactionForm, next_step: e.target.value })} />
              </div>
              <div>
                <Label>Termín dalšího kroku</Label>
                <Input type="date" value={interactionForm.next_step_date} onChange={(e) => setInteractionForm({ ...interactionForm, next_step_date: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInteractionOpen(false)}>Zrušit</Button>
            <Button onClick={saveInteraction}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CrmOrganizationDetail;
