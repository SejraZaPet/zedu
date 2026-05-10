import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listPublishedListings, type MarketplaceListing, type MarketplaceFilters } from "@/lib/marketplace";
import { Star, Download, Search, Loader2, ShoppingBag } from "lucide-react";

const SUBJECTS = ["", "Matematika", "Český jazyk", "Anglický jazyk", "Fyzika", "Chemie", "Biologie", "Dějepis", "Zeměpis", "Informatika"];

const MarketplacePage = () => {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MarketplaceFilters>({ priceMode: "all" });

  useEffect(() => {
    setLoading(true);
    listPublishedListings(filters)
      .then(setListings)
      .finally(() => setLoading(false));
  }, [filters.subject, filters.grade, filters.priceMode, filters.minRating, filters.search]);

  const formatPrice = (l: MarketplaceListing) =>
    l.price === 0 ? "Zdarma" : `${l.price.toFixed(0)} ${l.currency}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-6xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary mb-2">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Marketplace</span>
          </div>
          <h1 className="font-heading text-4xl font-bold mb-2">Učebnice od učitelů</h1>
          <p className="text-muted-foreground">Objevte učebnice připravené komunitou pedagogů.</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 mb-6 grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Hledat podle názvu..."
              className="pl-9"
              value={filters.search ?? ""}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <Select value={filters.subject ?? ""} onValueChange={(v) => setFilters({ ...filters, subject: v || undefined })}>
            <SelectTrigger><SelectValue placeholder="Předmět" /></SelectTrigger>
            <SelectContent>
              {SUBJECTS.map((s) => <SelectItem key={s || "all"} value={s || "all"}>{s || "Všechny předměty"}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.priceMode ?? "all"} onValueChange={(v) => setFilters({ ...filters, priceMode: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cena: vše</SelectItem>
              <SelectItem value="free">Pouze zdarma</SelectItem>
              <SelectItem value="paid">Pouze placené</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Žádné publikace neodpovídají filtrům.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Link
                key={l.id}
                to={`/marketplace/${l.id}`}
                className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all group"
              >
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
                  {l.cover_url ? (
                    <img src={l.cover_url} alt={l.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-heading font-bold text-primary/40">
                      {l.title.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2" variant={l.price === 0 ? "secondary" : "default"}>
                    {formatPrice(l)}
                  </Badge>
                </div>
                <div className="p-4">
                  <h3 className="font-heading font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-2">{l.title}</h3>
                  {l.subject && <p className="text-xs text-muted-foreground mb-2">{l.subject}{l.grade ? ` · ${l.grade}. ročník` : ""}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                      {l.rating.toFixed(1)} ({l.rating_count})
                    </span>
                    <span className="flex items-center gap-1">
                      <Download className="w-3.5 h-3.5" />
                      {l.downloads}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default MarketplacePage;
