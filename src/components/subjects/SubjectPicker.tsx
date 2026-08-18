import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useSubjectCatalog, useInvalidateSubjectCatalog } from "@/hooks/useSubjectCatalog";
import { createSubject } from "@/lib/subjects-catalog";

interface Props {
  /** Currently selected subject id (preferred source of truth). */
  value?: string | null;
  /** Legacy free-text value — used to preselect rows without `subject_id`. */
  textValue?: string | null;
  /** Fires with both the canonical id and the display name (dual write). */
  onChange: (next: { subjectId: string | null; name: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Allow creating a brand-new subject straight from the picker. */
  allowCreate?: boolean;
}

/**
 * Subject combobox backed by the canonical `subjects` catalog.
 * Supports creating a new subject inline (written to `subjects` only).
 */
const SubjectPicker = ({
  value,
  textValue,
  onChange,
  placeholder = "Vyberte předmět…",
  className,
  disabled,
  allowCreate = true,
}: Props) => {
  // Archived subjects are not offered for new links, but an already selected
  // archived subject must still render its name — hence `allSubjects` below.
  const { subjects, allSubjects, loading } = useSubjectCatalog();
  const invalidate = useInvalidateSubjectCatalog();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = useMemo(() => {
    if (value) return allSubjects.find((s) => s.id === value);
    if (textValue) {
      const t = textValue.trim().toLowerCase();
      return allSubjects.find((s) => s.name.trim().toLowerCase() === t);
    }
    return undefined;
  }, [allSubjects, value, textValue]);

  const label = selected?.name ?? (textValue?.trim() || "");

  const exactExists = subjects.some(
    (s) => s.name.trim().toLowerCase() === search.trim().toLowerCase(),
  );

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createSubject({ name });
      invalidate();
      onChange({ subjectId: created.id, name: created.name });
      setOpen(false);
      setSearch("");
      toast.success(`Předmět „${created.name}" byl vytvořen.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Předmět se nepodařilo vytvořit.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !label && "text-muted-foreground")}>
            {label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Hledat předmět…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {!loading && <CommandEmpty>Žádný předmět nenalezen.</CommandEmpty>}
            <CommandGroup>
              {subjects.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => {
                    onChange({ subjectId: s.id, name: s.name });
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span
                    className="mr-2 h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="truncate">{s.name}</span>
                  {selected?.id === s.id && <Check className="ml-auto h-4 w-4" />}
                </CommandItem>
              ))}
            </CommandGroup>
            {allowCreate && search.trim() && !exactExists && (
              <CommandGroup>
                <CommandItem value={`__create__${search}`} onSelect={handleCreate} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" />
                  {creating ? "Vytvářím…" : `Založit předmět „${search.trim()}"`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SubjectPicker;
