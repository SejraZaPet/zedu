import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  getListing, getListingPreview, hasPurchased, purchaseListing,
  listReviews, addReview, type MarketplaceListing,
} from "@/lib/marketplace";
import { ArrowLeft, Star, Download, ShoppingBag, CheckCircle2, Loader2 } from "lucide-react";

const MarketplaceDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [listing, setListing] = useState<MarketplaceListing | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    const l = await getListing(id);
    setListing(l);
    if (l) {
      const [p, r, o] = await Promise.all([
        getListingPreview(l.textbook_id),
        listReviews(l.id),
        hasPurchased(l.id),
      ]);
      setPreview(p);
      setReviews(r);
      setOwned(o);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, [id]);

  const handleBuy = async () => {
    if (!listing) return;
    setBuying(true);
    try {
      await purchaseListing(listing);
      toast({ title: listing.price === 0 ? "Učebnice stažena!" : "Nákup dokončen", description: "Najdeš ji ve své knihovně." });
      await reload();
    } catch (e: any) {
      toast({ title: "Nepodařilo se dokončit", description: e.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  const handleReview = async () => {
    if (!listing) return;
    try {
      await addReview(listing.id, reviewRating, reviewText);
      setReviewText("");
      toast({ title: "Recenze přidána" });
      await reload();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></main>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-20 text-center" style={{ paddingTop: "calc(70px + 5rem)" }}>
          <p className="text-muted-foreground mb-4">Publikace nebyla nalezena.</p>
          <Button onClick={() => navigate("/marketplace")}>Zpět na marketplace</Button>
        </main>
      </div>
    );
  }

  const formatPrice = listing.price === 0 ? "Zdarma" : `${listing.price.toFixed(0)} ${listing.currency}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => navigate("/marketplace")}>
          <ArrowLeft className="w-4 h-4" /> Zpět
        </Button>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-2">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6 overflow-hidden">
              {listing.cover_url ? (
                <img src={listing.cover_url} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-heading font-bold text-primary/40">
                  {listing.title.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="font-heading text-3xl font-bold mb-2">{listing.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              {listing.subject && <span>{listing.subject}</span>}
              {listing.grade && <span>{listing.grade}. ročník</span>}
              <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />{listing.rating.toFixed(1)} ({listing.rating_count})</span>
              <span className="flex items-center gap-1"><Download className="w-4 h-4" />{listing.downloads}</span>
            </div>
            <p className="text-foreground/80 whitespace-pre-wrap mb-8">{listing.description || "Bez popisu."}</p>

            <h2 className="font-heading text-xl font-semibold mb-3">Náhled obsahu</h2>
            <div className="space-y-3 mb-8">
              {preview.length === 0 ? (
                <p className="text-sm text-muted-foreground">Náhled není k dispozici.</p>
              ) : preview.map((l: any) => (
                <div key={l.id} className="bg-card border border-border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{l.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {Array.isArray(l.blocks)
                      ? l.blocks.map((b: any) => b?.text || b?.content || "").filter(Boolean).join(" ").slice(0, 200) + "..."
                      : "Bez náhledu"}
                  </p>
                </div>
              ))}
            </div>

            <h2 className="font-heading text-xl font-semibold mb-3">Recenze</h2>
            {owned && (
              <div className="bg-muted/30 border border-border rounded-lg p-4 mb-4">
                <p className="text-sm font-medium mb-2">Napsat recenzi</p>
                <div className="flex gap-1 mb-2">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n} type="button" onClick={() => setReviewRating(n)}>
                      <Star className={`w-5 h-5 ${n <= reviewRating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
                <Textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Tvůj komentář..." rows={3} className="mb-2" />
                <Button size="sm" onClick={handleReview}>Odeslat</Button>
              </div>
            )}
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Zatím bez recenzí.</p>
              ) : reviews.map((r) => (
                <div key={r.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center gap-1 mb-1">
                    {[1,2,3,4,5].map((n) => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  {r.comment && <p className="text-sm">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>

          <aside className="md:col-span-1">
            <div className="bg-card border border-border rounded-xl p-5 sticky top-24">
              <Badge className="mb-3" variant={listing.price === 0 ? "secondary" : "default"}>{formatPrice}</Badge>
              {owned ? (
                <div className="text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold">Už máš ve své knihovně</p>
                </div>
              ) : (
                <Button className="w-full gap-2" size="lg" onClick={handleBuy} disabled={buying}>
                  {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                  {listing.price === 0 ? "Stáhnout zdarma" : "Koupit"}
                </Button>
              )}
              {listing.price > 0 && !owned && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Platba je v MVP režimu simulovaná.
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default MarketplaceDetailPage;
