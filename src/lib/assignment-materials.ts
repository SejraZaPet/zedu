import { supabase } from "@/integrations/supabase/client";

/** Materiál, který učitel přiloží k zadání úkolu (odkaz nebo nahraný soubor). */
export interface AssignmentMaterial {
  id: string;
  kind: "link" | "file";
  title: string;
  /** U odkazu cílová adresa. */
  url?: string;
  /** U souboru cesta v bucketu `assignment-materials`. */
  path?: string;
  mime?: string;
  size?: number;
}

export const MATERIALS_BUCKET = "assignment-materials";

/** Video smí být větší (100 MB), ostatní soubory do 20 MB. */
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const FILE_MAX_BYTES = 20 * 1024 * 1024;

export const MATERIAL_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "mp3",
  "m4a",
  "mp4",
  "mov",
];

export const MATERIAL_ACCEPT = MATERIAL_EXTENSIONS.map((e) => `.${e}`).join(",");

export const VIDEO_EXTENSIONS = ["mp4", "mov"];
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
export const AUDIO_EXTENSIONS = ["mp3", "m4a"];

export const extOf = (name: string) => name.split(".").pop()?.toLowerCase() || "";

export type MaterialMediaKind = "image" | "video" | "audio" | "file";

export const mediaKindOf = (m: AssignmentMaterial): MaterialMediaKind => {
  const name = m.path || m.title || "";
  const ext = extOf(name);
  if (IMAGE_EXTENSIONS.includes(ext) || m.mime?.startsWith("image/")) return "image";
  if (VIDEO_EXTENSIONS.includes(ext) || m.mime?.startsWith("video/")) return "video";
  if (AUDIO_EXTENSIONS.includes(ext) || m.mime?.startsWith("audio/")) return "audio";
  return "file";
};

export const formatBytes = (b?: number) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} kB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

/** Vrátí chybu, pokud soubor nevyhovuje povoleným formátům nebo velikosti. */
export const validateMaterialFile = (file: File): string | null => {
  const ext = extOf(file.name);
  if (!MATERIAL_EXTENSIONS.includes(ext)) {
    return "Nepodporovaný formát. Povolené: PDF, Word, Excel, PowerPoint, JPG, PNG, MP3, MP4, MOV.";
  }
  const isVideo = VIDEO_EXTENSIONS.includes(ext);
  const limit = isVideo ? VIDEO_MAX_BYTES : FILE_MAX_BYTES;
  if (file.size > limit) {
    return isVideo ? "Video může mít nejvýš 100 MB." : "Soubor může mít nejvýš 20 MB.";
  }
  return null;
};

/** Nahraje soubor do bucketu materiálů; cesta začíná id učitele (kvůli pravidlům úložiště). */
export const uploadMaterialFile = async (
  file: File,
  teacherId: string,
): Promise<AssignmentMaterial> => {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${teacherId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return {
    id: crypto.randomUUID(),
    kind: "file",
    title: file.name,
    path,
    mime: file.type || undefined,
    size: file.size,
  };
};

export const removeMaterialFile = async (path: string) => {
  await supabase.storage.from(MATERIALS_BUCKET).remove([path]);
};

/** Podepsaná adresa na soubor v úložišti (bucket je neveřejný). */
export const signedMaterialUrl = async (
  path: string,
  opts?: { download?: string },
): Promise<string | null> => {
  const { data } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .createSignedUrl(path, 60 * 60, opts?.download ? { download: opts.download } : undefined);
  return data?.signedUrl ?? null;
};

/** Bezpečně přečte materiály z jsonb sloupce. */
export const parseMaterials = (value: unknown): AssignmentMaterial[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((m): m is AssignmentMaterial => !!m && typeof m === "object" && "kind" in (m as any));
};

/** Doplní chybějící protokol, aby odkaz fungoval i po vložení „www.…“. */
export const normalizeUrl = (raw: string) => {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
