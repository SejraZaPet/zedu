import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface UnsplashPhoto {
  id: string;
  thumb: string;
  full: string;
  alt: string;
  authorName: string;
  authorLink: string;
  link: string;
}

interface Props {
  onPick: (photo: UnsplashPhoto) => void;
}

/** Vyhledávání volně použitelných fotek (Unsplash) přes serverovou proxy. */
export function UnsplashSearchPanel({ onPick }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("unsplash-search", {
        body: { query: query.trim() },
      });
      if (error) throw error;
      const results = ((data as any)?.results ?? []) as UnsplashPhoto[];
      setPhotos(results);
      if (results.length === 0) setMessage("Nic jsme nenašli. Zkuste jiný výraz (např. anglicky).");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setPhotos([]);
      setMessage(
        msg.includes("503") || msg.toLowerCase().includes("not_configured")
          ? "Hledání fotek zatím není aktivní – chybí přístupový klíč Unsplash. Požádejte správce o doplnění."
          : "Hledání fotek se nepodařilo. Zkuste to prosím znovu.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="Např. kitchen, vegetables, laboratory…"
          aria-label="Hledaný výraz"
        />
        <Button onClick={search} disabled={loading || !query.trim()} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Hledat
        </Button>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {photos.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick(p)}
                className="group overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
                title={p.alt || "Vložit fotku"}
              >
                <img
                  src={p.thumb}
                  alt={p.alt || "Náhled fotky"}
                  loading="lazy"
                  className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                  {p.authorName}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Fotky poskytuje Unsplash. Autor je uveden u každého náhledu.
          </p>
        </>
      )}
    </div>
  );
}

export default UnsplashSearchPanel;
