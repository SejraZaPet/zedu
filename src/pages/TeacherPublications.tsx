import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { listMyListings, type MarketplaceListing } from "@/lib/marketplace";
import { Plus, Star, Download, Loader2 } from "lucide-react";

const TeacherPublications = () => {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [textbooks, setTextbooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    textbook_id: "",
    title: "",
    description: "",
    subject: "",
    grade: "",
    price: "0",
    status: "published" as "draft" | "published",
  });

  const reload = async (uid: string) => {
    setLoading(true);
    const [my, { data: tb }] = await Promise.all([
      listMyListings(uid),
      supabase.from("teacher_textbooks").select("id, title, subject").eq("teacher_id", uid),
    ]);
    setListings(my);
    setTextbooks(tb ?? []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        reload(session.user.id);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!userId || !form.textbook_id || !form.title.trim()) {
      toast({ title: "Vyplň povinná pole", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("marketplace_listings").insert({
      seller_id: userId,
      textbook_id: form.textbook_id,
      title: form.title,
      description: form.description,
      subject: form.subject,
      grade: form.grade ? parseInt(form.grade) : null,
      price: parseFloat(form.price) || 0,
      currency: "CZK",
      status: form.status,
    });
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Publikace vytvořena" });
    setOpen(false);
    setForm({ textbook_id: "", title: "", description: "", subject: "", grade: "", price: "0", status: "published" });
    if (userId) reload(userId);
  };

  const toggleStatus = async (l: MarketplaceListing) => {
    const next = l.status === "published" ? "draft" : "published";
    await supabase.from("marketplace_listings").update({ status: next }).eq("id", l.id);
    if (userId) reload(userId);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-5xl" style={{ paddingTop: "calc(70px + 3rem)" }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold mb-1">Moje publikace</h1>
            <p className="text-muted-foreground">Spravujte své učebnice na marketplace.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> Nová publikace</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Publikovat učebnici</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Učebnice *</Label>
                  <Select value={form.textbook_id} onValueChange={(v) => {
                    const tb = textbooks.find((t) => t.id === v);
                    setForm({ ...form, textbook_id: v, title: tb?.title ?? form.title, subject: tb?.subject ?? form.subject });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Vyberte..." /></SelectTrigger>
                    <SelectContent>
                      {textbooks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Název *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label>Popis</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Předmět</Label>
                    <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  </div>
                  <div>
                    <Label>Ročník</Label>
                    <Input type="number" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
                  </div>
                  <div>
                    <Label>Cena (CZK)</Label>
                    <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Stav</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Koncept</SelectItem>
                      <SelectItem value="published">Zveřejnit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
                <Button onClick={handleSubmit}>Vytvořit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
        ) : listings.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground mb-4">Zatím nemáte žádnou publikaci.</p>
            <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Vytvořit první</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((l) => (
              <div key={l.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{l.title}</h3>
                    <Badge variant={l.status === "published" ? "default" : "secondary"}>
                      {l.status === "published" ? "Veřejné" : l.status === "draft" ? "Koncept" : "Archivováno"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{l.price === 0 ? "Zdarma" : `${l.price} ${l.currency}`}</span>
                    <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" />{l.rating.toFixed(1)} ({l.rating_count})</span>
                    <span className="flex items-center gap-1"><Download className="w-3.5 h-3.5" />{l.downloads}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(l)}>
                    {l.status === "published" ? "Skrýt" : "Zveřejnit"}
                  </Button>
                  <Link to={`/marketplace/${l.id}`}><Button variant="outline" size="sm">Zobrazit</Button></Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherPublications;
