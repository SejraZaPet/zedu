import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Mail, Building2 } from "lucide-react";
import { CRM_SOURCES, CRM_STATUSES, CRM_TYPES, CZ_REGIONS, statusMeta } from "@/lib/staff-modules";
import CrmOrganizationDetail from "./CrmOrganizationDetail";
import CrmBulkEmailDialog from "./CrmBulkEmailDialog";

export interface CrmTag {
  id: string;
  name: string;
  color: string;
}

export interface CrmOrganization {
  id: string;
  name: string;
  type: string;
  ico: string | null;
  address: string | null;
  website: string | null;
  region: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  linked_school_id: string | null;
  created_at: string;
}

const emptyForm = {
  name: "",
  type: "skola",
  ico: "",
  address: "",
  website: "",
  region: "",
  source: "",
  status: "novy",
  notes: "",
};

const CrmManager = () => {
  const { can } = useStaffPermissions();
  const { user } = useAuth();
  const canEdit = can("crm", true);

  const [orgs, setOrgs] = useState<CrmOrganization[]>([]);
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [orgTags, setOrgTags] = useState<{ organization_id: string; tag_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [orgRes, tagRes, otRes] = await Promise.all([
      supabase.from("crm_organizations").select("*").order("created_at", { ascending: false }),
      supabase.from("crm_tags").select("*").order("name"),
      supabase.from("crm_organization_tags").select("organization_id, tag_id"),
    ]);
    if (orgRes.error) toast({ title: "Nepodařilo se načíst CRM", description: orgRes.error.message, variant: "destructive" });
    setOrgs((orgRes.data as CrmOrganization[]) ?? []);
    setTags((tagRes.data as CrmTag[]) ?? []);
    setOrgTags(otRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const tagsByOrg = useMemo(() => {
    const map: Record<string, CrmTag[]> = {};
    orgTags.forEach((ot) => {
      const tag = tags.find((t) => t.id === ot.tag_id);
      if (!tag) return;
      map[ot.organization_id] = [...(map[ot.organization_id] ?? []), tag];
    });
    return map;
  }, [orgTags, tags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orgs.filter((o) => {
      if (q && !o.name.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (regionFilter !== "all" && o.region !== regionFilter) return false;
      if (tagFilter.length) {
        const ids = (tagsByOrg[o.id] ?? []).map((t) => t.id);
        if (!tagFilter.every((t) => ids.includes(t))) return false;
      }
      return true;
    });
  }, [orgs, search, statusFilter, regionFilter, tagFilter, tagsByOrg]);

  const createOrg = async () => {
    if (!form.name.trim()) {
      toast({ title: "Zadejte název organizace", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("crm_organizations").insert({
      name: form.name.trim(),
      type: form.type,
      ico: form.ico || null,
      address: form.address || null,
      website: form.website || null,
      region: form.region || null,
      source: form.source || null,
      status: form.status,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast({ title: "Nepodařilo se vytvořit záznam", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Organizace přidána" });
    setCreateOpen(false);
    setForm(emptyForm);
    load();
  };

  if (detailId) {
    return (
      <CrmOrganizationDetail
        organizationId={detailId}
        tags={tags}
        canEdit={canEdit}
        onBack={() => {
          setDetailId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl">CRM</h2>
          <p className="text-sm text-muted-foreground">Evidence škol, lektorů a potenciálních zákazníků</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
              <Mail className="w-4 h-4 mr-1" /> Odeslat hromadný e-mail
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nová organizace
            </Button>
          )}
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Hledat podle názvu…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Stav" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              {CRM_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger><SelectValue placeholder="Kraj" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kraje</SelectItem>
              {CZ_REGIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Štítky:</span>
            {tags.map((t) => {
              const active = tagFilter.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTagFilter((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                  className="text-xs px-2 py-1 rounded-full border transition-opacity"
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
            {tagFilter.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setTagFilter([])}>
                Zrušit filtr
              </Button>
            )}
          </div>
        )}
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Načítání…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Žádné organizace neodpovídají filtru.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const meta = statusMeta(o.status);
            return (
              <Card
                key={o.id}
                onClick={() => setDetailId(o.id)}
                className="p-4 cursor-pointer hover:bg-accent/40 transition-colors border-l-4"
                style={{ borderLeftColor: meta.color }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{o.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CRM_TYPES.find((t) => t.value === o.type)?.label}
                      {o.region ? ` · ${o.region}` : ""}
                      {o.source ? ` · ${CRM_SOURCES.find((s) => s.value === o.source)?.label ?? o.source}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(tagsByOrg[o.id] ?? []).map((t) => (
                      <span
                        key={t.id}
                        className="text-[11px] px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.name}
                      </span>
                    ))}
                    <Badge variant="outline" style={{ borderColor: meta.color, color: meta.color }}>
                      {meta.label}
                    </Badge>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nová organizace</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Název *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stav</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kraj</Label>
                <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {CZ_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Zdroj</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {CRM_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>IČO</Label>
                <Input value={form.ico} onChange={(e) => setForm({ ...form, ico: e.target.value })} />
              </div>
              <div>
                <Label>Web</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Adresa</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Poznámky</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Zrušit</Button>
            <Button onClick={createOrg}>Vytvořit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CrmBulkEmailDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        organizationIds={filtered.map((o) => o.id)}
      />
    </div>
  );
};

export default CrmManager;
