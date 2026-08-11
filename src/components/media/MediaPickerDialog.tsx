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

interface Props {
  trigger: React.ReactNode;
  /** Restrict picker to images. */
  imageOnly?: boolean;
  onPick: (url: string, item: TeacherMediaItem) => void;
  /** Alt text / autor u fotek z Unsplash (volitelný callback). */
  onPickPhotoMeta?: (meta: { alt: string; authorName: string }) => void;
}

export function MediaPickerDialog({ trigger, imageOnly = true, onPick, onPickPhotoMeta }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { items, setItems } = useTeacherMedia(open ? user?.id : undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                onUploaded={(it) => setItems((prev) => [it, ...prev])}
              />
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
