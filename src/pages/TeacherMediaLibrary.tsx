import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTeacherMedia } from "@/hooks/useTeacherMedia";
import { MediaUploadZone } from "@/components/media/MediaUploadZone";
import { MediaLibraryGrid } from "@/components/media/MediaLibraryGrid";
import {
  deleteMedia,
  renameMedia,
  type TeacherMediaItem,
} from "@/lib/teacher-media";

const TeacherMediaLibrary = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items, loading, setItems } = useTeacherMedia(user?.id);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const handleAdd = (it: TeacherMediaItem) => setItems((prev) => [it, ...prev]);

  const handleDelete = async (item: TeacherMediaItem) => {
    if (!confirm(`Smazat soubor „${item.filename}"?`)) return;
    try {
      await deleteMedia(item);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      toast({ title: "Soubor smazán." });
    } catch (e: any) {
      toast({ title: "Mazání selhalo", description: e?.message, variant: "destructive" });
    }
  };

  const handleRename = async (item: TeacherMediaItem) => {
    const next = prompt("Nový název souboru:", item.filename);
    if (!next || next.trim() === item.filename) return;
    try {
      await renameMedia(item.id, next.trim());
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, filename: next.trim() } : p)));
    } catch (e: any) {
      toast({ title: "Přejmenování selhalo", description: e?.message, variant: "destructive" });
    }
  };

  const handleCopyUrl = async (_item: TeacherMediaItem, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "URL zkopírováno" });
    } catch {
      toast({ title: "Nepodařilo se zkopírovat", variant: "destructive" });
    }
  };

  const handleDownload = (item: TeacherMediaItem, url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = item.filename;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main
        className="flex-1 container mx-auto px-4 py-12 max-w-6xl"
        style={{ paddingTop: "calc(70px + 3rem)" }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold">Knihovna médií</h1>
            <p className="text-sm text-muted-foreground">
              Centrální úložiště pro obrázky, PDF, audio a video soubory.
            </p>
          </div>
        </div>

        {user && (
          <div className="space-y-6">
            <MediaUploadZone teacherId={user.id} onUploaded={handleAdd} />

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Načítání…</div>
            ) : (
              <MediaLibraryGrid
                items={items}
                onRename={handleRename}
                onDelete={handleDelete}
                onCopyUrl={handleCopyUrl}
                onDownload={handleDownload}
              />
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
};

export default TeacherMediaLibrary;
