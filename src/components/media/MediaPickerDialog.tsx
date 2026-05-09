import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherMedia } from "@/hooks/useTeacherMedia";
import { MediaLibraryGrid } from "@/components/media/MediaLibraryGrid";
import { MediaUploadZone } from "@/components/media/MediaUploadZone";
import type { TeacherMediaItem } from "@/lib/teacher-media";

interface Props {
  trigger: React.ReactNode;
  /** Restrict picker to images. */
  imageOnly?: boolean;
  onPick: (url: string, item: TeacherMediaItem) => void;
}

export function MediaPickerDialog({ trigger, imageOnly = true, onPick }: Props) {
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
          <>
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
