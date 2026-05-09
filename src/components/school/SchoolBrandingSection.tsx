import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Save, ImageOff, Globe } from "lucide-react";

interface Props {
  schoolId: string;
  schoolName: string;
}

const subdomainOk = (s: string) => /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/.test(s);

const SchoolBrandingSection = ({ schoolId, schoolName }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [subdomain, setSubdomain] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#6EC6D9");
  const [welcomeText, setWelcomeText] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("schools")
      .select("subdomain, custom_logo_url, custom_primary_color, custom_welcome_text")
      .eq("id", schoolId)
      .single();
    if (data) {
      setSubdomain((data as any).subdomain ?? "");
      setLogoUrl((data as any).custom_logo_url ?? null);
      setPrimaryColor((data as any).custom_primary_color ?? "#6EC6D9");
      setWelcomeText((data as any).custom_welcome_text ?? "");
    }
    setLoading(false);
  };

  const handleLogoUpload = async (file: File) => {
    if (file.size > 1024 * 1024) {
      toast({ title: "Soubor je příliš velký", description: "Maximum je 1 MB.", variant: "destructive" });
      return;
    }
    // Validate dimensions
    const img = new Image();
    const url = URL.createObjectURL(file);
    const dimsOk = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(img.width <= 400 && img.height <= 400);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    URL.revokeObjectURL(url);
    if (!dimsOk) {
      toast({ title: "Příliš velké rozměry", description: "Logo musí být max. 400×400 px.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${schoolId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("school-logos").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setUploading(false);
      toast({ title: "Nahrání selhalo", description: error.message, variant: "destructive" });
      return;
    }
    const { data: pub } = supabase.storage.from("school-logos").getPublicUrl(path);
    setLogoUrl(pub.publicUrl);
    setUploading(false);
    toast({ title: "Logo nahráno", description: "Nezapomeňte uložit změny." });
  };

  const removeLogo = () => setLogoUrl(null);

  const save = async () => {
    const sub = subdomain.trim().toLowerCase();
    if (sub && !subdomainOk(sub)) {
      toast({
        title: "Neplatná subdoména",
        description: "Pouze malá písmena, číslice a pomlčky (1–32 znaků).",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("schools")
      .update({
        subdomain: sub || null,
        custom_logo_url: logoUrl,
        custom_primary_color: primaryColor || null,
        custom_welcome_text: welcomeText.trim() || null,
      })
      .eq("id", schoolId);
    setSaving(false);
    if (error) {
      const msg = error.code === "23505"
        ? "Tato subdoména je už obsazena."
        : error.message;
      toast({ title: "Uložení selhalo", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Uloženo", description: "Branding školy byl aktualizován." });
  };

  if (loading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Načítání…</CardContent></Card>;
  }

  const previewUrl = subdomain ? `https://${subdomain}.zedu.cz` : null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" /> Branding školy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="subdomain">Subdoména</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
                placeholder="zs-brno"
                maxLength={32}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.zedu.cz</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Malá písmena, číslice a pomlčky. Pro aktivaci je nutné nastavit DNS wildcard (řeší administrátor).
            </p>
          </div>

          <div>
            <Label>Logo školy (max. 400×400 px, 1 MB)</Label>
            <div className="flex items-center gap-3 mt-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-16 w-16 object-contain rounded border border-border bg-muted/30" />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground">
                  <ImageOff className="w-5 h-5" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleLogoUpload(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <Button asChild size="sm" variant="outline" disabled={uploading}>
                    <span className="cursor-pointer">
                      <Upload className="w-4 h-4 mr-1" />
                      {uploading ? "Nahrávám…" : "Nahrát logo"}
                    </span>
                  </Button>
                </label>
                {logoUrl && (
                  <Button size="sm" variant="ghost" onClick={removeLogo}>Odebrat</Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="color">Primární barva</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id="color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-14 rounded border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#6EC6D9"
                maxLength={7}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="welcome">Uvítací text na přihlašovací stránce</Label>
            <Textarea
              id="welcome"
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              placeholder={`Vítejte v portálu školy ${schoolName}.`}
              rows={3}
              maxLength={500}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {previewUrl ? <>Náhled URL: <span className="font-mono">{previewUrl}</span></> : "Subdoména není nastavena"}
            </div>
            <Button onClick={save} disabled={saving}>
              <Save className="w-4 h-4 mr-1" /> {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Náhled přihlašovací stránky</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-background p-6 flex flex-col items-center text-center min-h-[280px] justify-center">
            {logoUrl && (
              <img src={logoUrl} alt={schoolName} className="h-16 w-auto object-contain mb-3" />
            )}
            <p className="font-heading text-lg font-semibold">{schoolName}</p>
            {welcomeText && (
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-line max-w-sm">{welcomeText}</p>
            )}
            <div className="mt-6 w-full max-w-xs">
              <div
                className="h-10 rounded-md text-white text-sm font-medium flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                Přihlásit se
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolBrandingSection;
