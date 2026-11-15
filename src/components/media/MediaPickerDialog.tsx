import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherMedia } from "@/hooks/useTeacherMedia";
import { MediaLibraryGrid } from "@/components/media/MediaLibraryGrid";
import { MediaUploadZone } from "@/components/media/MediaUploadZone";
import UnsplashSearchPanel from "@/components/media/UnsplashSearchPanel";
import type { TeacherMediaItem } from "@/lib/teacher-media";
import { Button } from "@/components/ui/button";
import { getSignedUrl } from "@/lib/teacher-media";
import { toast } from "sonner";

interface Props {
  trigger: React.ReactNode;
  /** Restrict picker to images. */
  imageOnly?: boolean;
  onPick: (url: string, item: TeacherMediaItem) => void;
  onPickMany?: (items: { url: string; item: TeacherMediaItem }[]) => Promise<void>;
  /** Alt text / autor u fotek z Unsplash (volitelný callback). */
  onPickPhotoMeta?: (meta: { alt: string; authorName: string }) => void;
}

export function MediaPickerDialog({ trigger, imageOnly = true, onPick, onPickMany, onPickPhotoMeta }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploaded, setUploaded] = useState<TeacherMediaItem[]>([]);
  const [inserting, setInserting] = useState(false);
  const { items, setItems } = useTeacherMedia(open ? user?.id : undefined);

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setUploaded([]); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Knihovna médií</DialogTitle>
        </DialogHeader>
        {user && (
          <Tabs defaultValue="own">
            <TabsList>
              <TabsTrigger value="own">Nahrát vlastní</TabsTrigger>
              <TabsTrigger value="photos">Hledat fotky</TabsTrigger>
            </TabsList>

            <TabsContent value="own" className="space-y-4">
              <MediaUploadZone
                teacherId={user.id}
                onUploaded={(it) => {
                  setItems((prev) => [it, ...prev]);
                  if (it.mime_type.startsWith("image/")) setUploaded((prev) => [...prev, it]);
                }}
              />
              {onPickMany && uploaded.length > 0 && <Button className="min-h-11" disabled={inserting} onClick={async () => {
                setInserting(true);
                try {
                  const picked = [];
                  for (const item of uploaded) {
                    const url = await getSignedUrl(item.storage_path);
                    if (!url) throw new Error("Obrázek není dostupný. Zkuste to znovu.");
                    picked.push({ url, item });
                  }
                  await onPickMany(picked);
                  setUploaded([]);
                  setOpen(false);
                } catch (error: any) { toast.error(error.message || "Vložení obrázků selhalo."); }
                finally { setInserting(false); }
              }}>Vložit nahrané obrázky ({uploaded.length})</Button>}
              <MediaLibraryGrid
                items={items}
                imageOnly={imageOnly}
                picker
                onSelect={(item, url) => {
                  onPick(url, item);
                  setOpen(false);
                }}
              />
            </TabsContent>

            <TabsContent value="photos">
              <UnsplashSearchPanel
                onPick={(photo) => {
                  onPickPhotoMeta?.({ alt: photo.alt, authorName: photo.authorName });
                  onPick(photo.full, {
                    id: photo.id,
                    file_name: photo.alt || "unsplash",
                    mime_type: "image/jpeg",
                  } as unknown as TeacherMediaItem);
                  setOpen(false);
                }}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
