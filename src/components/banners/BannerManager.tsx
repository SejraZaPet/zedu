import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, EyeOff, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { isDemoAccount } from "@/lib/demo-seed-textbooks";
import { BannerCarousel } from "@/components/dashboard/DashboardBanners";
import {
  BANNER_STATUS_LABEL, bannerErrorMessage, bannerPublicUrl, bannerStatus, type Banner,
} from "@/lib/banners";
import {
  bannerFilePath, bannerFolder, canPlayH264, posterFromVideo, readImageSize, readVideoMeta,
  removeBannerFiles, stalePaths, uploadBannerFile, validateBannerDimensions, validateBannerFile,
  validateBannerForm, validateVideoDuration, type BannerFormValues,
} from "@/lib/banner-upload";

type Group = "students" | "teachers" | "leadership";
const GROUP_LABEL: Record<Group, string> = { students: "Žáci", teachers: "Učitelé", leadership: "Vedení" };

interface Props { scope: "platform" | "school"; schoolId?: string | null }

const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

/** Demo účty správu bannerů nevidí (zápis navíc blokuje demo_guard_banners_*). */
export function BannerManager(props: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      const demo = uid ? await isDemoAccount(uid) : true;
      if (alive) setAllowed(!demo);
    });
    return () => { alive = false; };
  }, []);
  if (!allowed) return null;
  return <BannerManagerInner {...props} />;
}

function BannerManagerInner({ scope, schoolId = null }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Banner[]>([]);
  const [schoolRows, setSchoolRows] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group>("students");
  const [editing, setEditing] = useState<Banner | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase.from as any)("banners").select("*").eq("scope", scope).order("sort_order").order("created_at");
    if (scope === "school") q = q.eq("school_id", schoolId);
    const { data, error } = await q;
    if (error) toast({ title: "Bannery", description: bannerErrorMessage(error), variant: "destructive" });
    setRows((data ?? []) as Banner[]);
    if (scope === "platform") {
      const { data: s } = await (supabase.from as any)("banners").select("*").eq("scope", "school").order("created_at", { ascending: false });
      setSchoolRows((s ?? []) as Banner[]);
    }
    setLoading(false);
  }, [scope, schoolId, toast]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(
    () => (scope === "platform" ? rows.filter((r) => r[`target_${group}` as const]) : rows),
    [rows, group, scope],
  );

  const update = async (id: string, patch: Partial<Banner>) => {
    const { error } = await (supabase.from as any)("banners").update(patch).eq("id", id);
    if (error) toast({ title: "Nelze uložit", description: bannerErrorMessage(error), variant: "destructive" });
    load();
  };

  const remove = async (b: Banner) => {
    if (!window.confirm("Opravdu smazat tento banner?")) return;
    const { error } = await (supabase.from as any)("banners").delete().eq("id", b.id);
    if (error) { toast({ title: "Nelze smazat", description: bannerErrorMessage(error), variant: "destructive" }); return; }
    const ok = await removeBannerFiles([b.image_path, b.video_path, b.poster_path]);
    if (!ok) toast({ title: "Banner smazán", description: "Soubor v úložišti se nepodařilo odstranit." });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {scope === "platform" ? (
          <div className="flex gap-1" role="tablist" aria-label="Skupina">
            {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
              <Button key={g} size="sm" role="tab" aria-selected={group === g} variant={group === g ? "default" : "outline"} onClick={() => setGroup(g)}>
                {GROUP_LABEL[g]}
              </Button>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Nejvýš 3 aktivní bannery pro školu.</p>}
        <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Přidat banner</Button>
      </div>

      {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
        <BannerTable rows={visible} onEdit={setEditing} onToggle={(b) => update(b.id, { is_active: !b.is_active })} onDelete={remove} />
      )}

      {scope === "platform" && (
        <div className="space-y-2 pt-4">
          <h3 className="text-sm font-medium">Školní bannery</h3>
          <p className="text-xs text-muted-foreground">Školní bannery můžete jen skrýt, ne upravit.</p>
          <BannerTable rows={schoolRows} onHide={(b) => update(b.id, { hidden_by_admin: !b.hidden_by_admin })} />
        </div>
      )}

      {editing && (
        <BannerFormDialog
          scope={scope}
          schoolId={schoolId}
          defaultGroup={group}
          banner={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function BannerTable({ rows, onEdit, onToggle, onDelete, onHide }: {
  rows: Banner[]; onEdit?: (b: Banner) => void; onToggle?: (b: Banner) => void; onDelete?: (b: Banner) => void; onHide?: (b: Banner) => void;
}) {
  if (!rows.length) return <p className="text-xs text-muted-foreground">Žádné bannery.</p>;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {rows.map((b) => {
        const st = bannerStatus(b);
        const thumb = bannerPublicUrl(b.media_type === "video" ? b.poster_path : b.image_path);
        return (
          <li key={b.id} className="flex flex-wrap items-center gap-3 p-2">
            {thumb ? <img src={thumb} alt="" className="h-10 w-30 aspect-[3/1] rounded object-cover" /> : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{b.alt_text}</p>
              <p className="text-xs text-muted-foreground">{b.media_type === "video" ? "Video" : "Obrázek"} · {b.display_seconds} s · pořadí {b.sort_order}</p>
            </div>
            <Badge variant="outline">{BANNER_STATUS_LABEL[st]}</Badge>
            {onToggle && <Switch checked={b.is_active} onCheckedChange={() => onToggle(b)} aria-label="Zapnuto" disabled={b.hidden_by_admin} />}
            {onEdit && <Button size="icon" variant="ghost" aria-label="Upravit" onClick={() => onEdit(b)}><Pencil className="h-4 w-4" /></Button>}
            {onDelete && <Button size="icon" variant="ghost" aria-label="Smazat" onClick={() => onDelete(b)}><Trash2 className="h-4 w-4" /></Button>}
            {onHide && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => onHide(b)}>
                {b.hidden_by_admin ? <><Eye className="h-4 w-4" /> Zobrazit</> : <><EyeOff className="h-4 w-4" /> Skrýt</>}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function BannerFormDialog({ scope, schoolId, banner, defaultGroup, onClose, onSaved }: {
  scope: "platform" | "school"; schoolId: string | null; banner: Banner | null; defaultGroup: Group; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [kind, setKind] = useState<"image" | "video">(banner?.media_type ?? "image");
  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sortOrder, setSortOrder] = useState(banner?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(banner?.is_active ?? true);
  const [v, setV] = useState<BannerFormValues>({
    alt_text: banner?.alt_text ?? "",
    link_url: banner?.link_url ?? "",
    display_seconds: banner?.display_seconds ?? 6,
    starts_at: toLocalInput(banner?.starts_at ?? null),
    ends_at: toLocalInput(banner?.ends_at ?? null),
    target_students: banner?.target_students ?? (scope === "school" || defaultGroup === "students"),
    target_teachers: banner?.target_teachers ?? (scope === "school" || defaultGroup === "teachers"),
    target_leadership: banner?.target_leadership ?? (scope === "platform" && defaultGroup === "leadership"),
  });

  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);
  useEffect(() => () => { if (posterUrl) URL.revokeObjectURL(posterUrl); }, [posterUrl]);

  const pickFile = async (f: File | null) => {
    setError(null); setWarning(null); setFile(null);
    if (!f) return;
    const typeErr = validateBannerFile(f, kind);
    if (typeErr) return setError(typeErr);
    try {
      if (kind === "image") {
        const { w, h } = await readImageSize(f);
        const e = validateBannerDimensions(w, h); if (e) return setError(e);
      } else {
        const m = await readVideoMeta(f);
        const e = validateBannerDimensions(m.w, m.h) ?? validateVideoDuration(m.duration); if (e) return setError(e);
        if (!canPlayH264()) setWarning("Prohlížeč neumí ověřit kódování H.264. Zkontrolujte, že je video v H.264.");
      }
    } catch (e: any) { return setError(e?.message ?? "Soubor nelze načíst."); }
    setFile(f); setFileUrl(URL.createObjectURL(f));
  };

  const pickPoster = async (f: File | null) => {
    setError(null);
    if (!f) return;
    const e = validateBannerFile(f, "image"); if (e) return setError(e);
    try { const { w, h } = await readImageSize(f); const d = validateBannerDimensions(w, h); if (d) return setError(d); }
    catch (er: any) { return setError(er?.message); }
    setPoster(f); setPosterUrl(URL.createObjectURL(f));
  };

  const makePoster = async () => {
    if (!file) return;
    try { const p = await posterFromVideo(file); setPoster(p); setPosterUrl(URL.createObjectURL(p)); }
    catch (e: any) { setError(e?.message); }
  };

  const previewBanner: Banner | null = useMemo(() => {
    const img = kind === "image" ? (fileUrl ?? (banner?.media_type === "image" ? bannerPublicUrl(banner.image_path) : null)) : null;
    const vid = kind === "video" ? (fileUrl ?? (banner?.media_type === "video" ? bannerPublicUrl(banner.video_path) : null)) : null;
    const pst = kind === "video" ? (posterUrl ?? (banner?.media_type === "video" ? bannerPublicUrl(banner.poster_path) : null)) : null;
    if (!img && !vid) return null;
    return {
      id: "preview", scope, school_id: schoolId, media_type: kind, image_path: img, video_path: vid, poster_path: pst,
      alt_text: v.alt_text || "Náhled", link_url: null, target_students: true, target_teachers: false, target_leadership: false,
      display_seconds: v.display_seconds, starts_at: null, ends_at: null, sort_order: 0, is_active: true, hidden_by_admin: false,
    };
  }, [kind, fileUrl, posterUrl, banner, v.alt_text, v.display_seconds, scope, schoolId]);

  const save = async () => {
    const formErr = validateBannerForm(v); if (formErr) return setError(formErr);
    const sameKind = banner?.media_type === kind;
    if (!file && !sameKind) return setError(kind === "image" ? "Nahrajte obrázek." : "Nahrajte video.");
    if (kind === "video" && !poster && !(sameKind && banner?.poster_path)) return setError("Video musí mít náhledový obrázek.");
    setBusy(true); setError(null);
    const folder = bannerFolder(scope, schoolId);
    const uploaded: string[] = [];
    try {
      let image_path = sameKind ? banner?.image_path ?? null : null;
      let video_path = sameKind ? banner?.video_path ?? null : null;
      let poster_path = sameKind ? banner?.poster_path ?? null : null;
      if (file) {
        const p = bannerFilePath(folder, file); await uploadBannerFile(p, file); uploaded.push(p);
        if (kind === "image") image_path = p; else video_path = p;
      }
      if (kind === "video" && poster) { const p = bannerFilePath(folder, poster); await uploadBannerFile(p, poster); uploaded.push(p); poster_path = p; }
      if (kind === "image") { video_path = null; poster_path = null; } else { image_path = null; }
      const row = {
        scope, school_id: scope === "school" ? schoolId : null, media_type: kind, image_path, video_path, poster_path,
        alt_text: v.alt_text.trim(), link_url: v.link_url.trim() || null, display_seconds: v.display_seconds,
        starts_at: fromLocalInput(v.starts_at), ends_at: fromLocalInput(v.ends_at), sort_order: sortOrder, is_active: isActive,
        target_students: v.target_students, target_teachers: v.target_teachers, target_leadership: v.target_leadership,
      };
      const res = banner
        ? await (supabase.from as any)("banners").update(row).eq("id", banner.id)
        : await (supabase.from as any)("banners").insert(row);
      if (res.error) throw res.error;
      if (banner) {
        const stale = stalePaths([banner.image_path, banner.video_path, banner.poster_path], [image_path, video_path, poster_path]);
        if (!(await removeBannerFiles(stale))) toast({ title: "Uloženo", description: "Starý soubor se nepodařilo odstranit." });
      }
      toast({ title: "Banner uložen" });
      onSaved();
    } catch (e: any) {
      await removeBannerFiles(uploaded);
      setError(bannerErrorMessage(e));
    } finally { setBusy(false); }
  };

  const set = <K extends keyof BannerFormValues>(k: K, val: BannerFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{banner ? "Upravit banner" : "Nový banner"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {previewBanner && <BannerCarousel banners={[previewBanner]} preview />}
          <div className="flex gap-2">
            {(["image", "video"] as const).map((k) => (
              <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "outline"} onClick={() => { setKind(k); setFile(null); setFileUrl(null); setPoster(null); setPosterUrl(null); }}>
                {k === "image" ? "Obrázek" : "Video"}
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-file">{kind === "image" ? "Obrázek (JPG, PNG, WebP)" : "Video MP4 H.264, bez zvuku, nejvýš 10 s"}</Label>
            <Input id="banner-file" type="file" accept={kind === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4"} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">1500×500, 1584×396 nebo 1920×480 px, nejvýš 3 MB. Soubor je veřejně dostupný, nevkládejte osobní údaje.</p>
          </div>
          {kind === "video" && (
            <div className="space-y-1">
              <Label htmlFor="banner-poster">Náhledový obrázek (povinný)</Label>
              <div className="flex flex-wrap gap-2">
                <Input id="banner-poster" type="file" accept="image/jpeg,image/png,image/webp" className="flex-1 min-w-0" onChange={(e) => pickPoster(e.target.files?.[0] ?? null)} />
                <Button type="button" variant="outline" size="sm" disabled={!file} onClick={makePoster}>Vytvořit z prvního snímku</Button>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="banner-alt">Popis pro čtečky (alt text)</Label>
            <Input id="banner-alt" value={v.alt_text} maxLength={200} onChange={(e) => set("alt_text", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-link">Odkaz (volitelný, https://)</Label>
            <Input id="banner-link" value={v.link_url} placeholder="https://" onChange={(e) => set("link_url", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="banner-sec">Doba zobrazení (3–60 s)</Label>
              <Input id="banner-sec" type="number" min={3} max={60} value={v.display_seconds} onChange={(e) => set("display_seconds", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="banner-order">Pořadí</Label>
              <Input id="banner-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="banner-from">Platnost od</Label>
              <Input id="banner-from" type="datetime-local" value={v.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="banner-to">Platnost do</Label>
              <Input id="banner-to" type="datetime-local" value={v.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Komu se zobrazí</legend>
            <div className="flex flex-wrap gap-4">
              {([["target_students", "Žáci"], ["target_teachers", "Učitelé"], ["target_leadership", "Vedení"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={v[k]} onCheckedChange={(c) => set(k, c === true)} /> {l}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><Switch checked={isActive} onCheckedChange={setIsActive} /> Zapnuto</label>
          {warning && <p className="text-sm text-muted-foreground">{warning}</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zrušit</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Uložit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BannerManager;
